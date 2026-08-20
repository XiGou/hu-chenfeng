<script setup>
import { computed, onMounted, ref, watch } from "vue";
import Masthead from "./components/Masthead.vue";
import QuoteCard from "./components/QuoteCard.vue";
import quotesData from "./data/quotes.json";

const meta = quotesData.meta;
const quotes = ref([]);
const keyword = ref("");
const typewriterOn = ref(false);

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return quotes.value;
  return quotes.value.filter((q) => {
    const hay = [q.text, q.category, (q.tags || []).join(" "), q.date]
      .join(" ")
      .toLowerCase();
    return kw.split(/\s+/).every((w) => hay.includes(w));
  });
});

onMounted(() => {
  quotes.value = quotesData.quotes.map((q, i) => ({ ...q, id: i + 1 }));
});

// 尊重系统减少动效偏好
const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
watch(typewriterOn, (v) => {
  document.body.classList.toggle("typewriter", v);
});
</script>

<template>
  <Masthead
    :meta="meta"
    v-model:keyword="keyword"
    v-model:typewriter="typewriterOn"
    :reduced-motion="prefersReduced"
  />

  <main class="content">
    <div class="toolbar">
      <span class="count">
        共 <span class="num">{{ filtered.length }}</span> 篇
      </span>
      <button
        v-if="!prefersReduced"
        class="ghost-btn"
        type="button"
        @click="typewriterOn = !typewriterOn"
      >
        {{ typewriterOn ? "⏸ 停止打字机" : "🔤 打字机动画" }}
      </button>
    </div>

    <section class="quotes" aria-live="polite">
      <TransitionGroup name="list">
        <QuoteCard v-for="q in filtered" :key="q.id" :quote="q" />
      </TransitionGroup>
    </section>

    <p v-if="!filtered.length" class="empty">未检索到相关语录。</p>
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

.list-enter-active {
  transition: all 0.5s var(--ease);
}
.list-enter-from {
  opacity: 0;
  transform: translateY(14px);
}
</style>
