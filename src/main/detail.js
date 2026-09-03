/**
 * 选读详情页入口 — 选读/<id>.html
 *
 * 详情页为「独立静态页」，每条对应一份选读/<id>.html。构建期已把每条详情
 * SSR 内容预渲染进 <div id="app">；本入口在浏览器里 hydration 恢复交互
 * （波形播放器 / 分享操作条）。
 *
 * 当前 id 从 <div id="app" data-id="N"> 读取；找不到匹配选读时静默降级为
 * 空容器（仅剩 SSR 静态内容，不再重复渲染，避免错位）。
 */
import { createSSRApp, createApp } from "vue";
import EssenceDetail from "../components/EssenceDetail.vue";
import { essence } from "../data/essence.js";
import "../styles/main.css";

const el = document.querySelector("#app");
if (!el) throw new Error("#app 元素缺失");

const rawId = el && el.getAttribute && el.getAttribute("data-id");
const id = rawId !== null ? Number(rawId) : NaN;
const item = essence.find((e) => e.id === id);

function mount() {
  if (!item) {
    // SSR 已含静态内容，仅保留之（无交互）。正常构建不会走到这里。
    return;
  }
  if (el.children.length) {
    createSSRApp(EssenceDetail, { item, relRoot: "../" }).mount(el);
  } else {
    createApp(EssenceDetail, { item, relRoot: "../" }).mount(el);
  }
}
mount();
