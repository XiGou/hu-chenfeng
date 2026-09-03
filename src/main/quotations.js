/**
 * 语录入口 — quotations.html
 */
import { createSSRApp, createApp } from "vue";
import QuotationsPage from "../pages/QuotationsPage.vue";
import "../styles/main.css";

const el = document.querySelector("#app");
if (!el) throw new Error("#app 元素缺失");
if (el.children.length) {
  createSSRApp(QuotationsPage).mount(el);
} else {
  createApp(QuotationsPage).mount(el);
}
