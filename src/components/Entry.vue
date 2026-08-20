<script setup>
import { ref, onMounted, watch } from "vue";

const props = defineProps({
  quote: { type: Object, required: true },
});
const emit = defineEmits(["back", "search"]);

const videoLoaded = ref(false);
const videoEl = ref(null);

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
      <button
        v-if="quote.theme"
        class="theme"
        type="button"
        :title="'搜索所有「' + quote.theme + '」语录'"
        @click="emit('search', quote.theme)"
      >{{ quote.theme }}</button>
    </div>

    <blockquote>{{ quote.text }}</blockquote>

    <div v-if="quote.audio || quote.video || quote.links?.length" class="media">
      <audio v-if="quote.audio" controls preload="none" :src="quote.audio"></audio>

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
