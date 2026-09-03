/**
 * 首页入口 — index.html
 * 静态部署时 HTML 已含 pre-render 注入的内容 → hydrate 恢复交互；
 * 若为空容器（开发模式）→ 普通 mount。
 */
import { createSSRApp, createApp } from "vue";
import HomePage from "../pages/HomePage.vue";
import "../styles/main.css";

const mount = () => {
  const el = document.querySelector("#app");
  if (!el) return;
  if (el.children.length) {
    createSSRApp(HomePage).hydrate(el);
  } else {
    createApp(HomePage).mount(el);
  }
};
mount();
