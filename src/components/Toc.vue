<script setup>
/**
 * Toc — 首页「选读」目录。
 *
 * 分页（#86）：首页选读数量超过 20 个时自动分页（每页 20 条），页码导航
 * 置于列表底部；检索过滤时隐藏分页、直接展示全部匹配项。
 *
 * 连播（#86）体验收敛至「纯享 · 黑胶唱机」（./pure.html，与展厅同级别栏目）：
 * 本页保持干净的选读目录，不在首页堆叠连播/纯享入口按钮。
 * 分页能力在此保留（> 20 则时自动分页）。
 */
import { ref, computed, watch } from "vue";
import { splitThemes } from "../data/lib/tags.js";
import { detailHref } from "../data/lib/playlist.js";

const props = defineProps({
  items: { type: Array, required: true },
  total: { type: Number, default: 0 },
  keyword: { type: String, default: "" },
});

// ---------- 分页 ----------
const PAGE_SIZE = 20;
const page = ref(1);
const totalPages = computed(() => Math.max(1, Math.ceil(props.items.length / PAGE_SIZE)));
const pagedItems = computed(() => {
  if (props.keyword) return props.items; // 检索时不分页，直接展示全部匹配
  const start = (page.value - 1) * PAGE_SIZE;
  return props.items.slice(start, start + PAGE_SIZE);
});
const pageNumbers = computed(() =>
  Array.from({ length: totalPages.value }, (_, i) => i + 1)
);
// 检索词或过滤结果变化时回到第 1 页；页码越界时收敛
watch(
  () => [props.keyword, props.items.length],
  () => {
    if (page.value > totalPages.value) page.value = totalPages.value;
    if (page.value < 1) page.value = 1;
    if (props.keyword) page.value = 1;
  }
);
function goto(p) {
  page.value = Math.min(Math.max(1, p), totalPages.value);
}

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

    <template v-else>
      <ul class="item-list">
        <li v-for="q in pagedItems" :key="q.id" class="item">
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

      <!-- 分页导航：超过 20 条时出现 -->
      <nav v-if="totalPages > 1 && !keyword" class="pager" aria-label="选读分页">
        <button
          type="button"
          class="pager-btn"
          :disabled="page <= 1"
          aria-label="上一页"
          @click="goto(page - 1)"
        >‹</button>
        <button
          v-for="p in pageNumbers"
          :key="p"
          type="button"
          class="pager-btn pager-num"
          :class="{ active: p === page }"
          :aria-current="p === page ? 'page' : undefined"
          @click="goto(p)"
        >{{ p }}</button>
        <button
          type="button"
          class="pager-btn"
          :disabled="page >= totalPages"
          aria-label="下一页"
          @click="goto(page + 1)"
        >›</button>
      </nav>
    </template>
  </div>
</template>
