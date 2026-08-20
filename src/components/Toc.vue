<script setup>
defineProps({
  items: { type: Array, required: true },
  total: { type: Number, default: 0 },
  keyword: { type: String, default: "" },
});
const emit = defineEmits(["open", "update:keyword"]);

function fmtDate(d) {
  if (!d) return "";
  const p = String(d).split("-");
  return p.length === 3 ? `${p[0]} · ${p[1]} · ${p[2]}` : d;
}
</script>

<template>
  <div class="list">
    <div class="list-head">
      <span class="label">Essence · 选读</span>
      <span class="count">
        {{ keyword ? items.length + " / " + total : total }} 则
      </span>
    </div>

    <div class="search-box">
      <span class="search-icon" aria-hidden="true">⌕</span>
      <input
        class="search-input"
        type="search"
        :value="keyword"
        placeholder="搜索语录、主题或日期…"
        aria-label="搜索语录"
        @input="emit('update:keyword', $event.target.value)"
      />
      <button
        v-if="keyword"
        class="search-clear"
        type="button"
        aria-label="清空搜索"
        @click="emit('update:keyword', '')"
      >✕</button>
    </div>

    <p v-if="keyword && items.length === 0" class="search-empty">
      未找到与“{{ keyword }}”匹配的语录
    </p>

    <ul v-else class="item-list">
      <li v-for="q in items" :key="q.id" class="item">
        <button class="item-btn" type="button" @click="emit('open', q.id)">
          <span class="item-meta">
            <time>{{ fmtDate(q.date) }}</time>
            <span class="item-theme">{{ q.theme }}</span>
          </span>
          <span class="item-text">{{ q.text }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
