// ==========================================================================
// audio-registry · 详情页音频「播完」事件汇总（连播触发器）
//
// 详情页音频有两条播放路径：
//   1) 原生 <audio>（波形模块加载失败 / 无 JS 场景的兜底）
//   2) Wavesurfer 波形播放器（接管后隐藏原生播放器，用自建 media 元素）
// 连播需要「一条音频播完 → 打开下一条」，且无论哪条路径到达终点只触发一次。
//
// 用法（同一详情页内）：
//   EssenceDetail:  setEndedHandler(onAdvance)   —— 注册连播动作
//   WaveAudio:      bindNativeAudio(el)          —— 原生 ended 接入
//                   ws.on("finish", feedEnded)   —— 波形 finish 接入
// 两条路径任意一条先播完即触发一次 handler，其余忽略（幂等）。
// ==========================================================================

let onEndedCb = null;
let fired = false;

function handleEnded() {
  if (fired) return;
  fired = true;
  if (typeof onEndedCb === "function") onEndedCb();
}

/** 注册「本条播完」的连播动作（详情页 hydration 时调用一次） */
export function setEndedHandler(cb) {
  onEndedCb = typeof cb === "function" ? cb : null;
  fired = false;
}

/** 原生 <audio> 播完接入：监听其 ended 事件 */
export function bindNativeAudio(el) {
  if (el && typeof el.addEventListener === "function") {
    el.addEventListener("ended", handleEnded);
  }
}

/** 波形播放器 finish 事件入口（与原生 ended 汇总，幂等） */
export function feedEnded() {
  handleEnded();
}
