#!/usr/bin/env node
/**
 * pre-render.mjs — 站彻底 MPA 的「全量预渲染」步骤。
 *
 * 构建流程：
 *   1. Vite 构建 MPA（4 个列表栏目页 + detail 详情壳）
 *   2. Vite SSR 构建（把 src/ssr/entry.js 打成可执行 bundle）
 *   3. 本脚本：
 *      a) SSR 渲染 4 个列表栏目页，把内容注入 dist/*.html 的 <div id="app">
 *      b) 为每条「选读」生成独立详情页 dist/选读/<id>.html：
 *         以 Vite 构建的 detail 壳为模板 → SSR 渲染单条详情内容注入 #app，
 *         并按 id 烘好 og / twitter meta、修正子目录下资源相对路径。
 *      c) 给首页 dist/index.html 注入基础 og meta（og:image 用 gallery 图）。
 *
 * 输出：每个 dist/*.html 的 <div id="app"></div> 被替换为完整的 SSR 渲染内容。
 * 浏览器端 JS 用 createSSRApp(...).mount()（SSR 应用 mount 即执行 hydration）恢复交互。
 *
 * 用法：
 *   node scripts/pre-render.mjs            # 默认读 dist/ 写回 dist/
 *   SITE_URL=https://example.com …         # 详情页 og 烘成绝对 https
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, "dist");
const SSR_OUT_DIR = process.env.SSR_OUT_DIR || path.join(ROOT, ".ssr-build");
const SITE_URL = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");

/** 页面 key → dist 下的文件名（列表栏目页） */
const PAGE_FILES = {
  home: "index.html",
  viewpoints: "viewpoints.html",
  quotations: "quotations.html",
  gallery: "gallery.html",
};

