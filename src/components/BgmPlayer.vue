<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { bgmTracks } from "../data/bgm.js";

// 播放器状态
const open = ref(false);
const playing = ref(false);
const trackId = ref("");
const audioEl = ref(null);

const availableTracks = computed(() => bgmTracks.filter((t) => t.src));

const current = computed(
  () => bgmTracks.find((t) => t.id === trackId.value) || null
);

function toggle() {
  open.value = !open.value;
  // 收起且正在播放时不打断音乐，仅收起面板
}

function pick(id) {
  const t = bgmTracks.find((x) => x.id === id);
  if (!t || !t.src) return;
  trackId.value = id;
  playing.value = true;
  nextTickPlay();
}

function nextTickPlay() {
  requestAnimationFrame(() => {
    if (audioEl.value) audioEl.value.play();
  });
}

function togglePlay() {
  if (!audioEl.value) return;
  if (playing.value) {
    audioEl.value.pause();
    playing.value = false;
  } else {
    audioEl.value.play();
    playing.value = true;
  }
}

function onPlay() {
  playing.value = true;
}
function onPause() {
  playing.value = false;
}
function onEnded() {
  playing.value = false;
}

// 首次挂载：默认选中第一首可用的 BGM（不自动播放，由用户点击播放）
onMounted(() => {
  if (availableTracks.value.length && !trackId.value) {
    trackId.value = availableTracks.value[0].id;
  }
});
</script>

<template>
  <!-- 悬浮迷你播放器 -->
  <div class="bgm" :class="{ 'bgm--open': open }">
    <!--
      audio 元素始终渲染（不随面板展开/收起而销毁），
      这样即使收起面板或切换页面，音乐也能持续播放。
    -->
    <audio
      v-if="current"
      ref="audioEl"
      :src="current.src"
      loop
      preload="none"
      @play="onPlay"
      @pause="onPause"
      @ended="onEnded"
    ></audio>

    <!-- 悬浮球 -->
    <button
      class="bgm-ball"
      type="button"
      :aria-label="open ? '收起音乐播放器' : '打开音乐播放器'"
      :title="open ? '收起播放器' : '背景音乐'"
      @click="toggle"
    >
      <span v-if="playing && current" class="bgm-eq" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
      <svg v-else class="bgm-note" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z" />
      </svg>
    </button>

    <!-- 展开面板 -->
    <transition name="bgm">
      <div v-if="open" class="bgm-panel">
        <div class="bgm-head">
          <span class="bgm-title">背景音乐 · BGM</span>
          <button class="bgm-close" type="button" aria-label="关闭" @click="toggle">✕</button>
        </div>

        <!-- 曲目选择 -->
        <ul class="bgm-tracks">
          <li v-for="t in bgmTracks" :key="t.id">
            <button
              class="bgm-track"
              type="button"
              :class="{ 'is-active': trackId === t.id }"
              :disabled="!t.src"
              @click="pick(t.id)"
            >
              <span class="bgm-radio" aria-hidden="true">
                <i v-if="trackId === t.id && playing"></i>
              </span>
              <span class="bgm-label">{{ t.label }}</span>
              <span v-if="!t.src" class="bgm-missing">待添加音频</span>
            </button>
          </li>
        </ul>

        <!-- 播放控制 -->
        <div class="bgm-controls">
          <button
            class="bgm-play"
            type="button"
            :disabled="!current || !current.src"
            :aria-label="playing ? '暂停' : '播放'"
            @click="togglePlay"
          >{{ playing ? "⏸ 暂停" : "▶ 播放" }}</button>
          <span v-if="current && current.src" class="bgm-now">{{ current.label }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
/* ---------- 悬浮球 ---------- */
.bgm {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1000;
}
.bgm-ball {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
  transition: transform 0.2s ease, background 0.2s ease;
}
.bgm-ball:hover { background: var(--accent-hover); transform: scale(1.05); }
.bgm-note { width: 22px; height: 22px; }

/* 播放中的均衡器动画 */
.bgm-eq {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 20px;
}
.bgm-eq i {
  width: 4px;
  background: #fff;
  border-radius: 2px;
  animation: bgm-bounce 1s ease-in-out infinite;
}
.bgm-eq i:nth-child(1) { height: 55%; }
.bgm-eq i:nth-child(2) { height: 90%; animation-delay: 0.2s; }
.bgm-eq i:nth-child(3) { height: 70%; animation-delay: 0.4s; }
@keyframes bgm-bounce {
  0%, 100% { transform: scaleY(0.4); }
  50% { transform: scaleY(1); }
}

/* ---------- 展开面板 ---------- */
.bgm-panel {
  position: absolute;
  right: 0;
  bottom: 64px;
  width: 260px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  padding: 1rem;
}
.bgm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.8rem;
}
.bgm-title {
  font-size: 0.82rem;
  letter-spacing: 0.08em;
  color: var(--fg-soft);
}
.bgm-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--fg-faint);
  font-size: 0.9rem;
  line-height: 1;
}
.bgm-close:hover { color: var(--fg); }

.bgm-tracks {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  margin-bottom: 0.9rem;
  max-height: 210px;
  overflow-y: auto;
}
.bgm-track {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
  color: var(--fg);
  padding: 0.4rem 0.45rem;
  border-radius: 6px;
  transition: background 0.15s ease;
}
.bgm-track:hover { background: var(--line); }
.bgm-track:disabled { opacity: 0.45; cursor: not-allowed; }
.bgm-radio {
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 1.5px solid var(--fg-faint);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bgm-track.is-active .bgm-radio { border-color: var(--accent); }
.bgm-radio i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}
.bgm-label { flex: 1; }
.bgm-missing {
  font-size: 0.7rem;
  color: var(--fg-faint);
  flex-shrink: 0;
}

.bgm-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--line);
}
.bgm-play {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 0.35rem 0.9rem;
  font-family: inherit;
  font-size: 0.8rem;
  cursor: pointer;
  white-space: nowrap;
}
.bgm-play:hover { background: var(--accent-hover); }
.bgm-play:disabled { opacity: 0.45; cursor: not-allowed; }
.bgm-now {
  font-size: 0.75rem;
  color: var(--fg-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 过渡 */
.bgm-enter-active, .bgm-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.bgm-enter-from, .bgm-leave-to { opacity: 0; transform: translateY(8px); }

@media (max-width: 520px) {
  .bgm { right: 14px; bottom: 14px; }
  .bgm-panel { width: 240px; }
}
</style>
