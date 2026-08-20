<script setup>
defineProps({
  meta: { type: Object, required: true },
  keyword: { type: String, default: "" },
  onHome: { type: Function, default: null },
});

const emit = defineEmits(["update:keyword"]);

function onSearch(e) {
  emit("update:keyword", e.target.value);
}
</script>

<template>
  <header class="masthead">
    <button class="cover" type="button" @click="onHome && onHome()" aria-label="返回目录">
      <span class="seal" aria-hidden="true">晨</span>
      <h1 class="title" id="site-title">
        {{ meta.title }}<span class="accent">。</span>
      </h1>
      <p class="subtitle">{{ meta.subtitle }}</p>
      <p class="lede">{{ meta.description }}</p>
    </button>

    <div class="search-box" role="search">
      <label class="sr-only" for="search">检索语录</label>
      <input
        id="search"
        type="search"
        :value="keyword"
        placeholder="检索语录 · 分类 · 标签…"
        autocomplete="off"
        @input="onSearch"
      />
      <span class="search-glyph" aria-hidden="true">✻</span>
    </div>
  </header>
</template>

<style scoped>
.cover {
  display: block;
  width: 100%;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: center;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
