<script setup>
import { ref } from "vue";

// 各栏目定位介绍：极简，克制，与全站风格一致
const sections = [
  {
    key: "read",
    name: "选读",
    en: "Essence",
    metaphor: "若比《诗经》之「风」",
    body: "从 2023–2025 年的直播文字稿中手工摘取、传播度较广的片段，或音频、或文字、或视频，可配上 BGM 当作 podcast 来听。适合初见者随手点开，安静读一读，像《诗经》里「风」「雅」「颂」那样，听寻常人讲寻常事。",
  },
  {
    key: "viewpoints",
    name: "观点",
    en: "Viewpoints",
    metaphor: "若比《史记》之「列传」",
    body: "AI 通读全集后归纳出的总结性内容，简要说明户子的主要立场与一以贯之的底色——现实、购买力、就业与普通人的日子。只取其立场，不铺陈细枝末节，像《史记·户子列传》那样为「其人」立传。",
  },
  {
    key: "quotations",
    name: "语录",
    en: "Quotations",
    metaphor: "若比《论语》之「语录」",
    body: "把直播间里那些零散却成体系的话，按主题收拢成篇，忠于原文、保留口语，并标注可追溯出处。如同孔子弟子整理夫子之语而成《论语》，这里是把户晨风的话按主题辑录成文，供人逐篇细读。",
  },
];

const open = ref(false);

function toggle() {
  open.value = !open.value;
}
</script>

<template>
  <button class="about-link" type="button" @click="toggle">
    关于
  </button>

  <transition name="about">
    <div v-if="open" class="about-mask" @click.self="toggle">
      <div class="about-panel" role="dialog" aria-modal="true" aria-label="关于本网站">
        <header class="about-head">
          <h2>关于 · 本栏目</h2>
          <button class="about-close" type="button" aria-label="关闭" @click="toggle">✕</button>
        </header>

        <p class="about-lead">
          本站把户晨风的直播内容拆成三条线索，各司其职：
        </p>

        <ul class="about-list">
          <li v-for="s in sections" :key="s.key" class="about-item">
            <div class="about-item-head">
              <span class="about-name">{{ s.name }}</span>
              <span class="about-en">{{ s.en }}</span>
              <span class="about-meta">{{ s.metaphor }}</span>
            </div>
            <p class="about-body">{{ s.body }}</p>
          </li>
        </ul>

        <footer class="about-foot">
          <span>户晨风 · 摘录</span>
          <a
            href="https://github.com/Olcmyk/HuChenFeng"
            target="_blank"
            rel="noopener noreferrer"
          >HuChenFeng 全集 ↗</a>
        </footer>
      </div>
    </div>
  </transition>
</template>

<style scoped>
/* ---------- 右上角入口 ---------- */
.about-link {
  position: fixed;
  top: 18px;
  right: 24px;
  z-index: 900;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--line);
  border-radius: 999px;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.82rem;
  color: var(--fg-soft);
  padding: 0.28rem 0.85rem;
  text-decoration: none;
  backdrop-filter: blur(4px);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  transition: color 0.2s ease, border-color 0.2s ease;
}
.about-link:hover {
  color: var(--fg);
  border-color: var(--fg-faint);
}

/* ---------- 遮罩 ---------- */
.about-mask {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

/* ---------- 面板 ---------- */
.about-panel {
  width: 100%;
  max-width: 560px;
  background: var(--bg);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
  padding: 1.8rem 2rem;
  max-height: calc(100vh - 48px);
  overflow-y: auto;
}
.about-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1.1rem;
  border-bottom: 1px solid var(--line);
  margin-bottom: 1.2rem;
}
.about-head h2 {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 600;
}
.about-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg-faint);
  font-size: 1.05rem;
  line-height: 1;
  padding: 0.3rem;
}
.about-close:hover { color: var(--fg); }

.about-lead {
  font-size: 0.92rem;
  color: var(--fg-soft);
  margin-bottom: 1.4rem;
}

.about-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.about-item {
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.about-item-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.about-name {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 600;
}
.about-en {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-faint);
}
.about-meta {
  margin-left: auto;
  font-size: 0.8rem;
  color: var(--fg-soft);
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.05rem 0.6rem;
  white-space: nowrap;
}
.about-body {
  font-size: 0.92rem;
  color: var(--fg-soft);
  line-height: 1.85;
}

.about-foot {
  margin-top: 1.6rem;
  padding-top: 1rem;
  border-top: 1px solid var(--line);
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.6rem;
  font-size: 0.8rem;
  color: var(--fg-faint);
}
.about-foot a { color: var(--fg-soft); text-decoration: none; }
.about-foot a:hover { color: var(--fg); text-decoration: underline; }

/* 过渡 */
.about-enter-active, .about-leave-active { transition: opacity 0.2s ease; }
.about-enter-from, .about-leave-to { opacity: 0; }

@media (max-width: 520px) {
  .about-link {
    top: 14px;
    right: 16px;
    font-size: 0.78rem;
    padding: 0.22rem 0.7rem;
  }
  .about-panel { padding: 1.4rem 1.2rem; }
}
</style>
