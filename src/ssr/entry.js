/**
 * SSR 渲染入口 — 供构建期「全量预渲染」使用。
 *
 * 导出纯函数供 scripts/pre-render.mjs 加载：
 *   renderPage(page)         渲染 4 个列表栏目页（home/viewpoints/quotations/gallery）
 *   renderEssence(id)        渲染单条「选读」详情页内容（SSR，供 选读/<id>.html）
 *   listEssence()            返回全部选读（供 pre-render 遍历生成详情页）
 *
 * 此文件由 scripts/pre-render.mjs 经 Vite SSR 构建后加载，import.meta.glob 等
 * 均由 Vite 正确转换，essence 数据在构建期静态内联。
 *
 * 注意：连播模式（#86）是浏览器运行时状态（localStorage），SSR 恒按 off 渲染；
 * hydration 后由入口按实际状态恢复，预渲染 HTML 与状态互不干扰。
 */
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";

import HomePage from "../pages/HomePage.vue";
import ViewpointsPage from "../pages/ViewpointsPage.vue";
import QuotationsPage from "../pages/QuotationsPage.vue";
import GalleryPage from "../pages/GalleryPage.vue";
import EssenceDetail from "../components/EssenceDetail.vue";
import { essence } from "../data/essence.js";

const PAGES = {
  home: HomePage,
  viewpoints: ViewpointsPage,
  quotations: QuotationsPage,
  gallery: GalleryPage,
};

export async function renderPage(page) {
  const Comp = PAGES[page];
  if (!Comp) throw new Error(`未知页面: ${page}`);
  const app = createSSRApp(Comp);
  return await renderToString(app);
}

/** 渲染单条选读详情（SSR 内容）。item 缺省时按 id 在 essence 中查找。 */
export async function renderEssence(id, item) {
  const it = item || essence.find((e) => e.id === Number(id));
  if (!it) throw new Error(`未找到选读 id=${id}`);
  const app = createSSRApp(EssenceDetail, { item: it, relRoot: "../" });
  return await renderToString(app);
}

/** 全部选读（已按 id 升序），供构建期逐条生成详情页。 */
export function listEssence() {
  return essence;
}
