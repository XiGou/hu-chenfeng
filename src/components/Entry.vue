<script setup>
import { ref, onMounted, watch } from "vue";

const props = defineProps({
  quote: { type: Object, required: true },
  related: { type: Array, default: () => [] },
  prev: { type: Object, default: null },
  next: { type: Object, default: null },
});

const emit = defineEmits(["open", "back", "tag"]);

const videoLoaded = ref(false);
const videoEl = ref(null);

function fmtDate(d) {
  if (!d) return "";
  const parts = String(d).split("-");
  return parts.length === 3
    ? `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`
    : d;
}

function linkIcon(type) {
  if (type === "youtube") return "▶";
  if (type === "spotify") return "♫";
  return "↗";
}

// 切换词条时重置视频懒加载状态
watch(
  () => props.quote.id,
  () => {
    videoLoaded.value = false;
  }
);

// 视频懒加载：进入视口才真正加载 iframe
onMounted(() => {
  if (!props.quote.video || !videoEl.value) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) {
        videoLoaded.value = true;
        io.disconnect();
      }
    },
    { rootMargin: "300px" }
  );
  io.observe(videoEl.value);
});
</script>

<template>
  <article class="entry" :data-id="quote.id">
    <!-- 词条页眉：返回目录 -->
    <div class="entry-bar">
      <button class="back-btn" type="button" @click="emit('back')">
        ← 返回目录
      </button>
    </div>

    <!-- 词条题名 -->
    <header class="entry-head">
      <span class="entry-no">词条 No.{{ String(quote.id).padStart(3, "0") }}</span>
      <div class="entry-meta">
        <span class="cat">{{ quote.category || "未分类" }}</span>
        <time v-if="quote.date">{{ fmtDate(quote.date) }}</time>
      </div>
    </header>

    <!-- 正文 -->
    <blockquote class="entry-text">{{ quote.text }}</blockquote>

    <!-- 标签（可点击 → 双链接到标签索引） -->
    <div v-if="quote.tags?.length" class="entry-tags">
      <span class="lbl">标签</span>
      <button
        v-for="t in quote.tags"
        :key="t"
        class="tag-btn"
        type="button"
        @click="emit('tag', t)"
      >
        #{{ t }}
      </button>
    </div>

    <!-- 多媒体 -->
    <div v-if="quote.audio || quote.video || quote.links?.length" class="media">
      <audio v-if="quote.audio" controls preload="none" :src="quote.audio"></audio>

      <div v-if="quote.video" ref="videoEl" class="media-video-wrap">
        <iframe
          v-if="videoLoaded"
          :src="quote.video"
          title="视频"
          loading="lazy"
          allowfullscreen
          allow="encrypted-media; picture-in-picture"
        ></iframe>
      </div>

      <div v-if="quote.links?.length" class="media-links">
        <a
          v-for="(l, i) in quote.links"
          :key="i"
          class="media-link"
          :href="l.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="ext">{{ linkIcon(l.type) }}</span>
          {{ l.label || l.type }}
        </a>
      </div>
    </div>

    <!-- 双链接 · 相关词条（共享标签 → 双向互链） -->
    <section v-if="related.length" class="related">
      <h3 class="related-title">相关词条</h3>
      <p class="related-hint">与「{{ quote.category || "本篇" }}」通过共享标签互相关联，可双向翻阅。</p>
      <ul class="related-list">
        <li v-for="r in related" :key="r.id">
          <button class="related-link" type="button" @click="emit('open', r.id)">
            <span class="related-no">No.{{ String(r.id).padStart(3, "0") }}</span>
            <span class="related-text">{{ r.text }}</span>
          </button>
        </li>
      </ul>
    </section>

    <!-- 翻书：上一篇 / 下一篇 -->
    <nav class="pager" aria-label="翻页">
      <button
        v-if="prev"
        class="page-btn prev"
        type="button"
        @click="emit('open', prev.id)"
      >
        <span class="dir">← 上一篇</span>
        <span class="page-text">{{ prev.text }}</span>
      </button>
      <span v-else class="page-btn disabled" aria-hidden="true"></span>

      <button
        v-if="next"
        class="page-btn next"
        type="button"
        @click="emit('open', next.id)"
      >
        <span class="dir">下一篇 →</span>
        <span class="page-text">{{ next.text }}</span>
      </button>
      <span v-else class="page-btn disabled" aria-hidden="true"></span>
    </nav>
  </article>
</template>

<style scoped>
/* —— 词条页眉 —— */
.entry-bar {
  margin: 1.5rem 0 1rem;
}
.back-btn {
  font-family: var(--font-song);
  font-size: 0.88rem;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.4rem 1rem;
  cursor: pointer;
  transition: all 0.25s var(--ease);
}
.back-btn:hover { color: var(--vermillion); border-color: var(--vermillion); background: rgba(166,48,38,0.05); }

