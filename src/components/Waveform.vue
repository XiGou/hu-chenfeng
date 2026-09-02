<script setup>
// 音频波形播放器（播客风格）
//
// 波形采用「语音频带能量 + RMS」双指标合成的算法，明显区分“说话”与“停顿”：
//   · 逐窗做 FFT，取人声主频段（约 300–3400 Hz）的能量占总能量的比重作为“说话量”，
//     叠乘该窗 RMS 的感知响度，使语流区块隆起、静音/纯乐区块压低；
//   · 再对整段做对数压缩 + 噪声门限，把小音量语音也抬上来，形成可读的语段轮廓。
// 已播放部分会整体染色高亮，拖动/点击游标实时跟随。
// 支持：
//   · 播放 / 暂停
//   · 快退 15s / 快进 15s
//   · 循环播放（单曲循环开关）
//   · 点击波形跳转、按住拖动游标实时预览
// 底层仍用原生 <audio> 驱动播放。
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { Play, Pause, Repeat, RotateCcw, RotateCw } from "@lucide/vue";

const props = defineProps({ src: { type: String, required: true } });

const audioEl = ref(null);
const canvasEl = ref(null);
const playing = ref(false);
const loop = ref(false);
const duration = ref(0);
const current = ref(0);
const loaded = ref(false);
const error = ref(false);

// 交互状态：-1 表示无；0~1 表示进度比例
const dragFrac = ref(-1); // 拖动中（按下鼠标）
const hover = ref(-1);    // 悬停预览

let peaks = [];          // 各柱语感能量（0~1）
let decoding = false;
let ac = null;           // 用于 decodeAudioData 的 AudioContext
let cw = 0;
let ch = 0;
let dpr = 1;
let raf = 0;
let ro = null;

const COL = {
  played: "#f0502f",     // 已播放染色（暖橙，呼应播客质感）
  unplayed: "#e2e5e9",   // 未播放淡灰（带一点冷色，与染色对比更强）
  head: "#1a1a1a",
  guide: "rgba(26,26,26,0.18)",
};
const SKIP = 15;         // 快退/快进秒数
const clamp01 = (v) => Math.min(1, Math.max(0, v));

