<script setup>
/**
 * PurePlayerPage — 纯享模式 · 黑胶唱机
 *
 * 把站点当作一台黑胶唱机来听。不依赖任何具体内容 —— 遍历全部「选读」
 * （essence）自动生成播放列表，每条记录标题 + 音频 + 正文；既可按顺序
 * 依次播放，也可随机播放。中央唱片把随机挑出的 gallery 图像 mask 成圆标，
 * 播放时唱片旋转、唱臂就位，右侧同步滚动当前条的正文。
 *
 * 纯浏览器端渲染（无 SSR）：播放、旋转动画、进度与列表切换都依赖 JS。
 */
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { essence } from "../data/essence.js";
import { gallery } from "../data/gallery.js";
import { renderMarkdown } from "../data/lib/md-render.js";
import { splitThemes } from "../data/lib/tags.js";

// ---------------- 播放列表：遍历全部选读 ----------------
// 为每条固定分配一张随机的 gallery 图作唱片圆标（会话内稳定）。
const labelMap = new Map();
essence.forEach((e, i) => {
  if (gallery.length) {
    // 用一条稳定的伪随机，让不同 id 落到不同的图
    const seed = ((e.id || i) * 2654435761) >>> 0;
    labelMap.set(e.id, gallery[seed % gallery.length].image);
  }
});
function labelImage(id) {
  return labelMap.get(id) || (gallery.length ? gallery[0].image : "");
}

const playlist = essence; // 全部选读即为播放列表（已按 id 升序）

// ---------------- 状态 ----------------
const mode = ref("seq"); // "seq" 顺序 | "random" 随机
const index = ref(0);    // 当前播放列表下标
const playing = ref(false);
const loaded = ref(false);

const audioEl = ref(null);
const bodyWrap = ref(null);

const current = computed(() => playlist[index.value] || null);

// ---------------- 派生 ----------------
const title = computed(() => current.value?.title || (current.value ? `选读 #${current.value.id}` : ""));
const hasAudio = computed(() => !!(current.value && current.value.audio));
const nowPlayingNum = computed(() => String((current.value?.id ?? 0)).padStart(2, "0"));
const count = playlist.length;

const themeList = computed(() =>
  current.value ? splitThemes(current.value.theme) : []
);

/** 把多行 markdown 正文渲染为 HTML */
const html = computed(() =>
  current.value ? renderMarkdown(current.value.text) : ""
);

// 黑胶唱片旋转：跟随播放状态（play/pause 事件驱动）
const spin = playing;

function loadTrack(i) {
  if (i < 0) i = playlist.length - 1;
  if (i >= playlist.length) i = 0;
  index.value = i;
  const item = playlist[i];
  if (!item) return;
  loaded.value = false;
  const au = audioEl.value;
  if (au) {
    try {
      au.pause();
      au.removeAttribute("src");
      au.load();
    } catch (e) { /* 忽略 */ }
  }
  // 无音频（纯文本条）不设 src
  if (item.audio) {
    const src = item.audio;
    // 切源后恢复播放
    requestAnimationFrame(() => {
      if (au) {
        au.src = src;
        au.load();
        au.onloadeddata = () => {
          loaded.value = true;
          if (wantPlay.value) au.play().catch(() => {});
        };
      }
    });
  } else {
    // 纯文本条：短暂停留后自动接续
    if (wantPlay.value) {
      loaded.value = true;
      window.setTimeout(() => { if (wantPlay.value) next(true); }, 2200);
    }
  }
  if (bodyWrap.value) bodyWrap.value.scrollTop = 0;
}

/** 是否处于“期望播放”状态（切条 / 开播时参考） */
const wantPlay = ref(false);

function togglePlay() {
  const au = audioEl.value;
  if (!current.value) return;
  // 尚无音频源时先装载当前条
  if (!au || !current.value.audio) {
    if (current.value.audio) {
      wantPlay.value = true;
      loadTrack(index.value);
    }
    return;
  }
  if (au.paused) {
    wantPlay.value = true;
    au.play().catch(() => {});
  } else {
    wantPlay.value = false;
    au.pause();
  }
}

function onEnded() {
  wantPlay.value = true;
  next(false);
}

/** 接续下一条 */
function next(manual) {
  const n = playlist.length;
  if (n <= 1) return;
  let ni;
  if (mode.value === "random") {
    if (n === 1) ni = 0;
    else {
      let pool = Array.from({ length: n }, (_, k) => k).filter((k) => k !== index.value);
      ni = pool[Math.floor(Math.random() * pool.length)];
    }
  } else {
    ni = (index.value + 1) % n;
  }
  wantPlay.value = true;
  loadTrack(ni);
}

function prev() {
  const n = playlist.length;
  if (!n) return;
  wantPlay.value = true;
  loadTrack((index.value - 1 + n) % n);
}

function pickItem(i) {
  if (i === index.value) return;
  wantPlay.value = true;
  loadTrack(i);
}

function toggleMode() {
  mode.value = mode.value === "seq" ? "random" : "seq";
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const r = Math.floor(sec % 60);
  return m + ":" + String(r).padStart(2, "0");
}
const curTime = ref("0:00");
const durTime = ref("--:--");
const progress = ref(0);
function onTime() {
  const au = audioEl.value;
  if (!au) return;
  curTime.value = fmtTime(au.currentTime || 0);
  progress.value = au.duration ? (au.currentTime / au.duration) * 100 : 0;
}
function onMeta() {
  const au = audioEl.value;
  if (au) durTime.value = fmtTime(au.duration);
}
function seek(e) {
  const au = audioEl.value;
  if (!au || !au.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  au.currentTime = ratio * au.duration;
  progress.value = ratio * 100;
}

// ---------------- 键盘快捷键 ----------------
function onKey(e) {
  if (e.code === "Space") { e.preventDefault(); togglePlay(); }
  else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next(true); }
  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
}

