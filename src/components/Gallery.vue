<script setup>
import { ref, computed } from "vue";
import { gallery } from "../data/gallery.js";

const props = defineProps({
  keyword: { type: String, default: "" },
});

const active = ref(null); // 当前放大的图

const filtered = computed(() => {
  const kw = props.keyword.trim().toLowerCase();
  if (!kw) return gallery;
  return gallery.filter((g) =>
    (g.title + " " + g.desc).toLowerCase().includes(kw)
  );
});

function open(id) {
  active.value = filtered.value.find((g) => g.id === id) || null;
}
function close() {
  active.value = null;
}
</script>

<template>
  <div class="gal">
    <div class="list-head">
      <span class="label">Gallery · 展厅</span>
      <span class="count">{{ filtered.length }} 幅</span>
    </div>

    <p class="vp-note">
      点击后展示户晨风先生常见的图像资料及其介绍。收录了互联网上流传甚广的经典图像——从消费主义合影到「苹果 vs 安卓」造梗，从赛博国葬到各绘画风格下的祝福动作——每一幅都标注了说明文字。
    </p>

    <p v-if="keyword && filtered.length === 0" class="search-empty">
      未找到与“{{ keyword }}”匹配的图像
    </p>

    <ul class="gal-grid">
      <li v-for="g in filtered" :key="g.id" class="gal-item">
        <button class="gal-card" type="button" @click="open(g.id)">
          <span class="gal-thumb">
            <img :src="g.image" :alt="g.title" loading="lazy" />
          </span>
          <span class="gal-body">
            <span class="gal-no">{{ String(g.id).padStart(2, "0") }}</span>
            <span class="gal-title">{{ g.title }}</span>
            <span class="gal-desc">{{ g.desc }}</span>
            <span class="gal-more">查看大图 →</span>
          </span>
        </button>
      </li>
    </ul>

    <!-- 大图灯箱 -->
    <transition name="about">
      <div v-if="active" class="gal-mask" @click.self="close">
        <div class="gal-panel" role="dialog" aria-modal="true" aria-label="图像查看">
          <header class="gal-head">
            <span class="gal-head-no">{{ String(active.id).padStart(2, "0") }} · {{ active.title }}</span>
            <button class="gal-close" type="button" aria-label="关闭" @click="close">✕</button>
          </header>
          <figure class="gal-view">
            <img :src="active.image" :alt="active.title" />
          </figure>
          <figcaption class="gal-caption">{{ active.desc }}</figcaption>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ---------- 网格 ---------- */
.gal-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.1rem;
}
.gal-item {
  min-width: 0;
}
.gal-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  text-align: left;
  background: none;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 0.8rem 0.8rem 1rem;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s ease;
}
.gal-card:hover { border-color: var(--fg-faint); }

.gal-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border-radius: 8px;
  background: #fafafa;
  margin-bottom: 0.8rem;
}
.gal-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.gal-body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0 0.3rem;
}
.gal-no {
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--fg-faint);
}
.gal-title {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fg);
}
.gal-desc {
  font-size: 0.88rem;
  color: var(--fg-soft);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.gal-more {
  margin-top: 0.4rem;
  font-size: 0.82rem;
  color: var(--fg-faint);
}
.gal-card:hover .gal-more { color: var(--fg); }

/* ---------- 大图灯箱 ---------- */
.gal-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.gal-panel {
  width: 100%;
  max-width: 720px;
  max-height: calc(100vh - 48px);
  background: var(--bg);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  padding: 1.2rem 1.4rem 1.4rem;
  overflow-y: auto;
}
.gal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 0.9rem;
  border-bottom: 1px solid var(--line);
  margin-bottom: 1rem;
}
.gal-head-no {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 600;
}
.gal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg-faint);
  font-size: 1.1rem;
  line-height: 1;
  padding: 0.3rem;
}
.gal-close:hover { color: var(--fg); }
.gal-view {
  margin: 0;
  display: flex;
  justify-content: center;
}
.gal-view img {
  max-width: 100%;
  max-height: 64vh;
  border-radius: 8px;
  display: block;
}
.gal-caption {
  margin-top: 1rem;
  font-size: 0.92rem;
  color: var(--fg-soft);
  line-height: 1.8;
}

/* 过渡 */
.about-enter-active, .about-leave-active { transition: opacity 0.2s ease; }
.about-enter-from, .about-leave-to { opacity: 0; }

@media (max-width: 520px) {
  .gal-grid { grid-template-columns: 1fr; }
}
</style>
