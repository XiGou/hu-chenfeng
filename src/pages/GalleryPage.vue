<script setup>
/**
 * 展厅页面 — 对应独立 URL /gallery.html
 */
import { ref } from "vue";
import PageShell from "../layout/PageShell.vue";
import Gallery from "../components/Gallery.vue";

const keyword = ref("");
</script>

<template>
  <PageShell active="gallery">
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        class="search-input"
        type="search"
        v-model="keyword"
        placeholder="搜索图像、标题…"
        aria-label="搜索内容"
      />
      <button
        v-if="keyword"
        class="search-clear"
        type="button"
        aria-label="清空搜索"
        @click="keyword = ''"
      >✕</button>
    </div>

    <Gallery :keyword="keyword" />
  </PageShell>
</template>
