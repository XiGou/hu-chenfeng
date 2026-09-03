/**
 * 展厅入口 — gallery.html
 */
import { createSSRApp, createApp } from "vue";
import GalleryPage from "../pages/GalleryPage.vue";
import "../styles/main.css";

const el = document.querySelector("#app");
if (!el) throw new Error("#app 元素缺失");
if (el.children.length) {
  createSSRApp(GalleryPage).mount(el);
} else {
  createApp(GalleryPage).mount(el);
}
