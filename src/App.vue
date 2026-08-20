<script setup>
import { computed, onMounted, ref, watch } from "vue";
import Masthead from "./components/Masthead.vue";
import Toc from "./components/Toc.vue";
import Entry from "./components/Entry.vue";
import quotesData from "./data/quotes.json";

const meta = quotesData.meta;
const quotes = ref([]);

// —— 视图状态 ——
// view: 'toc' 目录 / 'entry' 词条详情
const view = ref("toc");
// 当前选中的词条 id（进入详情时使用）
const currentId = ref(null);
// 目录/检索状态
const keyword = ref("");
const activeTag = ref("");
const activeCategory = ref("");

// —— 数据装配 ——
onMounted(() => {
  quotes.value = quotesData.quotes.map((q, i) => ({ ...q, id: i + 1 }));
});

// 全部词条（已排序）
const allQuotes = computed(() => quotes.value);

// 分类列表（书的分章）
const categories = computed(() => {
  const map = new Map();
  allQuotes.value.forEach((q) => {
    const c = q.category || "未分类";
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(q);
  });
  return [...map.entries()];
});

// 全部标签（用于双链接与标签过滤）
const allTags = computed(() => {
  const set = new Set();
  allQuotes.value.forEach((q) => (q.tags || []).forEach((t) => set.add(t)));
  return [...set].sort();
});

// 目录过滤后的列表（关键字 / 分类 / 标签）
const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  return allQuotes.value.filter((q) => {
    if (activeCategory.value && q.category !== activeCategory.value) return false;
    if (activeTag.value && !(q.tags || []).includes(activeTag.value)) return false;
    if (kw) {
      const hay = [q.text, q.category, (q.tags || []).join(" "), q.date]
        .join(" ")
        .toLowerCase();
      if (!kw.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
});

// 分类过滤后的目录（带检索）
const filteredCategories = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  const map = new Map();
  filtered.value.forEach((q) => {
    const c = q.category || "未分类";
    if (!map.has(c)) map.set(c, []);
    map.get(c).push(q);
  });
  return [...map.entries()];
});

// 当前词条
const current = computed(() =>
  allQuotes.value.find((q) => q.id === currentId.value) || null
);

// 相关词条：共享至少一个标签（双链接的核心）
const related = computed(() => {
  if (!current.value) return [];
  const tags = new Set(current.value.tags || []);
  return allQuotes.value.filter(
    (q) => q.id !== current.value.id && (q.tags || []).some((t) => tags.has(t))
  );
});

// 上一条 / 下一条（翻书）
const prevQuote = computed(() => {
  const idx = allQuotes.value.findIndex((q) => q.id === currentId.value);
  return idx > 0 ? allQuotes.value[idx - 1] : null;
});
const nextQuote = computed(() => {
  const idx = allQuotes.value.findIndex((q) => q.id === currentId.value);
  return idx >= 0 && idx < allQuotes.value.length - 1
    ? allQuotes.value[idx + 1]
    : null;
});

// —— 导航动作 ——
function goEntry(id) {
  currentId.value = id;
  view.value = "entry";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function goToc() {
  view.value = "toc";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function applyTag(tag) {
  activeTag.value = tag;
  activeCategory.value = "";
  keyword.value = "";
  view.value = "toc";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function applyCategory(cat) {
  activeCategory.value = cat;
  activeTag.value = "";
  view.value = "toc";
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearFilters() {
  activeTag.value = "";
  activeCategory.value = "";
  keyword.value = "";
}
</script>

<template>
  <Masthead
    :meta="meta"
    v-model:keyword="keyword"
    :on-home="goToc"
  />

  <main class="content">
    <!-- 目录 / 书页视图 -->
    <Toc
      v-if="view === 'toc'"
      :categories="filteredCategories"
      :total="filtered.length"
      :active-tag="activeTag"
      :active-category="activeCategory"
      :all-tags="allTags"
      :keyword="keyword"
      @open="goEntry"
      @tag="applyTag"
      @category="applyCategory"
      @clear="clearFilters"
    />

    <!-- 百科词条详情视图 -->
    <Entry
      v-else-if="view === 'entry' && current"
      :quote="current"
      :related="related"
      :prev="prevQuote"
      :next="nextQuote"
      @open="goEntry"
      @back="goToc"
      @tag="applyTag"
    />
  </main>

  <footer class="colophon">
    <span class="seal-sm">晨</span>
    <p>户晨风语录 · 以纸为证，以言为铭</p>
  </footer>
</template>

<style scoped>
.content {
  min-height: 30vh;
}
</style>