/* —— 词条题名 —— */
.entry {
  position: relative;
  background: rgba(255,255,255,0.42);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 1.8rem 1.9rem 1.7rem;
  box-shadow: var(--shadow-card);
  animation: card-in 0.5s var(--ease) both;
}

@keyframes card-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.entry-head { margin-bottom: 1.2rem; }

.entry-no {
  display: inline-block;
  font-family: var(--font-kai);
  font-size: 0.9rem;
  color: var(--vermillion);
  background: var(--paper);
  border: 1px solid rgba(166,48,38,0.35);
  border-radius: 999px;
  padding: 0.12rem 0.7rem;
  letter-spacing: 0.06em;
  margin-bottom: 0.7rem;
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.85rem;
  color: var(--ink-soft);
}
.cat {
  display: inline-block;
  font-size: 0.78rem;
  padding: 0.15rem 0.65rem;
  border-radius: 999px;
  background: var(--ink);
  color: var(--paper);
  letter-spacing: 0.1em;
}
time { opacity: 0.75; }

/* —— 正文 —— */
.entry-text {
  font-family: var(--font-song);
  font-size: 1.14rem;
  line-height: 2;
  color: var(--ink);
  border-left: 3px solid var(--vermillion);
  padding-left: 1.1rem;
  margin: 0 0 1.2rem;
}

/* —— 标签（可点击） —— */
.entry-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.6rem;
}
.entry-tags .lbl {
  font-size: 0.8rem;
  color: var(--ink-soft);
  margin-right: 0.2rem;
}
.tag-btn {
  font-family: var(--font-song);
  font-size: 0.8rem;
  color: var(--vermillion);
  background: rgba(166,48,38,0.07);
  border: 1px solid rgba(166,48,38,0.35);
  border-radius: 999px;
  padding: 0.2rem 0.7rem;
  cursor: pointer;
  transition: all 0.25s var(--ease);
}
.tag-btn:hover { background: rgba(166,48,38,0.15); transform: translateY(-1px); }

/* —— 多媒体 —— */
.media {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--line);
}
.media audio { width: 100%; height: 40px; }
.media-video-wrap {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  aspect-ratio: 16 / 9;
  background: #1a1713;
  border: 1px solid var(--line);
}
.media-video-wrap iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.media-links { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.media-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.86rem;
  color: var(--ink);
  text-decoration: none;
  padding: 0.35rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 999px;
  transition: all 0.25s var(--ease);
}
.media-link:hover { color: var(--vermillion); border-color: var(--vermillion); background: rgba(166,48,38,0.05); }
.media-link .ext { font-size: 0.72rem; color: var(--vermillion); }

/* —— 双链接 · 相关词条 —— */
.related {
  margin-top: 1.6rem;
  padding-top: 1.2rem;
  border-top: 1px dashed var(--line);
}
.related-title {
  font-family: var(--font-kai);
  font-size: 1.05rem;
  color: var(--vermillion);
  letter-spacing: 0.1em;
  margin-bottom: 0.3rem;
}
.related-hint {
  font-size: 0.8rem;
  color: var(--ink-soft);
  margin-bottom: 0.7rem;
}
.related-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.related-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  text-align: left;
  font-family: var(--font-song);
  font-size: 0.9rem;
  color: var(--ink);
  background: rgba(43,38,32,0.04);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: all 0.25s var(--ease);
}
.related-link:hover { background: rgba(166,48,38,0.07); border-color: rgba(166,48,38,0.4); transform: translateX(4px); }
.related-no { flex: 0 0 auto; font-family: var(--font-kai); font-size: 0.78rem; color: var(--vermillion); }

/* —— 翻书 —— */
.pager {
  display: flex;
  gap: 0.8rem;
  margin-top: 1.7rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--line);
}
.page-btn {
  flex: 1 1 0;
  min-width: 0;
  text-align: left;
  font-family: var(--font-song);
  background: rgba(255,255,255,0.55);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 0.7rem 1rem;
  cursor: pointer;
  transition: all 0.25s var(--ease);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.page-btn:hover { border-color: var(--vermillion); background: rgba(166,48,38,0.05); }
.page-btn .dir { font-size: 0.78rem; color: var(--ink-soft); letter-spacing: 0.05em; }
.page-btn .page-text {
  font-size: 0.88rem;
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-btn.next { text-align: right; align-items: flex-end; }
.page-btn.disabled { visibility: hidden; }

@media (max-width: 560px) {
  .entry { padding: 1.4rem 1.2rem 1.3rem; }
  .entry-text { font-size: 1.02rem; }
}
</style>
