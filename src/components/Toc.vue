<script setup>
import { splitThemes } from "../data/lib/tags.js";

defineProps({
  items: { type: Array, required: true },
  total: { type: Number, default: 0 },
  keyword: { type: String, default: "" },
});

function fmtDate(d) {
  if (!d) return "";
  const p = String(d).split("-");
  return p.length === 3 ? `${p[0]} · ${p[1]} · ${p[2]}` : d;
}

// 选读首页以「目录」方式呈现：仅突出展示标题；正文/音频摘要不在此预览，
// 完整内容点进详情页再读。无标题时回退为正文首行，便于识别条目。
function itemLabel(q) {
  if (q.title) return q.title;
  const first = String(q.text || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
  return first;
}

/** 构造选读详情页的相对 URL：首页(index.html)同目录下的 选读/<id>.html */
function detailHref(id) {
  return "./" + encodeURIComponent("选读") + "/" + id + ".html";
}
</script>

<template>
  <div class="list">
    <div class="list-head">
      <span class="label">Essence · 选读</span>
      <span class="count">
        {{ keyword ? items.length + " / " + total : total }} 则
      </span>
    </div>

    <p class="vp-note">
      收集各种二创与传播度广的音频、文字与视频，可配上 BGM 当作 podcast 来听——若比之古籍，犹《诗经》之风雅颂，听寻常人讲寻常事。
    </p>

    <p v-if="keyword && items.length === 0" class="search-empty">
      未找到与“{{ keyword }}”匹配的语录
    </p>

    <p v-else-if="items.length === 0" class="list-empty">
      暂无选读内容 —— 可通过仓库中的「提交新选读」Issue 模板添加。
    </p>

    <ul v-else class="item-list">
      <li v-for="q in items" :key="q.id" class="item">
        <a class="item-btn" :href="detailHref(q.id)">
          <span class="item-meta">
            <time>{{ fmtDate(q.date) }}</time>
            <span v-if="splitThemes(q.theme).length" class="item-themes">
              <span v-for="(t, ti) in splitThemes(q.theme)" :key="ti" class="item-theme">{{ t }}</span>
            </span>
          </span>
          <span class="item-title">{{ itemLabel(q) }}</span>
        </a>
      </li>
    </ul>
  </div>
</template>
