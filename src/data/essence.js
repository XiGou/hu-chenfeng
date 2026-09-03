// ==========================================================================
// 精华摘录 · Essence
//
// 这些片段从 submodule `reference/hu-chenfeng` 的直播文字稿中手工摘取，
// 截取其相对完整、可独立阅读的段落作为展示。每一条都标注了原始出处，
// 可在参考仓库中按月份/日期追溯完整上下文。
//
// 数据维护方式：
//   每一条选读内容独立维护为一个 Markdown 文件，存放于 `src/data/essence/`。
//   文件采用「YAML front-matter + 正文」的易读格式，字段见目录内 README。
//   此处（essence.js）仅负责：
//     1) 导出站点 meta
//     2) 用 import.meta.glob 收集目录下所有单文件选读（按数字 id 命名），
//        解析为列表并按 id 升序输出。
//   新增选读通过仓库「提交新选读」Issue 模板触发工作流自动新增文件。
// ==========================================================================

import { parseMarkdownItem } from "./lib/essence-md.js";

export const meta = {
  title: "户晨风 · 摘录",
  subtitle: "Selected fragments · 精华选读",
  description:
    "从 2023–2025 年的直播文字稿中挑选的只言片语，供安静阅读。另有「观点」（立场之传）、「语录」（言论之辑）与「展厅」（图像之览）三个栏目。",
};

// 收集 src/data/essence/ 下所有以数字命名的单文件选读（*.md）。
// 数字前缀即 id；README 等说明文件（非数字开头）不会被误收。
const modules = import.meta.glob("./essence/[0-9]*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

// 归一化 audio 资源路径：
//   - 外链 URL → 原样保留
//   - 仓库内资源路径（相对 public，如 audio/quotes/xx.mp3）→ 加 "./" 前缀
//     站点以 base:"./" 构建，页面与资源同目录 —— 相对路径兼容任意子路径部署。
function normalizeAudio(value) {
  if (!value) return value;
  if (/^https?:\/\//.test(value)) return value;
  const p = value.startsWith("public/") ? value.slice("public/".length) : value;
  return "./" + (p.startsWith("/") ? p.slice(1) : p);
}

// 选读列表 — 由 src/data/essence/*.md 自动汇总，按 id 升序。
export const essence = Object.keys(modules)
  .map((path) => {
    const item = parseMarkdownItem(modules[path]);
    if (item.audio) item.audio = normalizeAudio(item.audio);
    return item;
  })
  .filter((item) => item.id !== undefined)
  .sort((a, b) => a.id - b.id);
