<script setup>
/**
 * EssenceDetail — 单条「选读」的详情页内容。
 *
 * 取代旧 gen-share-pages.mjs 手工拼 HTML 的「详情页」，改由 Vue 组件统一渲染：
 * 品牌返回链接 / 日期·主题标签 / 标题 / 编者批注（多行按原文换行）/ 展厅预览图 /
 * 波形音频播放器 / Markdown 正文 / 外链视频·关联链接 / 出处 / 分享操作条。
 *
 * props：
 *   item     解析后的选读对象（含 id/title/date/theme/note/audio/video/links/text）
 *   relRoot  本详情页 → 站点资源根 dist/ 的相对路径。详情页位于「选读/」子目录下，
 *            故恒为 "../"。用于构造图片/音频/返回链接等页面相对地址。
 *
 * 组件既参与客户端 hydration，也参与构建期 SSR，内容渲染必须纯函数化、SSR 友好
 * （不在 setup/模板顶层访问 window/location）。展厅预览图由 id 对固定 gallery
 * 集合做确定性挑选，SSR 与客户端结果一致。
 */
import { computed } from "vue";
import { splitThemes } from "../data/lib/tags.js";
import { renderMarkdown } from "../data/lib/md-render.js";
import WaveAudio from "./WaveAudio.vue";
import ShareBar from "./ShareBar.vue";

const props = defineProps({
  item: { type: Object, required: true },
  relRoot: { type: String, default: "../" },
});

const rel = computed(() => props.relRoot.replace(/\/?$/, "/"));

// ---------- 资源路径工具 ----------
function isExt(s) {
  return /^https?:\/\//.test(s || "");
}
function cleanSite(p) {
  return String(p || "")
    .replace(/^public\//, "")
    .replace(/^\.\/?/, "");
}
/** 页面相对地址（站内资源）；外链原样。用于 <img> / <audio> 实际加载。 */
function pageUrl(sitePath) {
  const c = cleanSite(sitePath);
  if (!c) return "";
  return isExt(c) ? c : rel.value + c;
}

// ---------- 展厅预览图：确定性挑选（SSR 与客户端一致） ----------
const GALLERY = (() => {
  const names = [];
  for (let i = 1; i <= 23; i++) names.push(`gallery/img${i}.png`);
  return names;
})();
function pickIdx(seed, len) {
  if (len <= 0) return -1;
  return (Math.imul(seed || 0, 2654435761) >>> 0) % len;
}
const previewImg = computed(() => {
  const gi = pickIdx(props.item.id || 0, GALLERY.length);
  return gi >= 0 ? pageUrl(GALLERY[gi]) : "";
});

// ---------- 展示字段 ----------
const displayTitle = computed(() => props.item.title || `选读 #${props.item.id}`);
const themes = computed(() => splitThemes(props.item.theme));
const dateLabel = computed(() => {
  const d = props.item.date;
  if (!d) return "";
  const p = String(d).split("-");
  return p.length === 3 ? `${p[0]} 年 ${Number(p[1])} 月 ${Number(p[2])} 日` : d;
});
const contentHtml = computed(() => {
  const html = renderMarkdown(props.item.text);
  return html || "<p>（本条暂无正文。）</p>";
});

const audioPageUrl = computed(() => pageUrl(props.item.audio));
const waveModuleRel = computed(() => rel.value + "vendor/wavesurfer.esm.js");

const note = computed(() => props.item.note || "");
const source = computed(() => props.item.source || "");
const video = computed(() => props.item.video || "");
const links = computed(() => (Array.isArray(props.item.links) ? props.item.links : []));

function firstChar(o) {
  const t = (o && o.type) || "";
  return t.slice(0, 1) || "↗";
}
</script>

<template>
  <article class="entry">
    <a class="brand" :href="rel + 'index.html'">户晨风 · 摘录</a>

    <div class="entry-meta">
      <time v-if="dateLabel">{{ dateLabel }}</time>
      <span v-if="themes.length" class="theme-list">
        <span v-for="(t, ti) in themes" :key="ti" class="theme">{{ t }}</span>
      </span>
    </div>

    <h1 class="entry-title">{{ displayTitle }}</h1>

    <div v-if="note" class="editor-note" role="note">
      <span class="editor-note-mark">编者注</span>
      <p>{{ note }}</p>
    </div>

    <figure v-if="previewImg" class="preview">
      <img :src="previewImg" :alt="displayTitle" loading="lazy" />
    </figure>

    <div v-if="audioPageUrl" class="entry-audio">
      <WaveAudio :src="audioPageUrl" :module-url="waveModuleRel" />
    </div>

    <div class="entry-text" v-html="contentHtml"></div>

    <div v-if="video || links.length" class="media">
      <div v-if="video" class="media-video-wrap">
        <iframe :src="video" :title="displayTitle" loading="lazy"
          allowfullscreen allow="encrypted-media; picture-in-picture"></iframe>
      </div>
      <div v-if="links.length" class="media-links">
        <a v-for="(l, li) in links.filter((x) => x && x.url)" :key="li"
          class="media-link" :href="l.url" target="_blank" rel="noopener noreferrer">
          <span>{{ firstChar(l) }}</span>{{ l.label || l.type || "链接" }}
        </a>
      </div>
    </div>

    <p v-if="source" class="source">出处：{{ source }}</p>

    <div class="share-bar" role="group" aria-label="分享">
      <ShareBar :title="displayTitle" />
      <span class="share-bar-note">分享用当前干净地址（无 .html 后缀），直接发推即可出卡片</span>
    </div>

    <a class="back-link" :href="rel + 'index.html'">← 返回全部选读</a>
  </article>
</template>
