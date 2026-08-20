<script setup>
import { ref, computed } from "vue";
import Masthead from "./components/Masthead.vue";
import Toc from "./components/Toc.vue";
import Entry from "./components/Entry.vue";
import BgmPlayer from "./components/BgmPlayer.vue";
import { meta, essence } from "./data/essence.js";

// view: 'list' 列表 / 'entry' 详情
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

  <main>
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
