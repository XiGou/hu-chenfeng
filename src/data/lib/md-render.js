// ==========================================================================
// md-render · 极简 Markdown → HTML 渲染（前端正文展示用）
//
// 选读「正文」来自「提交新选读」Issue 的原始文本（多为直播文字稿摘录，
// 以自然换行 / 空行分段）。此前正文以纯文本插值渲染，浏览器会把所有空白
// 压成单个空格，导致一整块、不分段、不好阅读。
//
// 本模块在**不引入任何外部依赖**的前提下，将正文按 Markdown 常用写法渲染：
//   - 段落（空行分段）→ <p>
//   - 换行（非空行内的换行）→ <br>
//   - 行首「> 」引用 → <blockquote>
//   - 行首「#/##/### 」标题、无序号/有序号列表 → 对应元素
//   - 行内 **加粗**、*斜体*、`代码`、[链接](url) → 对应元素
//   - 除「链接 href」「图片 src」外的原文一律转义，杜绝注入
//
// 纯函数、无 DOM 依赖，方便在需要处直接 import。
// ==========================================================================

/** HTML 转义：除 href/src 允许属性外，正文一律按纯文本转义，防注入。 */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 渲染行内标记（在单行内做加粗/斜体/行内码/链接）。 */
function renderInline(line) {
  let html = esc(line);
  // 行内代码 `code`
  html = html.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  // [文本](url) —— 链接
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (_, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );
  // **加粗**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // *斜体*（在已转义文本上操作，避免误伤）
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return html;
}

/**
 * 将多行正文（Markdown 子集）渲染为 HTML 字符串。
 * @param {string} text 原文（可含换行与空行分段）
 * @returns {string} 渲染后的 HTML（不含包裹根节点）
 */
export function renderMarkdown(text) {
  const src = String(text || '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const blocks = [];
  let i = 0;
  const n = lines.length;

  while (i < n) {
    const line = lines[i];

    // 空行 → 跳过（分段逻辑由非空行收集自然形成）
    if (!line.trim()) { i++; continue; }

    const trimmed = line.trim();

    // 行首标题 #/##/###
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // 行首引用 >  —— 收集连续引用行合并为一段
    if (/^>\s?/.test(trimmed)) {
      const buf = [];
      while (i < n && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(`<blockquote>${buf.map(renderInline).join('<br>')}</blockquote>`);
      continue;
    }

    // 有序列表 1. / 无序列表 -、*
    const isOl = /^\d+[.)]\s+/.test(trimmed);
    const isUl = /^[-*]\s+/.test(trimmed);
    if (isOl || isUl) {
      const tag = isUl ? 'ul' : 'ol';
      const items = [];
      while (i < n && /^(\d+[.)]|[-*])\s+/.test(lines[i].trim())) {
        const content = lines[i].trim().replace(/^(\d+[.)]|[-*])\s+/, '');
        items.push(`<li>${renderInline(content)}</li>`);
        i++;
      }
      blocks.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    // 普通段落：收集直至遇到空行 / 其他块级起始
    const para = [];
    while (i < n) {
      const cur = lines[i];
      if (!cur.trim()) break;
      const ct = cur.trim();
      if (/^(#{1,3})\s/.test(ct) || /^>\s?/.test(ct)) break;
      if (/^(\d+[.)]|[-*])\s+/.test(ct)) break;
      para.push(renderInline(cur));
      i++;
    }
    // 段内按换行拼 <br>（保留原换行）
    blocks.push(`<p>${para.join('<br>')}</p>`);
  }

  return blocks.join('\n');
}
