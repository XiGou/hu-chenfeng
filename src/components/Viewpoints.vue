<script setup>
import { computed } from "vue";
import { viewpoints } from "../data/viewpoints.js";

const props = defineProps({
  keyword: { type: String, default: "" },
});
const emit = defineEmits(["open"]);

const filtered = computed(() => {
  const kw = props.keyword.trim().toLowerCase();
  if (!kw) return viewpoints;
  return viewpoints
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) =>
        (it.title + " " + it.quote + " " + sec.title)
          .toLowerCase()
          .includes(kw)
      ),
    }))
    .filter((sec) => sec.items.length > 0);
});

function fmtSource(s) {
  return s.replace(/\.md$/, "");
}
</script>

<template>
  <div class="vp">
    <div class="list-head">
      <span class="label">Viewpoints · 观点</span>
      <span class="count">{{ filtered.length }} 类</span>
    </div>

    <p class="vp-note">
      由 AI 通读《HuChenFeng 直播文字稿全集》（2023–2025，524 篇）后，在忠于原文的基础上归纳出的一组核心观点，每条均可追溯原文出处。
    </p>

    <p v-if="keyword && filtered.length === 0" class="search-empty">
      未找到与“{{ keyword }}”匹配的观点
    </p>

    <section v-for="sec in filtered" :key="sec.id" class="vp-sec">
      <h2 class="vp-sec-title">
        <span class="vp-no">{{ String(sec.id).padStart(2, "0") }}</span>
        {{ sec.title }}
      </h2>
      <p v-if="sec.intro" class="vp-intro">{{ sec.intro }}</p>

      <ul class="vp-list">
        <li v-for="(it, i) in sec.items" :key="i" class="vp-item">
          <h3 class="vp-item-title">{{ it.title }}</h3>
          <blockquote class="vp-quote">{{ it.quote }}</blockquote>
          <p class="vp-source">—— {{ fmtSource(it.source) }}</p>
        </li>
      </ul>
    </section>
  </div>
</template>
