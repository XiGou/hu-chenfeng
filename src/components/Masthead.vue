<script setup>
defineProps({
  meta: { type: Object, required: true },
  keyword: { type: String, default: "" },
  typewriter: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false },
});

const emit = defineEmits(["update:keyword", "update:typewriter"]);

function onSearch(e) {
  emit("update:keyword", e.target.value);
}
</script>

<template>
  <header class="masthead">
    <div class="seal" aria-hidden="true">晨</div>
    <h1 class="title" id="site-title">
      {{ meta.title }}<span class="accent">。</span>
    </h1>
    <p class="subtitle">{{ meta.subtitle }}</p>
    <p class="lede">{{ meta.description }}</p>

    <div class="search-box" role="search">
      <label class="sr-only" for="search">检索语录</label>
      <input
        id="search"
        type="search"
        :value="keyword"
        placeholder="检索语录关键词…"
        autocomplete="off"
        @input="onSearch"
      />
      <span class="search-glyph" aria-hidden="true">✻</span>
    </div>
  </header>
</template>

<style scoped>
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
