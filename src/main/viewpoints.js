/**
 * 观点入口 — viewpoints.html
 */
import { createSSRApp, createApp } from "vue";
import ViewpointsPage from "../pages/ViewpointsPage.vue";
import "../styles/main.css";

const el = document.querySelector("#app");
if (!el) throw new Error("#app 元素缺失");
if (el.children.length) {
  createSSRApp(ViewpointsPage).hydrate(el);
} else {
  createApp(ViewpointsPage).mount(el);
}