/** 详情页目录名（子目录，OG canonical 干净路径即 选读/<id>） */
const DIR_NAME = "选读";

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------
function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Markdown 正文 → 纯文本（去标记），用于 og:description */
function toPlainText(md) {
  return String(md || "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/#{1,3}\s+/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 外链判断 */
function isExternal(s) {
  return /^https?:\/\//.test(s || "");
}

let _galleryCache = null;
function getGalleryImages() {
  if (_galleryCache) return _galleryCache;
  const gDir = path.join(ROOT, "public", "gallery");
  if (!fs.existsSync(gDir)) {
    _galleryCache = [];
    return _galleryCache;
  }
  const files = fs.readdirSync(gDir)
    .filter((f) => /^img\d+\.png$/i.test(f))
    .sort((a, b) => Number(a.match(/^img(\d+)\.png$/i)[1]) - Number(b.match(/^img(\d+)\.png$/i)[1]));
  _galleryCache = files.map((f) => "gallery/" + f);
  return _galleryCache;
}
function pickGalleryIndex(seed, len) {
  if (len <= 0) return -1;
  return (Math.imul(seed || 0, 2654435761) >>> 0) % len;
}

/** 干净音频/资源站点路径（去 ./、public/、前导 /） */
function cleanSitePath(p) {
  if (!p) return "";
  return String(p)
    .trim()
    .replace(/^public\//, "")
    .replace(/^\.\/?/, "")
    .replace(/^\//, "");
}
function siteAbsolute(sitePath) {
  const c = cleanSitePath(sitePath);
  if (!c) return "";
  if (isExternal(c)) return c;
  return SITE_URL ? `${SITE_URL}/${c}`.replace(/([^:])\/+/g, "$1/") : "";
}
/** 详情页(位于 选读/ 下) → 资源相对地址；无 SITE_URL 时用于 og audio/image */
function sitePageRel(sitePath) {
  const c = cleanSitePath(sitePath);
  if (!c) return "";
  if (isExternal(c)) return c;
  return "../" + c;
}

// ---------------------------------------------------------------------------
// og meta
// ---------------------------------------------------------------------------
/** 单条选读详情页的 og / twitter meta 块 */
function buildOgMeta(item) {
  const { id, title = "", date = "", text = "", audio: rawAudio = "" } = item;
  const displayTitle = title || `选读 #${id}`;
  const cleanText = toPlainText(text);
  const SEP = " —— ";
  let description = title ? `${displayTitle}${SEP}${cleanText}` : cleanText;
  if ([...description].length > 115) {
    description = [...description].slice(0, 114).join("") + "…";
  }
  const pageCleanPath = `${DIR_NAME}/${id}`;
  const ogUrl = SITE_URL ? `${SITE_URL}/${pageCleanPath}` : pageCleanPath;

  // og:image —— 确定性选取 gallery 大图。
  // 有 SITE_URL 烘绝对 https；无则退回页面相对地址 ../（供浏览器补齐）。
  const g = getGalleryImages();
  const gi = pickGalleryIndex(id || 0, g.length);
  let imageSite = gi >= 0 ? g[gi] : "";
  const ogImage = SITE_URL ? siteAbsolute(imageSite) : sitePageRel(imageSite);

  const audio = SITE_URL ? siteAbsolute(rawAudio) : sitePageRel(rawAudio);
  const ogType = audio ? "music.song" : "article";
  const card = ogImage ? "summary_large_image" : "summary";

  const lines = [];
  lines.push(`<meta property="og:type" content="${ogType}">`);
  lines.push(`<meta property="og:title" content="${escHtml(displayTitle)}">`);
  lines.push(`<meta property="og:description" content="${escHtml(description)}">`);
  lines.push(`<meta property="og:site_name" content="户晨风 · 摘录">`);
  lines.push(`<meta property="og:url" content="${escHtml(ogUrl)}">`);
  if (date) lines.push(`<meta property="og:article:published_time" content="${escHtml(date)}">`);
  if (audio) {
    lines.push(`<meta property="og:audio" content="${escHtml(audio)}">`);
    lines.push(`<meta property="og:audio:secure_url" content="${escHtml(audio)}">`);
    lines.push(`<meta property="og:audio:type" content="audio/mpeg">`);
  }
  if (ogImage) {
    lines.push(`<meta property="og:image" content="${escHtml(ogImage)}">`);
    lines.push(`<meta property="og:image:secure_url" content="${escHtml(ogImage)}">`);
    lines.push(`<meta property="og:image:type" content="image/png">`);
    lines.push(`<meta property="og:image:alt" content="${escHtml(displayTitle)}">`);
  }
  lines.push(`<meta name="twitter:card" content="${card}">`);
  lines.push(`<meta name="twitter:title" content="${escHtml(displayTitle)}">`);
  lines.push(`<meta name="twitter:description" content="${escHtml(description)}">`);
  if (ogImage) lines.push(`<meta name="twitter:image" content="${escHtml(ogImage)}">`);
  return lines;
}

async function buildSSR() {
  const { build } = await import("vite");
  const vuePlugin = (await import("@vitejs/plugin-vue")).default;
  fs.rmSync(SSR_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SSR_OUT_DIR, { recursive: true });
  await build({
    root: ROOT,
    configFile: false,
    plugins: [vuePlugin()],
    base: "./",
    build: {
      ssr: path.join(ROOT, "src/ssr/entry.js"),
      outDir: SSR_OUT_DIR,
      rollupOptions: { output: { entryFileNames: "entry.js" } },
      copyPublicDir: false,
    },
    logLevel: "error",
  });
  return await import(path.join(SSR_OUT_DIR, "entry.js") + `?t=${Date.now()}`);
}

/** 渲染列表栏目页 */
async function renderListPages(api) {
  let count = 0;
  for (const [page, fileName] of Object.entries(PAGE_FILES)) {
    const file = path.join(OUT_DIR, fileName);
    if (!fs.existsSync(file)) {
      console.warn(`[pre-render] 跳过 ${fileName}（文件不存在）`);
      continue;
    }
    const content = await api.renderPage(page);
    let html = fs.readFileSync(file, "utf8");
    const appContainer = /<div id="app"><\/div>/;
    if (!appContainer.test(html)) {
      console.warn(`[pre-render] ${fileName} 中未找到空 #app 容器，跳过`);
      continue;
    }
    const appHtml = `<div id="app">${content}</div>`;
    html = html.replace(appContainer, appHtml);
    fs.writeFileSync(file, html, "utf8");
    count++;
    console.log(`[pre-render] ✔ ${fileName} 已预渲染（${content.length} 字符内容）`);
  }
  return count;
}

/** 生成全部选读详情页 */
async function renderDetailPages(api) {
  const items = api.listEssence();
  const shellFile = path.join(OUT_DIR, "detail.html");
  if (!fs.existsSync(shellFile)) {
    console.warn("[pre-render] 未找到 detail 壳（detail.html），跳过详情页生成");
    return 0;
  }
  if (!items.length) {
    console.log("[pre-render] 无选读数据，跳过详情页生成");
    // 无详情页也要移除中间壳，避免把通用 detail.html 部署出去
    fs.rmSync(shellFile, { force: true });
    return 0;
  }
  const shell = fs.readFileSync(shellFile, "utf8");
  // 壳位于子目录 选读/ 下 → 修正资源相对路径
  const nestedShell = shell
    .replace(/\.\/assets\//g, "../assets/")
    .replace(/\.\/favicons\//g, "../favicons/");

  const dir = path.join(OUT_DIR, DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });

  let count = 0;
  for (const item of items) {
    const id = item.id;
    const content = await api.renderEssence(id, item);
    let html = nestedShell;
    // 注入每条 og meta（head 内，</head> 前）
    const ogMeta = buildOgMeta(item);
    html = html.replace("<!-- og meta 注入锚点 -->", ogMeta.join("\n    "));
    // 标题
    const title = item.title ? `${item.title} · 户晨风直播精选 | 选读 #${id}` : `户晨风 · 选读 #${id} | 直播文字稿精华摘录`;
    html = html.replace("<title>户晨风 · 选读</title>", `<title>${escHtml(title)}</title>`);
    // 替换空 #app → 带 data-id 的 SSR 内容
    html = html.replace(
      '<div id="app"></div>',
      `<div id="app" data-id="${id}">${content}</div>`
    );
    const file = path.join(dir, `${id}.html`);
    fs.writeFileSync(file, html, "utf8");
    count++;
    console.log(`[pre-render] ✔ ${path.relative(ROOT, file)} 已生成（${content.length} 字符内容）`);
  }
  // 移除中间壳 detail.html（不可直接部署为独立页）
  fs.rmSync(shellFile, { force: true });
  return count;
}

/** 首页 og meta（由旧 gen-share-pages 迁移而来） */
function injectIndexOg(api) {
  const file = path.join(OUT_DIR, "index.html");
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, "utf8");
  if (/property="og:title"/.test(html)) return; // 已注入过

  const galleryImages = getGalleryImages();
  const ogUrl = SITE_URL ? SITE_URL : "index.html";

  // og:image —— 优先选 landscape 尺寸 gallery 图，否则取首图
  let imageSite = "";
  if (galleryImages.length) {
    const cands = ["gallery/img3.png", "gallery/img4.png", "gallery/img5.png"];
    imageSite = cands.find((c) => galleryImages.includes(c)) || galleryImages[0];
  }
  const ogImage = imageSite ? siteAbsolute(imageSite) : "";

  const ogBlock = [
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="户晨风直播文字稿精华摘录">',
    '<meta property="og:description" content="户晨风直播文字稿精华摘录——从万千场直播中精选的思考片段：选读 / 观点 / 语录 / 展厅，安静阅读，边读边听。">',
    '<meta property="og:site_name" content="户晨风 · 摘录">',
    '<meta property="og:url" content="' + escHtml(ogUrl) + '">',
  ];
  if (ogImage) {
    ogBlock.push('<meta property="og:image" content="' + escHtml(ogImage) + '">');
    ogBlock.push('<meta property="og:image:secure_url" content="' + escHtml(ogImage) + '">');
  }
  ogBlock.push('<meta name="twitter:card" content="' + (ogImage ? "summary_large_image" : "summary") + '">');
  ogBlock.push('<meta name="twitter:title" content="户晨风直播文字稿精华摘录">');
  ogBlock.push('<meta name="twitter:description" content="户晨风直播文字稿精华摘录——从万千场直播中精选的思考片段：选读 / 观点 / 语录 / 展厅。">');
  if (ogImage) ogBlock.push('<meta name="twitter:image" content="' + escHtml(ogImage) + '">');

  html = html.replace("</head>", "  " + ogBlock.join("\n  ") + "\n  </head>");
  fs.writeFileSync(file, html, "utf8");
  console.log("[pre-render] 首页 index.html 已注入 og meta（og:image=" + (ogImage || "无") + "）");
}

async function main() {
  console.log("[pre-render] 构建 SSR bundle…");
  const api = await buildSSR();

  let count = 0;
  count += await renderListPages(api);
  count += await renderDetailPages(api);
  injectIndexOg(api);

  fs.rmSync(SSR_OUT_DIR, { recursive: true, force: true });
  console.log(`[pre-render] 完成：共 ${count} 个页面已全量预渲染。`);
}

main().catch((err) => {
  console.error("[pre-render] 失败：", err);
  process.exit(1);
});
