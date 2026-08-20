<script setup>
defineProps({
  meta: { type: Object, required: true },
});
</script>

<template>
  <header class="site-head">
    <h1>{{ meta.title }}<span class="dot">。</span></h1>
    <p class="sub">{{ meta.subtitle }}</p>
    <p class="desc">{{ meta.description }}</p>
  </header>
</template>

<style scoped>
.dot { color: var(--fg-faint); }
</style>
