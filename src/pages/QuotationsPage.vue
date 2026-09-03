<script setup>
/**
 * 语录页面 — 对应独立 URL /quotations.html
 */
import { ref } from "vue";
import PageShell from "../layout/PageShell.vue";
import Quotes from "../components/Quotes.vue";

const keyword = ref("");
</script>

<template>
  <PageShell active="quotations">
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        class="search-input"
        type="search"
        v-model="keyword"
        placeholder="搜索语录、主题…"
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

    <Quotes :keyword="keyword" />
  </PageShell>
</template>
