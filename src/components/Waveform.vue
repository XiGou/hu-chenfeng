<script setup>
// 音频波形播放器（零第三方依赖，Apple Podcasts 风格）
//
// 通过 Web Audio API 解码音频得到各时间片峰值，绘制柱状波形；
// 已播放部分用强调色着色，并带一条可拖动/点击的游标（scrubber）。
// 支持：
//   · 播放/暂停
//   · 点击波形跳转
//   · 按住拖动游标实时预览并跳转
//   · 悬停预览游标位置
// 底层仍用原生 <audio> 驱动播放。
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";

const props = defineProps({ src: { type: String, required: true } });

const audioEl = ref(null);
const canvasEl = ref(null);
const playing = ref(false);
const duration = ref(0);
const current = ref(0);
const loaded = ref(false);
const error = ref(false);

// 交互状态：-1 表示无；0~1 表示进度比例
const dragFrac = ref(-1); // 拖动中（按下鼠标）
const hover = ref(-1);    // 悬停预览

let peaks = [];          // 各柱峰值（0~1）
let decoding = false;    // 防止重复并发解码
let ac = null;           // 用于 decodeAudioData 的 AudioContext
let cw = 0;              // 画布 CSS 像素宽
let ch = 0;              // 画布 CSS 像素高
let dpr = 1;
let raf = 0;
let ro = null;

