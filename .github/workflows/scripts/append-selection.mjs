#!/usr/bin/env node
/**
 * 解析 GitHub Issue（表单式模板）内容，将新选读信息追加到 src/data/essence.js，
 * 供 create-pull-request Action 生成 PR。
 *
 * 用法：
 *   node append-selection.mjs <issue-body-file>
 *
 * 说明：仓库 package.json 声明了 "type": "module"，本脚本采用 ESM（.mjs）。
 *
 * 音频（audio）字段支持三种取值：
 *   1. GitHub Issue 附件 URL（用户上传的二进制音频文件）
 *      → 下载到 public/audio/quotes/ 并贴入仓库，essence.js 引用本地资源路径
 *   2. 外链 URL（https:// 其他域名）
 *      → 原样保留
 *   3. 仓库内路径（如 public/audio/... 或 audio/quotes/...）
 *      → 转成站点资源路径保留
 */
import fs from 'node:fs';

const bodyFile = process.argv[2];
if (!bodyFile) {
  console.error('用法: node append-selection.mjs <issue-body-file>');
  process.exit(1);
}
const body = fs.readFileSync(bodyFile, 'utf8');

// GitHub 表单式模板生成的 body 形如：
//   ### 标题
//
//   标题值
// 按「### 」分节解析，取每个小节标题后的内容（去除首尾空行）。
function parseSections(raw) {
  const sections = {};
  const blocks = raw.split(/^### (.+)$/m);
  for (let i = 1; i < blocks.length; i += 2) {
    const key = blocks[i].trim();
    const value = (blocks[i + 1] || '').trim();
    sections[key] = value;
  }
  return sections;
}

const sec = parseSections(body);
const title = sec['标题'] || '';
const date = sec['直播日期'] || '';
const theme = sec['主题 tag'] || '其他';
const text = sec['正文文本'] || '';
const source = sec['原始出处'] || '';
const audioRaw = sec['音频（可选）'] || '';
const linksRaw = sec['外链（可选）'] || '';

if (!text) {
  console.error('未提取到正文文本，跳过。');
  process.exit(1);
}

// 解析外链：每行「类型|标签|URL」
const links = linksRaw
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const parts = l.split('|').map((s) => s.trim());
    if (parts.length < 3) return null;
    return { type: parts[0], label: parts[1], url: parts.slice(2).join('|') };
  })
  .filter(Boolean);

// id 自动生成：取现有最大 id + 1
const essencePath = 'src/data/essence.js';
const essenceSrc = fs.readFileSync(essencePath, 'utf8');
const idRe = /\bid:\s*(\d+)/g;
let maxId = 0;
let m;
while ((m = idRe.exec(essenceSrc)) !== null) {
  const n = parseInt(m[1], 10);
  if (n > maxId) maxId = n;
}
const newId = maxId + 1;

// ================= 音频处理 =================
// 下载的音频文件存放目录（相对仓库根）
const AUDIO_DIR = 'public/audio/quotes';
// essence.js 顶部定义的基础路径变量名
const BASE_VAR = '${base}';

// 从文本中提取 URL（兼容 markdown 链接 [文本](url) / ![文本](url)）
function extractUrl(raw) {
  const trimmed = raw.trim();
  const md = trimmed.match(/!?\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/);
  return md ? md[1] : trimmed;
}

// 从 Content-Type 推断音频扩展名
function extFromContentType(ct) {
  const t = (ct || '').toLowerCase();
  if (t.includes('mpeg') || t.includes('audio/mp3')) return '.mp3';
  if (t.includes('mp4') || t.includes('audio/x-m4a')) return '.m4a';
  if (t.includes('wav')) return '.wav';
  if (t.includes('ogg') || t.includes('opus')) return '.ogg';
  if (t.includes('flac')) return '.flac';
  if (t.includes('aac')) return '.aac';
  return '';
}

