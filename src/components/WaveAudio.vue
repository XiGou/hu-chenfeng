<script setup>
/**
 * WaveAudio — 选读详情的波形音频播放器。
 *
 * 行为与旧的 gen-share-pages 内联播放器一致：
 *   - 无 JS / 加载失败 → 回退原生 <audio controls>
 *   - 加载成功 → 波形可视化（点击跳转 + 播放着色进度）
 * 需传入音频的「页面相对 URL」src（外链则直接使用），及 Wavesurfer
 * 模块的「页面相对 URL」moduleUrl。
 *
 * 连播（#86）：props.mode 为 "seq" | "random" 时（详情页传入）：
 *   - hydration 后自动开播（等波形模块就绪，失败则回退原生播放器）
 *   - 音频播完 → 经 audio-registry 幂等汇总 → 由 EssenceDetail 连播下一条
 *   - mode 为 "off" 时行为与原版完全一致，不自动播放、不跳转。
 */
import { ref, onMounted, onBeforeUnmount } from "vue";
import { bindNativeAudio, feedEnded } from "../data/lib/audio-registry.js";

const props = defineProps({
  src: { type: String, default: "" },
  moduleUrl: { type: String, default: "" },
  /** 连播模式：off | seq | random（详情页按 localStorage 状态传入） */
  mode: { type: String, default: "off" },
});

const waveEl = ref(null);
const playBtn = ref(null);
const curEl = ref(null);
const durEl = ref(null);
const waveBox = ref(null);
const nativeAudio = ref(null);

const playing = ref(false);

function fmt(sec) {
  const s = Math.floor(sec || 0);
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}

let ws = null;
let waveFailed = false;

async function upgrade() {
  const container = waveBox.value;
  if (!container || !nativeAudio.value || !props.src) return;
  try {
    const WaveSurfer = (await import(/* @vite-ignore */ props.moduleUrl)).default;
    ws = WaveSurfer.create({
      container,
      url: props.src,
      height: 64,
      waveColor: "#d6d6d6",
      progressColor: "#111111",
      cursorColor: "#111111",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      dragToSeek: true,
      fillParent: true,
      hideScrollbar: true,
    });
    nativeAudio.value.hidden = true;
    ws.on("ready", () => { if (durEl.value) durEl.value.textContent = fmt(ws.getDuration()); });
    ws.on("timeupdate", (t) => { if (curEl.value) curEl.value.textContent = fmt(t); });
    ws.on("play", () => (playing.value = true));
    ws.on("pause", () => (playing.value = false));
    // 连播：波形播放器播完 → 汇总触发（原生路径由 audio-registry 监听 ended）
    if (props.mode !== "off") ws.on("finish", () => feedEnded());
    if (playBtn.value) {
      playBtn.value.addEventListener("click", () => ws.playPause());
    }
  } catch (err) {
    console.warn("波形播放器加载失败，已回退原生播放器", err);
    ws = null;
    waveFailed = true;
  }
}

/** 连播自动开播：轮询等波形模块就绪（≤6s），失败则回退原生播放器。 */
function tryAutoplay(attempt) {
  if (props.mode === "off") return;
  if (ws) {
    ws.play();
    return;
  }
  if (waveFailed) {
    if (nativeAudio.value) nativeAudio.value.play().catch(() => {});
    return;
  }
  if (attempt > 20) return;
  setTimeout(() => tryAutoplay(attempt + 1), 300);
}

onMounted(() => {
  // 连播：登记原生 <audio> 的 ended 事件（与波形 finish 汇总，幂等）
  if (props.mode !== "off" && props.src) {
    bindNativeAudio(nativeAudio.value);
  }
  upgrade();
  if (props.mode !== "off") tryAutoplay(0);
});

onBeforeUnmount(() => {
  if (ws) {
    try { ws.unAll(); ws.destroy(); } catch (e) { /* 忽略 */ }
    ws = null;
  }
});
</script>

<template>
  <div class="wave-audio">
    <!-- 无 JS / 加载失败兜底：原生播放器 -->
    <audio ref="nativeAudio" controls preload="metadata" :src="src"></audio>

    <!-- 波形播放器容器（默认隐藏，JS 接管后显示） -->
    <div ref="waveBox" class="wave-box" hidden>
      <div class="wave-bar">
        <button ref="playBtn" type="button" class="wave-play" aria-label="播放">
          <span v-if="!playing" class="wave-ico wave-ico-play" aria-hidden="true">▶</span>
          <span v-else class="wave-ico wave-ico-pause" aria-hidden="true">❚❚</span>
        </button>
        <div class="wave-head">
          <div class="wave-name">边读边听</div>
          <div class="wave-time"><span ref="curEl">0:00</span> / <span ref="durEl">--:--</span></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-native-hidden,
.wave-audio audio[hidden] { display: none; }
.wave-box { margin-top: 0.4rem; }
.wave-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}
.wave-play {
  flex: none;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 50%;
  background: var(--accent, #111);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.15s ease;
}
.wave-play:hover { background: #333; }
.wave-head { min-width: 0; }
.wave-name { font-size: 13px; color: var(--fg, #333); font-weight: 600; }
.wave-time { font-size: 12px; color: var(--fg-faint, #999); font-variant-numeric: tabular-nums; }
</style>
