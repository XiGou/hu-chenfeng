// ==========================================================================
// playback-mode · 连播模式（podcast 式自动播放）共享工具
//
// 首页（Toc）提供连播入口：
//   · 顺序连播 —— 从第 1 则起按 id 升序逐条自动播放
//   · 随机连播 —— 随机一条开始，播完随机跳下一条
//   · 停止     —— 关闭连播
//
// 模式是「运行时用户状态」，存于 localStorage（hc-playback-mode）：
//   - 首页点击入口 → 写入模式 → 跳到对应选读详情页
//   - 详情页 hydration 后读取模式 → 自动播放，音频结束（或无音频稍候）
//     自动打开下一条详情页，实现「每选中下一个选读就打开对应页面」。
//
// SSR 下（无 localStorage）恒为 off：预渲染 HTML 不含连播状态元素，
// 自动播放与页面跳转本就依赖 JS，无 JS 环境保持原有静态阅读体验。
// ==========================================================================

/** 支持的模式 */
export const MODES = ["off", "seq", "random"];

/** localStorage 键名 */
export const STORAGE_KEY = "hc-playback-mode";

/** 模式变化事件名（同页多组件同步状态用） */
export const MODE_CHANGE_EVENT = "hc:mode-change";

/** 读取当前连播模式（仅浏览器环境；SSR / 隐私模式降级为 off） */
export function getMode() {
  if (typeof localStorage === "undefined") return "off";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(v) ? v : "off";
  } catch (e) {
    return "off";
  }
}

/** 写入连播模式并广播变化事件（仅浏览器环境调用） */
export function setMode(mode) {
  if (!MODES.includes(mode)) mode = "off";
  try {
    if (mode === "off") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch (e) {
    /* 隐私模式等场景忽略写入失败 */
  }
  try {
    window.dispatchEvent(new CustomEvent(MODE_CHANGE_EVENT, { detail: mode }));
  } catch (e) {
    /* 忽略 */
  }
  return mode;
}