// 从 URL 路径推断扩展名
function extFromUrl(url) {
  const clean = url.split('?')[0].split('#')[0];
  const m = clean.match(/\.(mp3|m4a|wav|ogg|opus|flac|aac)$/i);
  return m ? `.${m[1].toLowerCase()}` : '';
}

// 下载 GitHub issue 附件音频到仓库，返回站点相对路径；失败返回 null
async function downloadGithubAsset(url, baseName) {
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (e) {
    console.error(`下载音频出错: ${e.message}`);
    return null;
  }
  if (!res.ok) {
    console.error(`下载音频失败: ${url} (HTTP ${res.status})`);
    return null;
  }
  const ct = res.headers.get('content-type') || '';
  const ext = extFromUrl(url) || extFromContentType(ct) || '.mp3';
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  const filename = `${baseName}${ext}`;
  const dest = `${AUDIO_DIR}/${filename}`;
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`已下载音频并贴入仓库: ${dest} (${buf.length} bytes)`);
  // 返回站点资源相对路径（相对 public 根，供 ${base} 拼接）
  return `audio/quotes/${filename}`;
}

// 解析音频字段，返回写入 essence.js 的值：
//   - 返回 { template: true,  value } 表示需要输出 ${base}... 模板字符串
//   - 返回 { template: false, value } 表示输出普通字符串（外链）
async function resolveAudio(raw, baseName) {
  if (!raw) return null;
  const url = extractUrl(raw);
  const isGithubAsset =
    /^https:\/\/github\.com\/user-attachments\/assets\//.test(url) ||
    /^https:\/\/user-images\.githubusercontent\.com\//.test(url);

  if (isGithubAsset) {
    // issue 中的二进制附件 → 下载贴入仓库
    const rel = await downloadGithubAsset(url, baseName);
    if (rel) {
      return { template: true, value: `${BASE_VAR}${rel}` };
    }
    // 下载失败回退为外链
    return { template: false, value: url };
  }
  if (/^https?:\/\//.test(url)) {
    // 外链 → 保留
    return { template: false, value: url };
  }
  // 仓库内路径 → 统一转成站点资源路径
  let p = raw.trim().replace(/^public\//, '');
  if (p.startsWith('/')) p = p.slice(1);
  return { template: true, value: `${BASE_VAR}${p}` };
}

// 音频默认文件名：优先用直播日期，回退用 id
const audioBaseName = date || `selection-${newId}`;
const audio = await resolveAudio(audioRaw, audioBaseName);

// ================= 生成对象字面量 =================
const objLines = ['  {'];
const prop = (k, v, isStr = true, comma = true) => {
  let line = `    ${k}: `;
  line += isStr ? `"${String(v).replace(/"/g, '\\"').replace(/\n/g, ' ')}"` : v;
  if (comma) line += ',';
  objLines.push(line);
};

prop('id', newId, false);
if (date) prop('date', date);
if (theme) prop('theme', theme);
prop('text', text);
if (source) prop('source', source);
if (audio) {
  // audio 模板字符串（含 ${base}）需原样输出；普通字符串则转义
  if (audio.template) {
    objLines.push(`    audio: \`${audio.value}\`,`);
  } else {
    prop('audio', audio.value);
  }
}
if (links.length) {
  objLines.push('    links: [');
  links.forEach((l, i) => {
    const comma = i < links.length - 1 ? ',' : '';
    objLines.push(`      { type: "${l.type}", label: "${l.label}", url: "${l.url}" }${comma}`);
  });
  objLines.push('    ],');
}
objLines.push('  },');
const block = objLines.join('\n');

// 在 essence 数组开头插入
const marker = 'export const essence = [';
const idx = essenceSrc.indexOf(marker);
if (idx === -1) {
  console.error('未找到 essence 数组定义');
  process.exit(1);
}
const insertAt = idx + marker.length;
const newSrc =
  essenceSrc.slice(0, insertAt) + '\n' + block + essenceSrc.slice(insertAt);
fs.writeFileSync(essencePath, newSrc);

console.log(`已追加选读 id=${newId}`);
console.log('--- 生成内容 ---');
console.log(block);