const COL = {
  played: "#f0502f",     // 已播放强调色（暖橙，呼应播客质感）
  unplayed: "#e4e4e4",   // 未播放淡灰
  head: "#1a1a1a",       // 游标/正文深色
  guide: "rgba(26,26,26,0.18)",
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function fmt(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 显示时间：拖动时实时显示目标时间，否则显示当前进度
const shownTime = computed(() => {
  if (dragFrac.value >= 0) return fmt(dragFrac.value * duration.value);
  return fmt(current.value);
});

function ratioFromEvent(ev) {
  const canvas = canvasEl.value;
  if (!canvas) return 0;
  const rect = canvas.getBoundingClientRect();
  return clamp01((ev.clientX - rect.left) / rect.width);
}

// 解码音频、抽取峰值
async function computePeaks() {
  if (!props.src || decoding) return;
  decoding = true;
  try {
    const res = await fetch(props.src);
    if (!res.ok) throw new Error("audio fetch failed");
    const buf = await res.arrayBuffer();
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuf = await ac.decodeAudioData(buf);
    const ch0 = audioBuf.getChannelData(0);
    const total = ch0.length;
    const bars = Math.max(32, Math.floor(cw * dpr / 6)); // 柱宽约 6px 含间隙
    peaks = [];
    const step = Math.max(1, Math.floor(total / bars));
    for (let b = 0; b < bars; b++) {
      const start = b * step;
      let peak = 0;
      for (let k = start; k < start + step && k < total; k++) {
        const v = Math.abs(ch0[k]);
        if (v > peak) peak = v;
      }
      peaks.push(Math.min(1, peak * 1.6));
    }
    loaded.value = true;
    error.value = false;
    draw();
  } catch (e) {
    error.value = true;
    console.warn("waveform decode failed:", e);
  } finally {
    decoding = false;
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
  }
}

// 根据进度绘制波形（淡色为未播放、强调色为已播放）与游标
function draw() {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const w = cw * dpr;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const pad = 5 * dpr;
  const bandTop = pad;
  const bandH = h - pad * 2;
  const midY = bandTop + bandH / 2;

  const pFrac = duration.value > 0 ? clamp01(current.value / duration.value) : 0;
  // 拖动中预览：已播放区域跟着手指走；否则按真实进度
  const fillFrac = dragFrac.value >= 0 ? dragFrac.value : pFrac;
  // 游标位置：拖动中跟手指，其次悬停预览，再回落到真实进度
  const headFrac =
    dragFrac.value >= 0
      ? dragFrac.value
      : hover.value >= 0
        ? hover.value
        : pFrac;

  if (peaks.length) {
    const gap = 1 * dpr;
    const bw = (w - gap * (peaks.length - 1)) / peaks.length;
    const n = peaks.length;
    for (let i = 0; i < n; i++) {
      const barH = Math.max(1 * dpr, peaks[i] * bandH);
      const x = i * (bw + gap);
      const y = midY - barH / 2;
      const isPlayed = fillFrac >= i / n;
      ctx.fillStyle = isPlayed ? COL.played : COL.unplayed;
      roundRectPath(ctx, x, y, bw, barH, bw / 2);
      ctx.fill();
    }
  } else {
    // 未解码出波形时画一条基线占位
    ctx.fillStyle = COL.unplayed;
    ctx.fillRect(0, midY - 1, w, 2 * dpr);
  }

  // 游标线 + 圆点手柄
  if (duration.value > 0 || loaded.value) {
    const hx = headFrac * w;
    const lineW = Math.max(1.5, 2 * dpr);
    // 手柄所在高度：置于波形中部偏上，便于观察
    const knobY = bandTop + bandH * 0.42;
    const knobR = 6 * dpr;

    ctx.fillStyle = COL.guide;
    ctx.fillRect(hx - lineW / 2, bandTop, lineW, bandH);
    ctx.fillStyle = COL.head;
    ctx.beginPath();
    ctx.arc(hx, knobY, knobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(hx, knobY, knobR - 2 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function resize() {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  cw = rect.width;
  ch = rect.height || 60;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cw * dpr);
  canvas.height = Math.round(ch * dpr);
  if (!peaks.length && props.src && !loaded.value) computePeaks();
  else draw();
}

function toggle() {
  const a = audioEl.value;
  if (!a) return;
  if (a.paused) a.play();
  else a.pause();
}

function seekTo(frac) {
  const a = audioEl.value;
  if (!a || !duration.value) return;
  a.currentTime = frac * duration.value;
  current.value = a.currentTime;
  draw();
}

// ---- 指针交互：点击 + 拖动 ----
function onPointerDown(ev) {
  const a = audioEl.value;
  if (!a || !duration.value) return;
  ev.preventDefault();
  canvasEl.value.setPointerCapture?.(ev.pointerId);
  dragFrac.value = ratioFromEvent(ev);
  seekTo(dragFrac.value);
  draw();
}
function onPointerMove(ev) {
  const f = ratioFromEvent(ev);
  if (dragFrac.value >= 0) {
    dragFrac.value = f;
    const a = audioEl.value;
    if (a && duration.value) {
      a.currentTime = f * duration.value;
      current.value = a.currentTime;
    }
    draw();
  } else {
    // 悬停预览游标
    hover.value = f;
    if (!playing.value) draw();
  }
}
function onPointerUp(ev) {
  if (dragFrac.value < 0) return;
  // 松手：以最终位置跳转
  const f = dragFrac.value;
  dragFrac.value = -1;
  hover.value = -1;
  const a = audioEl.value;
  if (a && duration.value) {
    a.currentTime = f * duration.value;
    current.value = a.currentTime;
  }
  draw();
}
function onPointerLeave() {
  hover.value = -1;
  if (dragFrac.value < 0 && !playing.value) draw();
}

function onLoaded() {
  duration.value = audioEl.value?.duration || 0;
  if (!peaks.length && props.src) computePeaks();
}
function onPlay() {
  playing.value = true;
  dragFrac.value = -1;
  loop();
}
function onPause() {
  playing.value = false;
  cancelAnimationFrame(raf);
  draw();
}
function onEnded() {
  playing.value = false;
  current.value = 0;
  cancelAnimationFrame(raf);
  draw();
}

function loop() {
  const a = audioEl.value;
  if (a) {
    current.value = a.currentTime || 0;
    draw();
  }
  raf = requestAnimationFrame(loop);
}

watch(
  () => props.src,
  () => {
    peaks = [];
    decoding = false;
    loaded.value = false;
    error.value = false;
    current.value = 0;
    duration.value = 0;
    dragFrac.value = -1;
    hover.value = -1;
    computePeaks();
  }
);

onMounted(() => {
  resize();
  ro = new ResizeObserver(() => {
    if (!playing.value) resize();
  });
  if (canvasEl.value) ro.observe(canvasEl.value.parentElement);
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
      :title="playing ? '暂停' : '播放'"
      @click="toggle"
    >
      <svg v-if="!playing" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
      </svg>
      <svg v-else viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
      </svg>
    </button>

    <div class="wave-body">
      <div class="wave-canvas-wrap">
        <canvas
          ref="canvasEl"
          class="wave-canvas"
          :class="{ active: loaded }"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @pointerleave="onPointerLeave"
        ></canvas>
      </div>
      <div class="wave-bar" aria-hidden="true">
        <span class="wave-time">{{ shownTime }}</span>
        <span class="wave-status">
          <span v-if="!loaded && !error">读取波形…</span>
          <span v-else-if="error">无法读取音频（仍可点播放试听）</span>
          <span v-else>{{ fmt(duration) }}</span>
        </span>
      </div>
    </div>

    <!-- 实际播放器：默认隐藏，交由波形 UI 驱动 -->
    <audio
      ref="audioEl"
      :src="props.src"
      preload="metadata"
      @loadedmetadata="onLoaded"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    ></audio>
  </div>
</template>

<style scoped>
.waveform {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.05rem 1.15rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.015);
  user-select: none;
}
.wave-btn {
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  background: #1a1a1a;
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.1s ease;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
}
.wave-btn:hover { background: #000; transform: scale(1.04); }
.wave-btn svg { width: 18px; height: 18px; }

.wave-body { flex: 1; min-width: 0; }
.wave-canvas-wrap {
  position: relative;
  height: 60px;
  touch-action: none;
}
.wave-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: pointer;
  opacity: 0.45;
  transition: opacity 0.25s ease;
}
.wave-canvas.active { opacity: 1; }

.wave-bar {
  display: flex;
  justify-content: space-between;
  margin-top: 0.2rem;
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--fg-faint);
}
.wave-time { color: var(--fg-soft); }
.wave-status { font-style: italic; opacity: 0.9; }
</style>
