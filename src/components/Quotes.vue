<script setup>
import { ref, computed } from "vue";
import { quotations } from "../data/quotes.js";

const props = defineProps({
  keyword: { type: String, default: "" },
});
const emit = defineEmits(["open"]);

const currentId = ref(null);

const current = computed(
  () => quotations.find((q) => q.id === currentId.value) || null
);

function open(id) {
  currentId.value = id;
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function back() {
  currentId.value = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const filtered = computed(() => {
  const kw = props.keyword.trim().toLowerCase();
  if (!kw) return quotations;
  return quotations.filter((q) =>
    (q.title + " " + q.tag + " " + q.intro + " " + q.summary)
      .toLowerCase()
      .includes(kw)
  );
});
</script>

<template>
  <div v-if="current" class="quo-detail">
    <button class="back-btn" type="button" @click="back">← 返回语录目录</button>

    <article class="quo-article">
      <header class="quo-head">
        <span class="quo-tag">{{ current.tag }}</span>
        <h2 class="quo-title">{{ current.title }}</h2>
        <p class="quo-intro">{{ current.intro }}</p>
      </header>

      <section v-for="(s, si) in current.sections" :key="si" class="quo-sec">
        <h3 class="quo-sec-head">{{ s.heading }}</h3>
        <figure v-for="(it, ii) in s.items" :key="ii" class="quo-fig">
          <blockquote class="quo-quote">{{ it.quote }}</blockquote>
        </figure>
      </section>

      <p class="quo-summary">{{ current.summary }}</p>
    </article>
  </div>

  <div v-else class="quo">
    <div class="list-head">
      <span class="label">Quotations · 语录</span>
      <span class="count">{{ filtered.length }} 篇</span>
    </div>

    <p class="vp-note">
      体系化的言论整理。把直播间里那些零散却能成体系的话，按主题收拢成一篇篇小文章，忠于原文、保留口语与语言特点——若比之古籍，犹孔子弟子辑其言而成《论语》。
    </p>

    <p v-if="keyword && filtered.length === 0" class="search-empty">
      未找到与“{{ keyword }}”匹配的语录
    </p>

    <ul class="quo-grid">
      <li v-for="q in filtered" :key="q.id">
        <button class="quo-card" type="button" @click="open(q.id)">
          <span class="quo-card-no">{{ String(q.id).padStart(2, "0") }}</span>
          <span class="quo-card-tag">{{ q.tag }}</span>
          <span class="quo-card-title">{{ q.title }}</span>
          <span class="quo-card-intro">{{ q.intro }}</span>
          <span class="quo-card-more">阅读全文 →</span>
        </button>
      </li>
    </ul>
  </div>
</template>
