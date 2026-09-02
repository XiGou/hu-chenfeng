// ==========================================================================
// tags · 主题标签（theme）解析工具
//
// 选读的 theme 字段支持填写【多个主题标签】，用「空格 / 中文顿号、或 / 、 ,」
// 之一作为分隔符隔开即可，例如：
//
//   theme: 小地方 / 大城市          → ['小地方', '大城市']
//   theme: 小地方 大城市            → ['小地方', '大城市']
//   theme: 经济、现实              → ['经济', '现实']
//
// 前端展示时会把每个标签渲染成独立的「胶囊」样式，点任一个即可按该标签检索。
// ==========================================================================

/** 将一个 theme 字符串切分成若干标签（去空、去重保序） */
export function splitThemes(theme) {
  if (!theme || typeof theme !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const seg of theme.split(/[\s/、，,|;；]+/)) {
    const t = seg.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/** 单条 theme 是否含多个标签 */
export function hasMultiple(theme) {
  return splitThemes(theme).length > 1;
}
