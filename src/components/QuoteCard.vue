<script setup>
import { ref, onMounted } from "vue";

const props = defineProps({
  quote: { type: Object, required: true },
});

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
  <article class="quote-card" :data-id="quote.id">
    <span class="quote-no">No.{{ String(quote.id).padStart(3, "0") }}</span>

    <div class="quote-meta">
      <span class="cat">{{ quote.category || "未分类" }}</span>
      <time v-if="quote.date">{{ fmtDate(quote.date) }}</time>
    </div>

    <blockquote class="quote-text">{{ quote.text }}</blockquote>

    <div v-if="quote.tags?.length" class="tags">
      <span v-for="t in quote.tags" :key="t" class="tag">#{{ t }}</span>
    </div>

    <div v-if="quote.audio || quote.video || quote.links?.length" class="media">
      <audio
        v-if="quote.audio"
        controls
        preload="none"
        :src="quote.audio"
      ></audio>

      <div
        v-if="quote.video"
        ref="videoEl"
        class="media-video-wrap"
      >
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
  </article>
</template>
