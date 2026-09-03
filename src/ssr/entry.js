/**
 * SSR 渲染入口 — 供构建期「全量预渲染」使用。
 *
 * 导出 renderPage(page) 纯函数：
 *   输入页面 key（'home' | 'viewpoints' | 'quotations' | 'gallery'），
 *   返回该页面组件 SSR 渲染出的 HTML 字符串。
 *
 * 此文件由 scripts/pre-render.mjs 通过 Vite 的 ssrLoadModule 加载，
 * 所有 import.meta.env / import.meta.glob 均由 Vite 正确转换。
 */
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";

import HomePage from "../pages/HomePage.vue";
import ViewpointsPage from "../pages/ViewpointsPage.vue";
import QuotationsPage from "../pages/QuotationsPage.vue";
import GalleryPage from "../pages/GalleryPage.vue";

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
