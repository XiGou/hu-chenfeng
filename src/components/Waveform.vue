<script setup>
// 音频波形可视化组件（无第三方依赖）
//
// 通过 Web Audio API 解码音频得到各时间片的峰值，绘制成柱状波形；
// 支持点击跳转、播放/暂停与进度高亮，配合 <audio> 原生播放。
import { ref, onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps({
  src: { type: String, required: true },
});

const audioEl = ref(null);
const canvasEl = ref(null);
const playing = ref(false);
const duration = ref(0);
const current = ref(0);
const loaded = ref(false);
const error = ref(false);

let peaks = [];          // 各柱峰值（0~1）
let fetching = false;    // 防止重复并发解码
let ac = null;           // 用于 decodeAudioData 的 AudioContext
let cw = 0;              // 实际绘图宽度（CSS 像素）
let dpr = 1;
let raf = 0;

function fmt(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 解码音频、抽取峰值
async function computePeaks() {
  if (fetching || !props.src) return;
  fetching = true;
  error.value = false;
  loaded.value = false;
  try {
    const res = await fetch(props.src);
    if (!res.ok) throw new Error("audio fetch failed");
    const buf = await res.arrayBuffer();
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await ac.decodeAudioData(buf);
    const ch = audioBuf.getChannelData(0);
    const total = ch.length;
    const bars = Math.max(32, Math.floor(cw * dpr / 6)); // 柱宽约 6px，含间隙
    peaks = [];
    const step = Math.max(1, Math.floor(total / bars));
    for (let b = 0; b < bars; b++) {
      const start = b * step;
      let peak = 0;
      for (let k = start; k < start + step && k < total; k++) {
        const v = Math.abs(ch[k]);
        if (v > peak) peak = v;
      }
      // 轻微归一化提升观感，并保留少量静音
      peaks.push(Math.min(1, peak * 1.6));
    }
    loaded.value = true;
    draw();
  } catch (e) {
    error.value = true;
    console.warn("waveform decode failed:", e);
  } finally {
    fetching = false;
  }
}

// 根据当前进度绘制波形（未播放部分淡色、已播放部分强调色）
function draw() {
  const canvas = canvasEl.value;
  if (!canvas || !peaks.length) return;
  const w = cw * dpr;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const gap = 1 * dpr;
  const bw = (w - gap * (peaks.length - 1)) / peaks.length;
  const midY = h / 2;
  const prog = duration > 0 ? current.value / duration : 0;
  const n = peaks.length;

  for (let i = 0; i < n; i++) {
    const barH = Math.max(1 * dpr, peaks[i] * (h - 8 * dpr));
    const x = i * (bw + gap);
    const y = midY - barH / 2;
    const isPlayed = prog >= i / n;
    ctx.fillStyle = isPlayed ? "#8a5a2b" : "rgba(0,0,0,0.18)";
    ctx.beginPath();
    // 圆头小柱（roundRect 为渐进能力，做兼容回退）
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, bw, barH, bw / 2);
    else ctx.rect(x, y, bw, barH);
    ctx.fill();
  }
}

function resize() {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  cw = rect.width;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round((rect.height || 56) * dpr);
  // 若已解码则重新按新宽度抽柱重绘；未解码则重算触发
  if (!peaks.length && props.src && !fetching) computePeaks();
  else draw();
}

function toggle() {
  const a = audioEl.value;
  if (!a) return;
  if (a.paused) a.play();
  else a.pause();
}

function seek(ev) {
  const a = audioEl.value;
  const canvas = canvasEl.value;
  if (!a || !canvas || !duration.value) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = (ev.clientX - rect.left) / rect.width;
  a.currentTime = ratio * duration.value;
}

function onLoaded() {
  duration.value = audioEl.value?.duration || 0;
  if (!peaks.length && props.src) computePeaks();
}
function onTime() {
  current.value = audioEl.value?.currentTime || 0;
}
function onPlay() { playing.value = true; loop(); }
function onPause() { playing.value = false; cancelAnimationFrame(raf); }

function loop() {
  draw();
  raf = requestAnimationFrame(loop);
}

watch(() => props.src, () => {
  peaks = [];
  loaded.value = false;
  current.value = 0;
  duration.value = 0;
  computePeaks();
});

let ro;
onMounted(() => {
  resize();
  ro = new ResizeObserver(() => { if (!playing.value) resize(); });
  ro.observe(canvasEl.value.parentElement);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  if (ro) ro.disconnect();
  if (ac) ac.close && ac.close();
});
</script>

<template>
  <div class="waveform" :class="{ loaded, error }">
    <button
      class="wave-btn"
      type="button"
      :aria-label="playing ? '暂停' : '播放'"
      @click="toggle"
    >{{ playing ? "❚❚" : "▶" }}</button>

    <div class="wave-body">
      <canvas
        ref="canvasEl"
        class="wave-canvas"
        :class="{ active: loaded }"
        @click="seek"
      ></canvas>
      <div class="wave-bar" aria-hidden="true">
        <span>{{ fmt(current) }}</span>
        <span class="wave-loading" v-if="!loaded && !error">读取波形…</span>
        <span class="wave-error" v-else-if="error">无法读取音频</span>
        <span v-else>{{ fmt(duration) }}</span>
      </div>
    </div>

    <!-- 实际播放器：默认隐藏，交由波形 UI 驱动 -->
    <audio
      ref="audioEl"
      :src="props.src"
      preload="metadata"
      @loadedmetadata="onLoaded"
      @timeupdate="onTime"
      @play="onPlay"
      @pause="onPause"
      @ended="onPause"
    ></audio>
  </div>
</template>
