// ==========================================================================
// playlist · 连播列表导航（纯浏览器行为，跳转函数不可在 SSR 中调用）
//
// 「连播」= podcast 式自动播放：详情页音频播完 → 自动打开下一条选读详情页。
//   · 顺序（seq）：按 id 升序循环，末条回卷第 1 条
//   · 随机（random）：每步在其余条目中等概率随机挑选（不连播同一条）
//
// 详情页 URL 与 Toc 保持一致：./选读/<id>.html（encodeURIComponent 兼容中文目录）。
// 本模块仅被 Vue 组件（客户端 bundle）引用；essence 数据经 Vite 静态内联。
// ==========================================================================

import { essence } from "../essence.js";

/** 详情页子目录名（与 scripts/pre-render.mjs 的 DIR_NAME 一致） */
const DETAIL_DIR = "选读";

/** 全部选读 id（升序，与 essence.js 输出一致） */
export function essenceIds() {
  return essence.map((e) => e.id);
}

/** 选读详情页相对 URL（首页/详情页均可跳转） */
export function detailHref(id) {
  return "./" + encodeURIComponent(DETAIL_DIR) + "/" + id + ".html";
}

/**
 * 连播到下一条选读（页面级跳转）。
 * @param {number} fromId 当前选读 id
 * @param {"seq"|"random"} mode 连播模式
 * @returns {number|null} 打开的下一条 id（无数据时 null）
 */
export function goNext(fromId, mode) {
  const ids = essenceIds();
  if (!ids.length) return null;
  let next;
  if (mode === "random") {
    if (ids.length === 1) {
      next = ids[0];
    } else {
      const pool = ids.filter((x) => x !== Number(fromId));
      next = pool[Math.floor(Math.random() * pool.length)];
    }
  } else {
    const i = ids.indexOf(Number(fromId));
    next = i === -1 ? ids[0] : ids[(i + 1) % ids.length];
  }
  window.location.href = detailHref(next);
  return next;
}

/** 连播起点 id：顺序 = 第 1 条；随机 = 随机一条（无数据时 null） */
export function startId(mode) {
  const ids = essenceIds();
  if (!ids.length) return null;
  if (mode === "random") return ids[Math.floor(Math.random() * ids.length)];
  return ids[0];
}
