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

// 列表仅突出展示「标题」；无标题时回退为正文（兼容历史数据）
// 有标题时附上正文首段的简短预览，正文完整内容点进去在详情页阅读
function titleOf(q) {
  return q.title || q.text;
}
function excerptOf(q) {
  if (!q.title) return ""; // 无标题时正文即展示，无需再预览
  return String(q.text || "").replace(/\s+/g, " ").slice(0, 60);
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

    <p class="vp-note">
      收集各种二创与传播度广的音频、文字与视频，可配上 BGM 当作 podcast 来听——若比之古籍，犹《诗经》之风雅颂，听寻常人讲寻常事。
    </p>

    <p v-if="keyword && items.length === 0" class="search-empty">
      未找到与“{{ keyword }}”匹配的语录
    </p>

    <p v-else-if="items.length === 0" class="list-empty">
      暂无选读内容 —— 可通过仓库中的「提交新选读」Issue 模板添加。
    </p>

    <ul v-else class="item-list">
      <li v-for="q in items" :key="q.id" class="item">
        <button class="item-btn" type="button" @click="emit('open', q.id)">
          <span class="item-meta">
            <time>{{ fmtDate(q.date) }}</time>
            <span class="item-theme">{{ q.theme }}</span>
          </span>
          <span class="item-title">{{ titleOf(q) }}</span>
          <span v-if="excerptOf(q)" class="item-excerpt">{{ excerptOf(q) }}…</span>
        </button>
      </li>
    </ul>
  </div>
</template>
