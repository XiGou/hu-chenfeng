<script setup>
/**
 * ShareBar — 复制干净链接 / 分享到 X(Twitter)。
 *
 * SSR 友好：模板仅渲染按钮；交互（复制到剪贴板、组 X intent 链接）
 * 全部在 onMounted（浏览器环境）里完成，构建期 SSR 不触碰 window/location。
 *
 * props：
 *   title     分享标题
 *   cleanUrl  构建期可烘出的 canonical 绝对地址（配 SITE_URL 时）；为空则运行时
 *             用地址栏去掉 .html 后缀补。
 */
import { ref, onMounted } from "vue";

const props = defineProps({
  title: { type: String, default: "" },
  cleanUrl: { type: String, default: "" },
});

const copied = ref(false);
const tweetHref = ref("#");
const copyLabel = ref("复制链接");
let timer = null;

onMounted(() => {
  // canonical：优先构建期绝对地址；否则用当前地址栏去掉 .html（与部署一致）
  let url = props.cleanUrl;
  if (!url) {
    url = location.href.split("#")[0].split("?")[0].replace(/\.html$/i, "");
  }
  // X intent
  if (props.title) {
    tweetHref.value =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(props.title) +
      "&url=" +
      encodeURIComponent(url);
  }
  // 复制按钮
  const flash = (ok) => {
    copyLabel.value = ok ? "已复制 ✓" : "复制失败";
    clearTimeout(timer);
    timer = setTimeout(() => {
      copyLabel.value = "复制链接";
    }, 2000);
  };
  const legacyCopy = () => {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      flash(true);
    } catch (e) {
      flash(false);
    }
    document.body.removeChild(ta);
  };
  const doCopy = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        () => flash(true),
        () => legacyCopy()
      );
    } else {
      legacyCopy();
    }
  };
  copyBtn.value.addEventListener("click", doCopy);
});

const copyBtn = ref(null);
</script>

<template>
  <div class="share-btns">
    <button ref="copyBtn" type="button" class="share-btn">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/>
      </svg>
      <span>{{ copyLabel }}</span>
    </button>
    <a class="share-btn tweet" :href="tweetHref" target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
      分享到 X
    </a>
  </div>
</template>