// ---------------- 启动 ----------------
const onPlayEvt = () => (playing.value = true);
const onPauseEvt = () => (playing.value = false);

onMounted(() => {
  loadTrack(0);
  const au = audioEl.value;
  if (au) {
    au.addEventListener("ended", onEnded);
    au.addEventListener("timeupdate", onTime);
    au.addEventListener("loadedmetadata", onMeta);
    au.addEventListener("play", onPlayEvt);
    au.addEventListener("pause", onPauseEvt);
  }
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  const au = audioEl.value;
  if (au) {
    au.removeEventListener("ended", onEnded);
    au.removeEventListener("timeupdate", onTime);
    au.removeEventListener("loadedmetadata", onMeta);
    au.removeEventListener("play", onPlayEvt);
    au.removeEventListener("pause", onPauseEvt);
    try { au.pause(); } catch (e) { /* 忽略 */ }
  }
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div class="pure-stage">
    <!-- 顶部工具条 -->
    <header class="pure-top">
      <a class="pure-back" href="./index.html">‹ 返回首页</a>
      <h1 class="pure-brand">纯享模式<span class="pure-dot">·</span>黑胶唱机</h1>
      <span class="pure-tip">空格播放 / ←→ 切换</span>
    </header>

    <!-- 主区：左唱机 + 右正文 -->
    <div class="pure-main">
      <!-- 左：唱机 -->
      <section class="pure-turntable">
        <div class="tt" :class="{ on: spin }">
          <div class="tt-platter">
            <!-- 唱臂 -->
            <div class="tt-arm" :class="{ down: playing }">
              <div class="tt-arm-cup"></div>
              <div class="tt-arm-rod"></div>
              <div class="tt-arm-head"></div>
            </div>

            <!-- 唱片 -->
            <div class="tt-disc">
              <div class="tt-vinyl"></div>
              <div class="tt-label">
                <img v-if="labelImage(current && current.id)" :src="labelImage(current && current.id)" alt="唱片封面" />
              </div>
              <div class="tt-spindle"></div>
            </div>
          </div>

          <div class="tt-info">
            <div class="tt-no">{{ nowPlayingNum }} / {{ count }}</div>
            <h2 class="tt-title">{{ title }}</h2>
            <div v-if="themeList.length" class="tt-themes">
              <span v-for="(t, ti) in themeList" :key="ti" class="tt-theme">{{ t }}</span>
            </div>
          </div>

          <!-- 进度 -->
          <div class="tt-progress" @click="seek">
            <div class="tt-progress-bar" :style="{ width: progress + '%' }"></div>
          </div>
          <div class="tt-times">
            <span>{{ curTime }}</span>
            <span>{{ durTime }}</span>
          </div>

          <!-- 播放控制 -->
          <div class="tt-controls">
            <button type="button" class="tt-btn" title="上一首" aria-label="上一首" @click="prev">⏮</button>
            <button type="button" class="tt-btn tt-play" title="播放 / 暂停" aria-label="播放暂停" @click="togglePlay">
              {{ playing ? "❚❚" : "▶" }}
            </button>
            <button type="button" class="tt-btn" title="下一首" aria-label="下一首" @click="next(true)">⏭</button>
            <button
              type="button"
              class="tt-btn tt-mode"
              :class="{ active: mode === 'random' }"
              :title="mode === 'seq' ? '当前：顺序播放 · 点击切为随机' : '当前：随机播放 · 点击切为顺序'"
              @click="toggleMode"
            >
              {{ mode === "seq" ? "顺序" : "随机" }}
            </button>
          </div>

          <p class="tt-hint" :class="{ none: hasAudio }">
            {{ hasAudio ? "正在播放本则选读音频" : "纯文本选读，展示数秒后自动接续" }}
          </p>
        </div>

        <!-- 播放列表 -->
        <div class="tt-playlist" aria-label="播放列表">
          <h3 class="tt-pl-head">播放列表<span class="tt-pl-count">{{ playlist.length }} 则</span></h3>
          <ol class="tt-pl-list">
            <li
              v-for="(it, i) in playlist"
              :key="it.id"
              :class="{ active: i === index }"
            >
              <button type="button" class="tt-pl-item" @click="pickItem(i)">
                <span class="tt-pl-no">{{ String(it.id).padStart(2, "0") }}</span>
                <span class="tt-pl-title">{{ it.title || ("选读 #" + it.id) }}</span>
                <span class="tt-pl-ico">{{ i === index ? (playing ? "❚❚" : "▶") : (it.audio ? "♪" : "▤") }}</span>
              </button>
            </li>
          </ol>
        </div>
      </section>

      <!-- 右：正文 -->
      <section class="pure-panel" ref="bodyWrap">
        <article class="pure-text">
          <div class="pure-text-note">
            <span class="pure-cat">选读 · Essence</span>
            <span class="pure-date" v-if="current && current.date">{{ current.date }}</span>
          </div>
          <h2 class="pure-text-title">{{ title }}</h2>
          <div class="pure-entry" v-html="html"></div>
        </article>
      </section>
    </div>

    <!-- 隐藏原生播放器 -->
    <audio ref="audioEl" preload="metadata"></audio>
  </div>
</template>