function fmt(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

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

/* =====================================================================
 * 语音辨识波形算法
 * ---------------------------------------------------------------------
 * 1) 取首个声道数据，必要时降采样以控制 FFT 成本。
 * 2) 将整段切成 N 个 bar，每个 bar 内取多个分析窗：
 *      - 每窗做 1024 点 FFT，统计语音主频段(300~3400Hz)能量占比 voice；
 *      - 同时算该窗 RMS（感知响度）。
 *    bar 值 = voice * (rms 的对数压缩) —— 语流区块高、静音/纯乐区块近 0。
 * 3) 对 bar 序列做平滑 + 噪声门限 + 归一化，得到最终峰值数组。
 * =================================================================== */
function computePeaks() {
  if (!props.src || decoding) return;
  decoding = true;
  try {
    peaks = [];
    computePeaksAsync().catch((e) => {
      error.value = true;
      console.warn("waveform decode failed:", e);
    });
  } finally {
    decoding = false;
  }
}

async function computePeaksAsync() {
  const res = await fetch(props.src);
  if (!res.ok) throw new Error("audio fetch failed");
  const buf = await res.arrayBuffer();
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  const audioBuf = await ac.decodeAudioData(buf);

  // ---- 取单声道并做粗略降采样（控制在 16kHz 附近，够语音分析即可）----
  const data0 = audioBuf.getChannelData(0);
  const srcRate = audioBuf.sampleRate || 44100;
  const targetRate = 16000;
  const decim = Math.max(1, Math.round(srcRate / targetRate));
  const outLen = Math.ceil(data0.length / decim);
  const mono = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) mono[i] = data0[i * decim];
  const rate = srcRate / decim; // 实际分析采样率

  const bars = Math.max(24, Math.floor((cw * dpr) / 5));
  const binHz = rate / 1024;                    // 每 FFT bin 对应频率
  const fLow = Math.floor(300 / binHz);         // 语音下限 bin
  const fHigh = Math.min(511, Math.ceil(3400 / binHz)); // 语音上限 bin（Nyquist=512）
  if (fHigh <= fLow) throw new Error("bad rate");

  const seg = Math.floor(mono.length / bars);
  const w = 1024; // FFT 窗
  const env = new Float32Array(bars);
  const winsPerBar = Math.max(1, Math.min(8, Math.floor(seg / w)));

  // ---- 逐 bar 分析 ----
  for (let b = 0; b < bars; b++) {
    const s0 = b * seg;
    const s1 = Math.min(mono.length, s0 + seg);
    let total = 0, voiceSum = 0, rmsSum = 0, count = 0;
    for (let wi = 0; wi < winsPerBar; wi++) {
      const wStart = s0 + Math.floor(((s1 - s0) * (wi + 0.5)) / winsPerBar) - w / 2;
      if (wStart < 0 || wStart + w > mono.length) continue;
      const spec = fftMag(mono.subarray(wStart, wStart + w));
      let all = 0, voice = 0;
      for (let k = 1; k < 512; k++) {
        const p = spec[k] * spec[k];
        all += p;
        if (k >= fLow && k <= fHigh) voice += p;
      }
      // RMS
      let rr = 0;
      for (let i = 0; i < w; i++) {
        const v = mono[wStart + i];
        rr += v * v;
      }
      rr = Math.sqrt(rr / w);
      const vr = all > 0 ? voice / all : 0;   // 语音频段能量占比
      rmsSum += rr;
      voiceSum += vr;
      total += 1;
      count++;
    }
    if (count) {
      const voiceRatio = voiceSum / count;
      const rms = rmsSum / count;
      // 语音占比的 1.6 次方：对“有人在说话”的块更敏感地抬升
      const speak = Math.pow(clamp01(voiceRatio * 2.2), 1.6);
      // 感知响度：log 压缩后归一（以接近真实响度的相对值表示，大音放大、低音保留）
      const loud = clamp01((Math.log10(1 + rms * 50)) / 1.6);
      env[b] = speak * 0.72 + loud * 0.28;      // 语段特征为主，响度为辅
    }
  }

  // ---- 平滑（轻微均值） ----
  const sm = new Float32Array(bars);
  for (let b = 0; b < bars; b++) {
    let a = b > 0 ? env[b - 1] : env[b];
    let c = b < bars - 1 ? env[b + 1] : env[b];
    sm[b] = (env[b] * 2 + a + c) / 4;
  }

  // ---- 噪声门限：砍掉底噪，只留下语段 ----
  let min = Infinity, max = -Infinity;
  for (let b = 0; b < bars; b++) {
    if (sm[b] < min) min = sm[b];
    if (sm[b] > max) max = sm[b];
  }
  const thr = min + (max - min) * 0.04; // 低于全幅 4% 视为噪声
  for (let b = 0; b < bars; b++) {
    peaks[b] = clamp01((sm[b] - thr) / (max - thr || 1));
  }

  loaded.value = true;
  error.value = false;
  draw();
}

/* ---- 轻量 FFT（radix-2，N=1024）返回各 bin 幅值 ---- */
function fftMag(input) {
  const n = input.length;
  let real = new Float64Array(n);
  let imag = new Float64Array(n);
  for (let i = 0; i < n; i++) real[i] = input[i] * hann(i, n);
  // bit-reversal
  for (let i = 0, j = 0; i < n; i++) {
    if (i < j) { const tr = real[i]; real[i] = real[j]; real[j] = tr; const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti; }
    let m = n >> 1;
    while (j >= m && m) { j -= m; m >>= 1; }
    j += m;
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cwr = 1, cwi = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const u = i + j, v = i + j + half;
        const xr = real[v] * cwr - imag[v] * cwi;
        const xi = real[v] * cwi + imag[v] * cwr;
        real[v] = real[u] - xr; imag[v] = imag[u] - xi;
        real[u] += xr; imag[u] += xi;
        const nwr = cwr * wr - cwi * wi;
        cwi = cwr * wi + cwi * wr;
        cwr = nwr;
      }
    }
  }
  const mag = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) mag[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
  return mag;
}
function hann(i, n) { return 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)); }

