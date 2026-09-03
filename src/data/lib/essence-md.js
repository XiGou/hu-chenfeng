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
//   note: 编者批注……            # 可选 · 展示在选读页面顶部的编者批注
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
 *            source?:string, audio?:string, video?:string, links?:object[], note?:string}}
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
  for (const k of ['title', 'date', 'theme', 'source', 'note']) {
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
 * @param {object} item 需含 id/theme/text；title/date/source/note/audio/video/links 可选
 * @returns {string}
 */
export function stringifyMarkdownItem(item) {
  const lines = ['---'];
  const put = (k, v) => {
    if (v === undefined || v === null || String(v).trim() === '') return;
    // 规整换行（\r\n / \r → \n），避免 YAML 块标量中残留 CR
    const val = String(v).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (val.includes('\n')) {
      // 多行值（如编者批注 note 含换行/分段）→ YAML 字面量块标量
      const indented = val
        .split('\n')
        .map((l) => (l === '' ? '' : '  ' + l))
        .join('\n');
      lines.push(`${k}: |-`);
      if (indented) lines.push(indented);
    } else {
      lines.push(`${k}: ${val}`);
    }
  };
  put('id', item.id);
  put('title', item.title);
  put('date', item.date);
  put('theme', item.theme);
  put('source', item.source);
  put('note', item.note);
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
    } else if (/^[|>][-+]?$/.test(val)) {
      // 多行标量（字面量 | 或折叠 >）：值由后续缩进行组成
      const [blockValue, consumed] = parseBlockScalar(lines, i + 1, val);
      out[key] = blockValue;
      i += consumed;
    } else {
      out[key] = parseScalar(val);
      i++;
    }
  }
  return out;
}

/**
 * 解析 YAML 块标量（字面量 | 或折叠 >）的后续缩进行。
 * @returns {[string, number]} [解析出的值, 消费的行数(含块内行，不含下一键行)]
 */
function parseBlockScalar(lines, startIdx, indicator) {
  // 块内容行相对 front-matter 顶层键（第 0 列）缩进，取首个非空内容行的缩进为基准
  let i = startIdx;
  let indent = -1;
  while (i < lines.length) {
    const ln = lines[i];
    if (ln.trim() === '') { i++; continue; }
    indent = ln.match(/^ */)[0].length;
    break;
  }
  if (indent < 0) return ['', i - startIdx];
  const rows = [];
  while (i < lines.length) {
    const ln = lines[i];
    const curIndent = ln.match(/^ */)[0].length;
    if (ln.trim() !== '' && curIndent < indent) break; // 缩进不足 → 回到顶层键
    if (ln.trim() === '') {
      // 空行：缩进至少达到基准才视为块内空行，否则可能是块后的分隔行
      rows.push('');
      i++;
      continue;
    }
    rows.push(ln.slice(indent));
    i++;
  }
  // 折叠（>）：空行为段落分隔，段内连续非空行以空格连接
  const folded = indicator[0] === '>';
  let value;
  if (folded) {
    const paras = [];
    let buf = [];
    for (const r of rows) {
      if (r === '') {
        if (buf.length) paras.push(buf.join(' '));
        buf = [];
      } else {
        buf.push(r);
      }
    }
    if (buf.length) paras.push(buf.join(' '));
    value = paras.join('\n');
  } else {
    value = rows.join('\n');
  }
  // 字符剪除：'-' 去尾换行 / '+' 保尾换行 / 默认单个尾换行——统一 trim 尾空白即可
  return [value.replace(/\n+$/, ''), i - startIdx];
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
