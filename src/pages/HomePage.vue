<script setup>
/**
 * 首页 — 选读 (Essence) 精华列表
 *
 * 站彻底 MPA：本页位于根 URL（index.html）。展示精华选读目录，
 * 点击条目跳转到独立详情页（选读/<id>.html）。
 */
import { ref, computed } from "vue";
import PageShell from "../layout/PageShell.vue";
import Toc from "../components/Toc.vue";
import { essence } from "../data/essence.js";

const keyword = ref("");

const items = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return essence;
  return essence.filter((q) => {
    const haystack = [q.title, q.text, q.theme, q.date, q.source]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(kw);
  });
});
</script>

<template>
  <PageShell active="home">
    <!-- 全局检索 -->
    <div class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        class="search-input"
        type="search"
        v-model="keyword"
        placeholder="搜索语录、主题或日期…"
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

    <Toc
      :items="items"
      :total="essence.length"
      :keyword="keyword"
    />
  </PageShell>
</template>
