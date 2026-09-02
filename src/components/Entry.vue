<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { renderMarkdown } from "../data/lib/md-render.js";
import { splitThemes } from "../data/lib/tags.js";
import Waveform from "./Waveform.vue";

const props = defineProps({
  quote: { type: Object, required: true },
});
const emit = defineEmits(["back", "search"]);

const videoLoaded = ref(false);
const videoEl = ref(null);

// theme 字段可含多个标签（用空格/顿号/、/ 分隔），逐一渲染为可点击胶囊
const themes = computed(() => splitThemes(props.quote.theme));

// 正文以 Markdown 渲染，保留换行与段落格式（而非纯文本压成一块）
const textHtml = computed(() => renderMarkdown(props.quote.text));

function fmtDate(d) {
  if (!d) return "";
  const p = String(d).split("-");
  return p.length === 3 ? `${p[0]} 年 ${Number(p[1])} 月 ${Number(p[2])} 日` : d;
}

function linkIcon(type) {
  if (type === "youtube") return "▶";
  if (type === "spotify") return "♫";
  return "↗";
}

watch(
  () => props.quote.id,
  () => {
    videoLoaded.value = false;
  }
);

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
  <button class="back-btn" type="button" @click="emit('back')">← 返回全部</button>

  <article class="entry">
    <div class="entry-meta">
      <time>{{ fmtDate(quote.date) }}</time>
      <span v-if="themes.length" class="theme-list">
        <button
          v-for="(t, ti) in themes"
          :key="ti"
          class="theme"
          type="button"
          :title="'搜索所有「' + t + '」语录'"
          @click="emit('search', t)"
        >{{ t }}</button>
      </span>
    </div>

    <h2 v-if="quote.title" class="entry-title">{{ quote.title }}</h2>

    <!-- 音频置于正文之前，便于边听边读；带波形可视化 -->
    <Waveform v-if="quote.audio" class="entry-audio" :src="quote.audio" />

    <!-- 正文：Markdown 渲染，保留换行/段落/格式 -->
    <div class="entry-text" v-html="textHtml"></div>

    <div v-if="quote.video || quote.links?.length" class="media">
      <div v-if="quote.video" ref="videoEl" class="media-video-wrap">
        <iframe
          v-if="videoLoaded"
          :src="quote.video"
          :title="'视频 ' + quote.id"
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
          <span>{{ linkIcon(l.type) }}</span>
          {{ l.label || l.type }}
        </a>
      </div>
    </div>

    <p class="source">
      出处：<code>{{ quote.source }}</code>
      <template v-if="quote.source">
        <br />
        <a
          :href="'https://github.com/Olcmyk/HuChenFeng/blob/main/' + quote.source.replace('reference/hu-chenfeng/', '')"
          target="_blank"
          rel="noopener noreferrer"
        >在 HuChenFeng 仓库中查看完整上下文 ↗</a>
      </template>
    </p>
  </article>
</template>
