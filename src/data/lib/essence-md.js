// ==========================================================================
// essence-md · 选读 Markdown 单文件解析器（纯函数，无运行时依赖）
//
// 选读（Essence）的每一条内容独立维护为一个 Markdown 文件，存放于
// `src/data/essence/`。文件采用「YAML front-matter + 正文」的易读结构：
//
//   ---
//   id: 1
//   title: 关于人生节奏的一段话   # 标题（可选）
//   date: 2025-01-14
//   theme: 节奏
//   source: reference/hu-chenfeng/2025年01月/2025-01-14.md
//   audio: audio/quotes/2025-01-14.mp3    # 站点资源路径（相对 public），可选
//   video: https://...                     # 外链视频，可选
//   links:                                 # 可选
//     - type: youtube
//       label: 完整直播录像
//       url: https://...
//   ---
//   <正文，即摘录文本 text>
//
// 解析产物为一条选读对象（schema 见 parseMarkdownItem）。audio/video 字段
// 只做原样规整，不拼 base 前缀——由前端在加载后统一加 BASE_URL。
//
// 本文件同时被两类环境 import：
//   1. Vite 前端（src/data/essence.js 用 import.meta.glob 读目录后调用）
//   2. Node 脚本（.github/workflows/scripts/append-selection.mjs）
// 因此必须保持为「纯字符串 → 对象」的纯函数，禁止引入 DOM / node 专属 API。
// ==========================================================================

/**
 * 将单条选读的 Markdown 原始文本解析为对象。
 * @param {string} raw
 * @returns {{id?:number, title?:string, date?:string, theme?:string, text:string,
 *            source?:string, audio?:string, video?:string, links?:object[]}}
 */
export function parseMarkdownItem(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) {
    throw new Error('选读 Markdown 缺少 front-matter（文件须以 "---" 开头）');
  }
  const meta = parseYamlSubset(m[1]);
  const body = (m[2] || '').trim();

  const item = { text: body };
  if (meta.id !== undefined && meta.id !== null && meta.id !== '') {
    item.id = Number(meta.id);
    if (Number.isNaN(item.id)) throw new Error('id 字段必须是数字');
  }
  for (const k of ['title', 'date', 'theme', 'source']) {
    const v = meta[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      item[k] = String(v).trim();
    }
  }
  for (const k of ['audio', 'video']) {
    const v = meta[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      item[k] = String(v).trim();
    }
  }
  if (Array.isArray(meta.links) && meta.links.length) {
    item.links = meta.links
      .map((o) => ({
        type: String((o && o.type) || '').trim(),
        label: String((o && o.label) || '').trim(),
        url: String((o && o.url) || '').trim(),
      }))
      .filter((o) => o.url);
  }
  return item;
}

/**
 * 将一条选读对象序列化为 Markdown 文本（含 front-matter 与正文）。
 * 供 append-selection.mjs 在新增选读时生成独立文件。
 * @param {object} item 需含 id/theme/text；title/date/source/audio/video/links 可选
 * @returns {string}
 */
export function stringifyMarkdownItem(item) {
  const lines = ['---'];
  const put = (k, v) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      lines.push(`${k}: ${String(v).trim()}`);
    }
  };
  put('id', item.id);
  put('title', item.title);
  put('date', item.date);
  put('theme', item.theme);
  put('source', item.source);
  put('audio', item.audio);
  put('video', item.video);
  if (Array.isArray(item.links) && item.links.length) {
    lines.push('links:');
    for (const l of item.links) {
      lines.push(`  - type: ${l.type || ''}`);
      if (l.label) lines.push(`    label: ${l.label}`);
      lines.push(`    url: ${l.url}`);
    }
  }
  lines.push('---', '');
  lines.push(String(item.text || '').trim());
  return lines.join('\n');
}

// ---------- 极简 YAML 子集解析（仅支持顶层标量/空值与一层列表） ----------

function parseScalar(s) {
  let v = s.trim();
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1);
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

/** 判断某行是否为列表项的起始（形如「  - key: val」） */
function isListItem(line) {
  return /^ +-\s+[\w-]+\s*:/.test(line) || /^-\s+[\w-]+\s*:/.test(line);
}

function parseYamlSubset(text) {
  const lines = text.split(/\r?\n/);
  const out = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const kv = /^([\w-]+)\s*:\s*(.*)$/.exec(line.trim());
    if (!kv) { i++; continue; }
    const key = kv[1];
    const val = kv[2].trim();
    if (val === '') {
      // 空值：后面可能跟列表
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && isListItem(lines[j])) {
        const listIndent = lines[j].match(/^ */)[0].length;
        const [listArr, consumed] = consumeList(lines, j);
        out[key] = listArr;
        i = j + consumed;
      } else {
        out[key] = null;
        i++;
      }
    } else {
      out[key] = parseScalar(val);
      i++;
    }
  }
  return out;
}

function consumeList(lines, startIdx) {
  // listIndent 取第一项「-」前的空格数
  const listIndent = lines[startIdx].match(/^ */)[0].length;
  const list = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const curIndent = line.match(/^ */)[0].length;
    if (curIndent < listIndent) break;
    const itemMatch = /^ *-\s+([\w-]+)\s*:\s*(.*)$/.exec(line);
    if (!itemMatch) break;
    const obj = {};
    obj[itemMatch[1]] = parseScalar(itemMatch[2]);
    i++;
    while (i < lines.length) {
      const nxt = lines[i];
      if (!nxt.trim()) { i++; continue; }
      const ni = nxt.match(/^ */)[0].length;
      if (ni <= listIndent) break;
      const kv = /^ *([\w-]+)\s*:\s*(.*)$/.exec(nxt);
      if (!kv) { i++; continue; }
      obj[kv[1]] = parseScalar(kv[2]);
      i++;
    }
    list.push(obj);
  }
  return [list, i - startIdx];
}
