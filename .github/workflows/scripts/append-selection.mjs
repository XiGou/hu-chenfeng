#!/usr/bin/env node
/**
 * 解析 GitHub Issue（表单式模板）内容，将一条新选读生成为独立的 Markdown
 * 文件 `src/data/essence/<id>.md`，供 create-pull-request Action 生成 PR。
 *
 * 用法：
 *   node append-selection.mjs <issue-body-file> [<issue-title>]
 *
 * 标题（title）字段说明：
 *   从 Issue 表单 body 的「### 标题」小节提取；若该小节为空，则回退使用 Issue
 *   自身标题（第二参数，可选，自动剥离「选读：」前缀）。标题会写入 md front-matter，
 *   并作为音频下载时的默认基础文件名。
 *
 * 说明：仓库 package.json 声明了 "type": "module"，本脚本采用 ESM（.mjs）。
 * 选读数据采用「每内容单文件」维护（见 src/data/essence/README.md），因此
 * 本脚本不再往大数组里插入，而是新增一个编号的 Markdown 文件。
 *
 * 音频（audio）字段说明：
 *   音频一律不允许以「外链 URL」形式保留 —— 必须贴入仓库，
 *   由站点资源路径（相对 public，如 audio/quotes/xxx.mp3）引用。
 *   取值分两类：
 *   1. http(s) 链接（GitHub Issue 附件或任意外链）
 *      → 下载到 public/audio/quotes/ 并 commit 进仓库；若下载失败则报错中断，
 *        绝不回退为保留外链。
 *   2. 仓库内路径（如 audio/quotes/... 或 public/audio/quotes/...）
 *      → 规整为相对 public 的站点资源路径保留。
 */
import fs from 'node:fs';
import path from 'node:path';
import { stringifyMarkdownItem, parseMarkdownItem } from '../../../src/data/lib/essence-md.js';

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
// 标题：优先 body 内「### 标题」小节；为空时回退到 Issue 自身标题（剥离「选读：」前缀）
const issueTitle = (process.argv[3] || '').trim().replace(/^选读\s*[:：]?\s*/, '').trim();
const title = (sec['标题'] || issueTitle || '').trim();

const theme = sec['主题 tag'] || '其他';
const text = sec['正文文本'] || '';
const note = sec['编者批注（可选）'] || '';
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

// ================= 音频处理 =================
// 下载的音频文件存放目录（相对仓库根）
const AUDIO_DIR = 'public/audio/quotes';
// essence 单文件目录（相对仓库根）
const ESSENCE_DIR = 'src/data/essence';

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

// 下载音频 URL（GitHub Issue 附件或任意外链）到仓库，返回站点相对路径；失败返回 null
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
  // 返回站点资源相对路径（相对 public 根，essence.js 会自动拼 BASE_URL）
  return `audio/quotes/${filename}`;
}

// 解析音频字段，返回写入 md front-matter 的 audio 值：
//   - 下载音频/仓库内资源 → 相对 public 的站点资源路径（如 audio/quotes/xx.mp3）
//   - 音频一律不允许保留为外链 URL；任何 http(s) 链接都必须下载入仓库，
//     下载失败即报错中断，绝不回退为保留外链。
async function resolveAudio(raw, baseName) {
  if (!raw) return null;
  const url = extractUrl(raw);

  if (/^https?:\/\//.test(url)) {
    // GitHub Issue 附件或任意外链 → 统一下载贴入仓库
    const rel = await downloadGithubAsset(url, baseName);
    if (rel) return rel;
    // 下载失败：音频必须以仓库内资源引用，故直接中断本次提交
    throw new Error(`音频链接下载失败，不允许保留外链：${url}（请将音频文件作为 Issue 附件重新上传）`);
  }

  // 仓库内路径 → 规整为相对 public 的站点资源路径
  let p = raw.trim().replace(/^public\//, '');
  if (p.startsWith('/')) p = p.slice(1);
  return p;
}

// ================= 计算新 id =================
// 扫描 essence 单文件目录中所有数字命名的 md，取现有最大 id + 1
function maxExistingId() {
  let max = 0;
  if (!fs.existsSync(ESSENCE_DIR)) return max;
  for (const name of fs.readdirSync(ESSENCE_DIR)) {
    const m = /^(\d+)\.md$/.exec(name);
    if (!m) continue; // 跳过 README 等说明文件
    try {
      const item = parseMarkdownItem(
        fs.readFileSync(path.join(ESSENCE_DIR, name), 'utf8')
      );
      if (typeof item.id === 'number' && item.id > max) max = item.id;
    } catch (e) {
      console.warn(`跳过解析 ${name}: ${e.message}`);
    }
  }
  return max;
}

const newId = maxExistingId() + 1;

// 音频默认基础文件名：
//   - 有标题 → 用标题清洗后的文件名（可读、稳定）；保证非空
//   - 无标题 → 回退用 selection-<id>
// 清洗规则：保留中英文与数字，其余一律替换为连字符，压平多连字符并去首尾。
function slugifyBase(s) {
  return s
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || '';
}
const audioBaseName = slugifyBase(title) || `selection-${newId}`;
const audio = await resolveAudio(audioRaw, audioBaseName);

// ================= 生成单文件 Markdown 并写入 =================
const item = { id: newId, title: title || undefined, date: undefined, theme, text, source, note: note || undefined, audio, links };
const mdText = stringifyMarkdownItem(item);
const destFile = path.join(ESSENCE_DIR, `${newId}.md`);

fs.mkdirSync(ESSENCE_DIR, { recursive: true });
fs.writeFileSync(destFile, mdText);

// ================= 自校验 =================
// 生成后回读解析，确保单文件 md 能被 essence.js 正确读取（同源解析器）
const back = parseMarkdownItem(fs.readFileSync(destFile, 'utf8'));
if (back.id !== newId || !back.text) {
  console.error('自校验失败：新文件无法被正确解析为选读条目。');
  process.exit(1);
}

console.log(`已新增选读文件: ${destFile} (id=${newId})`);
console.log('--- 生成内容 ---');
console.log(mdText);
