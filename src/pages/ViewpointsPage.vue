<script setup>
/**
 * 观点页面 — 对应独立 URL /viewpoints.html
 */
import { ref } from "vue";
import PageShell from "../layout/PageShell.vue";
import Viewpoints from "../components/Viewpoints.vue";

const keyword = ref("");
</script>

<template>
  <PageShell active="viewpoints">
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        class="search-input"
        type="search"
        v-model="keyword"
        placeholder="搜索观点、主题…"
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

    <Viewpoints :keyword="keyword" />
  </PageShell>
</template>
