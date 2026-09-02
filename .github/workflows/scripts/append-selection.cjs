#!/usr/bin/env node
/**
 * 解析 GitHub Issue（表单式模板）内容，将新选读信息追加到 src/data/essence.js，
 * 供 create-pull-request Action 生成 PR。
 *
 * 用法：
 *   node append-selection.cjs <issue-body-file>
 *
 * 说明：仓库 package.json 声明了 "type": "module"，故本脚本使用 .cjs 扩展名。
 */
const fs = require('fs');

const bodyFile = process.argv[2];
if (!bodyFile) {
  console.error('用法: node append-selection.cjs <issue-body-file>');
  process.exit(1);
}
const body = fs.readFileSync(bodyFile, 'utf8');

// GitHub 表单式模板生成的 body 形如：
//   ### 标题
//
//   标题值
//
//   ### 直播日期
//
//   2025-01-14
// 按「### 」分节解析，取每个小节标题后的内容（去除首尾空行）。
function parseSections(raw) {
  const sections = {};
  // 以 "### " 开头的一行为节标题
  const blocks = raw.split(/^### (.+)$/m);
  // blocks[0] 是开头散文本，之后成对出现 [标题, 内容]
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
const audio = sec['音频路径（可选）'] || '';
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

// 生成对象字面量
const objLines = ['  {'];
const prop = (k, v, isStr = true, comma = true) => {
  let line = `    ${k}: `;
  line += isStr ? `"${String(v).replace(/"/g, '\\"').replace(/\n/g, ' ')}"` : v;
  if (comma) line += ',';
  objLines.push(line);
};

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

prop('id', newId, false);
if (date) prop('date', date);
if (theme) prop('theme', theme);
prop('text', text);
if (source) prop('source', source);
if (audio) prop('audio', audio);
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
