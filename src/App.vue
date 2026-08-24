<script setup>
import { ref, computed } from "vue";
import Masthead from "./components/Masthead.vue";
import Toc from "./components/Toc.vue";
import Entry from "./components/Entry.vue";
import Viewpoints from "./components/Viewpoints.vue";
import Quotes from "./components/Quotes.vue";
import BgmPlayer from "./components/BgmPlayer.vue";
import About from "./components/About.vue";
import { meta, essence } from "./data/essence.js";

// section: 'read' 选读 / 'viewpoints' 观点 / 'quotations' 语录
const section = ref("read");
// view: 'list' 列表 / 'entry' 详情（仅选读与语录使用）
const view = ref("list");
const currentId = ref(null);
const keyword = ref("");

const items = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return essence;
  return essence.filter((q) => {
    const haystack = [q.text, q.theme, q.date, q.source]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(kw);
  });
});
const current = computed(
  () => essence.find((q) => q.id === currentId.value) || null
);

function switchSection(sec) {
  section.value = sec;
  view.value = "list";
  currentId.value = null;
  keyword.value = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goSearch(kw) {
  keyword.value = kw;
  view.value = "list";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function goEntry(id) {
  currentId.value = id;
  view.value = "entry";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function goList() {
  view.value = "list";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
</script>

<template>
  <Masthead :meta="meta" />

  <About />

  <nav class="section-nav" aria-label="内容栏目">
    <button
      type="button"
      :class="{ active: section === 'read' }"
      @click="switchSection('read')"
    >选读</button>
    <button
      type="button"
      :class="{ active: section === 'viewpoints' }"
      @click="switchSection('viewpoints')"
    >观点</button>
    <button
      type="button"
      :class="{ active: section === 'quotations' }"
      @click="switchSection('quotations')"
    >语录</button>
  </nav>

  <main>
    <!-- 全局检索 -->
    <div v-if="section !== 'read' || view === 'list'" class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        class="search-input"
        type="search"
        v-model="keyword"
        :placeholder="section === 'viewpoints' ? '搜索观点、主题…' : (section === 'quotations' ? '搜索语录、主题…' : '搜索语录、主题或日期…')"
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

    <!-- 选读：精华摘录 -->
    <template v-if="section === 'read'">
      <Toc
        v-if="view === 'list'"
        :items="items"
        :total="essence.length"
        v-model:keyword="keyword"
        @open="goEntry"
      />
      <Entry
        v-else-if="view === 'entry' && current"
        :quote="current"
        @search="goSearch"
        @back="goList"
      />
    </template>

    <!-- 观点：重要观点列表 -->
    <Viewpoints
      v-else-if="section === 'viewpoints'"
      :keyword="keyword"
    />

    <!-- 语录：语录小文章 -->
    <Quotes
      v-else-if="section === 'quotations'"
      :keyword="keyword"
    />
  </main>

  <BgmPlayer />

  <footer class="site-foot">
    <span>户晨风 · 摘录</span>
    <a
      href="https://github.com/Olcmyk/HuChenFeng"
      target="_blank"
      rel="noopener noreferrer"
    >HuChenFeng 全集 ↗</a>
  </footer>
</template>