function roundRectPath(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === "function") { ctx.roundRect(x, y, w, h, r); }
  else { ctx.beginPath(); ctx.rect(x, y, w, h); }
}

function draw() {
  const canvas = canvasEl.value;
  if (!canvas) return;
  const w = cw * dpr;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);

  const pad = 6 * dpr;
  const bandTop = pad;
  const bandH = h - pad * 2;
  const midY = bandTop + bandH / 2;

  const pFrac = duration.value > 0 ? clamp01(current.value / duration.value) : 0;
  const fillFrac = dragFrac.value >= 0 ? dragFrac.value : pFrac; // 已播放区
  const headFrac = dragFrac.value >= 0 ? dragFrac.value : hover.value >= 0 ? hover.value : pFrac;

  if (peaks.length) {
    const gap = 1.5 * dpr;
    const bw = (w - gap * (peaks.length - 1)) / peaks.length;
    const n = peaks.length;
    for (let i = 0; i < n; i++) {
      // 已染色 / 未染色；未播放用浅灰，已播放用强调色
      const isPlayed = fillFrac >= i / n;
      const base = Math.max(0.03, peaks[i]); // 最小值保留一条细基线，停顿处极低
      // 语音区高度适当放大，停顿区压低，形成明显差异
      const barH = Math.max(1 * dpr, base * bandH);
      const x = i * (bw + gap);
      const y = midY - barH / 2;
      ctx.fillStyle = isPlayed ? COL.played : COL.unplayed;
      ctx.globalAlpha = isPlayed ? 0.95 : (0.35 + 0.55 * base); // 停顿淡、说话深
      roundRectPath(ctx, x, y, bw, barH, bw / 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.fillStyle = COL.unplayed;
    ctx.fillRect(0, midY - 1, w, 2 * dpr);
  }

  // 游标线 + 圆点手柄
  if (duration.value > 0 || loaded.value) {
    const hx = headFrac * w;
    const lineW = Math.max(1.5, 2 * dpr);
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
  ch = rect.height || 64;
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

function skip(delta) {
  const a = audioEl.value;
  if (!a || !duration.value) return;
  const t = clamp01((a.currentTime + delta) / duration.value) * duration.value;
  a.currentTime = t;
  current.value = t;
  draw();
}

function toggleLoop() {
  const a = audioEl.value;
  loop.value = !loop.value;
  if (a) a.loop = loop.value;
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
    hover.value = f;
    if (!playing.value) draw();
  }
}
function onPointerUp(ev) {
  if (dragFrac.value < 0) return;
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
  audioEl.value.loop = loop.value;
  if (!peaks.length && props.src) computePeaks();
}
function onPlay() {
  playing.value = true;
  dragFrac.value = -1;
  loopTick();
}
function onPause() {
  playing.value = false;
  cancelAnimationFrame(raf);
  draw();
}
function onEnded() {
  // 循环播放由 <audio loop> 接管；非循环则归零停在结尾
  if (!loop.value) {
    playing.value = false;
    cancelAnimationFrame(raf);
    draw();
  }
}

function loopTick() {
  const a = audioEl.value;
  if (a) {
    current.value = a.currentTime || 0;
    draw();
  }
  raf = requestAnimationFrame(loopTick);
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
    loop.value = false;
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
    <!-- 顶部：波形画布 -->
    <div class="wave-stage">
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
    </div>

    <!-- 底部控制条：循环 | 快退 | 播放/暂停 | 快进 | 时间 -->
    <div class="wave-controls">
      <div class="ctrl-left">
        <button
          class="ctrl ctrl-loop"
          type="button"
          :class="{ on: loop }"
          :title="loop ? '关闭循环播放' : '循环播放'"
          :aria-pressed="loop"
          @click="toggleLoop"
        >
          <Repeat :aria-hidden="true" />
        </button>

        <button
          class="ctrl ctrl-skip"
          type="button"
          :title="'快退 ' + SKIP + ' 秒'"
          :aria-label="'快退 ' + SKIP + ' 秒'"
          @click="skip(-SKIP)"
        >
          <RotateCcw :aria-hidden="true" />
          <span class="skip-num">15</span>
        </button>

        <button
          class="play-btn"
          type="button"
          :aria-label="playing ? '暂停' : '播放'"
          :title="playing ? '暂停' : '播放'"
          @click="toggle"
        >
          <Play v-if="!playing" :aria-hidden="true" />
          <Pause v-else :aria-hidden="true" />
        </button>

        <button
          class="ctrl ctrl-skip"
          type="button"
          :title="'快进 ' + SKIP + ' 秒'"
          :aria-label="'快进 ' + SKIP + ' 秒'"
          @click="skip(SKIP)"
        >
          <RotateCw :aria-hidden="true" />
          <span class="skip-num">15</span>
        </button>
      </div>

      <div class="ctrl-right">
        <span class="wave-time">{{ shownTime }}</span>
        <span class="wave-dur">/ {{ fmt(duration) }}</span>
      </div>
    </div>

    <!-- 读取状态提示条 -->
    <div v-if="!loaded && !error" class="wave-hint">读取并分析语音波形…</div>
    <div v-else-if="error" class="wave-hint error">无法分析音频，仍可点播放试听</div>

    <!-- 实际播放器：默认隐藏，交由波形 UI 驱动 -->
    <audio
      ref="audioEl"
      :src="props.src"
      preload="metadata"
      :loop="loop"
      @loadedmetadata="onLoaded"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    ></audio>
  </div>
</template>

<style scoped>
.waveform {
  position: relative;
  padding: 1rem 1.05rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.015);
  user-select: none;
}

/* ---- 顶部波形区 ---- */
.wave-stage {
  position: relative;
  height: 66px;
}
.wave-canvas-wrap {
  position: absolute;
  inset: 0;
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

/* ---- 底部控制条 ---- */
.wave-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.7rem;
}
.ctrl-left {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.ctrl {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--fg-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease, transform 0.08s ease;
}
.ctrl svg { width: 17px; height: 17px; }
.ctrl:hover { color: #000; border-color: #d5d5d5; transform: scale(1.05); }
.ctrl:active { transform: scale(0.95); }

/* 循环开关：开启时高亮 */
.ctrl-loop svg { width: 16px; height: 16px; }
.ctrl-loop.on { color: #fff; background: var(--fg); border-color: var(--fg); }

/* 快退/快进：含 15 字样 */
.ctrl-skip {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
}
.ctrl-skip svg { width: 15px; height: 15px; }
.skip-num {
  font-size: 0.42rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  color: currentColor;
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}

/* 主播放键 */
.play-btn {
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: var(--fg);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.08s ease;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.16);
}
.play-btn:hover { background: #000; transform: scale(1.04); }
.play-btn:active { transform: scale(0.96); }
.play-btn svg { width: 20px; height: 20px; }

.ctrl-right {
  display: flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
}
.wave-time { color: var(--fg); font-weight: 600; }
.wave-dur { color: var(--fg-faint); margin-left: 0.25rem; }

/* 状态提示 */
.wave-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -66%);
  font-size: 0.72rem;
  color: var(--fg-faint);
  pointer-events: none;
}
.wave-hint.error { color: #c0392b; }
</style>
