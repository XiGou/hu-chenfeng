<script setup>
/**
 * PageShell — 全站共享的页面骨架。
 *
 * 站彻底 MPA：每个「栏目」为独立 URL 页面，统一套用此壳
 * （页头 / 栏目导航 / 关于浮层 / BGM / 页脚）。具体栏目内容
 * 由各页通过 <slot> 注入。
 */
import Masthead from "../components/Masthead.vue";
import About from "../components/About.vue";
import BgmPlayer from "../components/BgmPlayer.vue";
import { meta } from "../data/essence.js";

defineProps({
  /** 当前激活栏目 key：home | viewpoints | quotations | gallery */
  active: { type: String, required: true },
});

/** 所有页面均同目录输出（base:"./"），栏目间互链用相对 URL 即可适配任意子路径。 */
const navItems = [
  { key: "home",       label: "首页", href: "./index.html" },
  { key: "viewpoints", label: "观点", href: "./viewpoints.html" },
  { key: "quotations", label: "语录", href: "./quotations.html" },
  { key: "gallery",    label: "展厅", href: "./gallery.html" },
  { key: "pure",      label: "纯享", href: "./pure.html" },
];
</script>

<template>
  <Masthead :meta="meta" />

  <About />

  <nav class="section-nav" aria-label="内容栏目">
    <a
      v-for="item in navItems"
      :key="item.key"
      :class="{ active: active === item.key }"
      :href="item.href"
    >{{ item.label }}</a>
  </nav>

  <main>
    <slot />
  </main>

  <BgmPlayer />

  <footer class="site-foot">
    <span>户晨风 · 摘录</span>
  </footer>
</template>
