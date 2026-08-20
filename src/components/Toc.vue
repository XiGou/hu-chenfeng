<script setup>
defineProps({
  categories: { type: Array, required: true },
  total: { type: Number, required: true },
  activeTag: { type: String, default: "" },
  activeCategory: { type: String, default: "" },
  allTags: { type: Array, default: () => [] },
  keyword: { type: String, default: "" },
});

const emit = defineEmits(["open", "tag", "category", "clear"]);

// 取词条在目录行中展示的摘要
function excerpt(text, len = 46) {
  const t = String(text || "");
  return t.length > len ? t.slice(0, len) + "…" : t;
}
</script>

<template>
  <div class="toc">
    <!-- 章前导读 / 检索状态 -->
    <div class="toc-toolbar">
      <span class="count">
        <template v-if="activeTag">「{{ activeTag }}」</template>
        <template v-else-if="activeCategory">「{{ activeCategory }}」</template>
        共 <span class="num">{{ total }}</span> 篇
      </span>
      <button v-if="activeTag || activeCategory || keyword" class="ghost-btn" type="button" @click="emit('clear')">
        ✕ 清除筛选
      </button>
    </div>

    <!-- 标签总目（书的后附索引） -->
    <nav v-if="allTags.length && !activeTag" class="tag-index" aria-label="标签索引">
      <span class="tag-index-title">索引</span>
      <button
        v-for="t in allTags"
        :key="t"
        class="tag-link"
        type="button"
        @click="emit('tag', t)"
      >
        #{{ t }}
      </button>
    </nav>

    <!-- 章节 · 目录 -->
    <section
      v-for="[cat, items] in categories"
      :key="cat"
      class="chapter"
    >
      <h2 class="chapter-title">
        <button
          class="chapter-head"
          type="button"
          @click="activeCategory === cat ? emit('clear') : emit('category', cat)"
          :title="activeCategory === cat ? '收起' : '仅看此章'"
        >
          {{ cat }}
          <span class="chapter-count">{{ items.length }}</span>
        </button>
      </h2>

      <ol class="entry-list">
        <li v-for="q in items" :key="q.id" class="entry-item">
          <button class="entry-row" type="button" @click="emit('open', q.id)">
            <span class="entry-no">No.{{ String(q.id).padStart(3, "0") }}</span>
            <span class="entry-body">
              <span class="entry-text">{{ excerpt(q.text) }}</span>
              <span v-if="q.tags?.length" class="entry-tags">
                <span v-for="t in q.tags" :key="t" class="mini-tag">#{{ t }}</span>
              </span>
            </span>
            <span class="entry-go" aria-hidden="true">→</span>
          </button>
        </li>
      </ol>
    </section>

    <p v-if="!total" class="empty">未检索到相关语录，试试其他关键词或清除筛选。</p>
  </div>
</template>

<style scoped>
/* —— 章前导读 —— */
.toc-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.5rem 0 1.2rem;
  padding-bottom: 1rem;
  border-bottom: 1px dashed var(--line);
}

.count { font-size: 0.92rem; color: var(--ink-soft); letter-spacing: 0.04em; }
.count .num { color: var(--vermillion); font-weight: 700; font-family: var(--font-kai); font-size: 1.15rem; }

.ghost-btn {
  font-family: var(--font-song);
  font-size: 0.86rem;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.4rem 0.95rem;
  cursor: pointer;
  transition: all 0.25s var(--ease);
}
.ghost-btn:hover { color: var(--vermillion); border-color: var(--vermillion); background: rgba(166,48,38,0.06); }

/* —— 标签索引（书末索引 / 双链接入口） —— */
.tag-index {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 1.8rem;
  padding: 0.9rem 1.1rem;
  background: rgba(43, 38, 32, 0.04);
  border: 1px solid var(--line);
  border-radius: 10px;
}
.tag-index-title {
  font-size: 0.8rem;
  color: var(--ink-soft);
  letter-spacing: 0.12em;
  margin-right: 0.3rem;
}
.tag-link {
  font-family: var(--font-song);
  font-size: 0.82rem;
  color: var(--ink);
  background: rgba(255,255,255,0.55);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.22rem 0.7rem;
  cursor: pointer;
  transition: all 0.25s var(--ease);
}
.tag-link:hover { color: var(--vermillion); border-color: var(--vermillion); background: rgba(166,48,38,0.06); }

/* —— 章节 —— */
.chapter { margin-bottom: 2.2rem; }

.chapter-title { margin: 0 0 0.7rem; }

.chapter-head {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-kai);
  font-size: 1.25rem;
  color: var(--ink);
  background: none;
  border: none;
  border-left: 4px solid var(--vermillion);
  padding-left: 0.7rem;
  cursor: pointer;
  letter-spacing: 0.08em;
  transition: color 0.25s var(--ease);
}
.chapter-head:hover { color: var(--vermillion); }
.chapter-count {
  font-size: 0.8rem;
  color: var(--ink-soft);
  background: rgba(43,38,32,0.06);
  border-radius: 999px;
  padding: 0.05rem 0.55rem;
}

/* —— 目录词条行 —— */
.entry-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }

.entry-item { margin: 0; }

.entry-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  text-align: left;
  font-family: var(--font-song);
  background: rgba(255,255,255,0.42);
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 0.65rem 1rem;
  cursor: pointer;
  transition: all 0.25s var(--ease);
}
.entry-row:hover {
  transform: translateX(4px);
  background: rgba(255,255,255,0.72);
  border-color: rgba(166,48,38,0.4);
}

.entry-no {
  flex: 0 0 auto;
  font-family: var(--font-kai);
  font-size: 0.82rem;
  color: var(--vermillion);
  letter-spacing: 0.04em;
  border: 1px solid rgba(166,48,38,0.35);
  border-radius: 999px;
  padding: 0.08rem 0.55rem;
  background: var(--paper);
}

.entry-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 0.18rem; }
.entry-text { font-size: 0.95rem; color: var(--ink); line-height: 1.6; }
.entry-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.mini-tag { font-size: 0.72rem; color: var(--ink-soft); }

.entry-go { flex: 0 0 auto; color: var(--ink-soft); opacity: 0.5; transition: all 0.25s var(--ease); }
.entry-row:hover .entry-go { opacity: 1; color: var(--vermillion); transform: translateX(3px); }

.empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--ink-soft);
  font-size: 1rem;
}

@media (max-width: 560px) {
  .entry-text { font-size: 0.9rem; }
}
</style>
