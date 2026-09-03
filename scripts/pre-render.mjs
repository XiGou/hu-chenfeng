#!/usr/bin/env node
/**
 * pre-render.mjs — 站彻底 MPA 的「全量预渲染」步骤。
 *
 * 构建流程：
 *   1. Vite 构建 MPA（产生 4 个 HTML 壳 + JS/CSS 资源）
 *   2. Vite SSR 构建（把 src/ssr/entry.js 打成可执行 bundle）
 *   3. 本脚本：运行 SSR bundle 渲染 4 个页面，把内容注入 dist/*.html
 *
 * 输出：每个 dist/*.html 的 <div id="app"></div> 被替换为完整的 SSR 渲染内容。
 * 浏览器端 JS 用 createSSRApp(...).mount()（SSR 应用 mount 即执行 hydration）恢复交互。
 *
 * 用法：
 *   node scripts/pre-render.mjs            # 默认读 dist/ 写回 dist/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, "dist");
const SSR_OUT_DIR = process.env.SSR_OUT_DIR || path.join(ROOT, ".ssr-build");

/** 页面 key → dist 下的文件名 */
const PAGE_FILES = {
  home: "index.html",
  viewpoints: "viewpoints.html",
  quotations: "quotations.html",
  gallery: "gallery.html",
};

async function main() {
  console.log("[pre-render] 构建 SSR bundle…");

  const { build } = await import("vite");
  const vuePlugin = (await import("@vitejs/plugin-vue")).default;

  // 清理并重建 SSR 目录
  fs.rmSync(SSR_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SSR_OUT_DIR, { recursive: true });

  // 第一步：用 Vite 构建 SSR bundle
  // 注意 base 与客户端构建一致（"./"）——使 import.meta.env.BASE_URL 在
  // SSR bundle 中解析为 "./"，让组件内生成相对 URL 链接。
  await build({
    root: ROOT,
    configFile: false,
    plugins: [vuePlugin()],
    base: "./",
    build: {
      ssr: path.join(ROOT, "src/ssr/entry.js"),
      outDir: SSR_OUT_DIR,
      rollupOptions: {
        output: { entryFileNames: "entry.js" },
      },
      // 明确：不复制 public 到 SSR outDir
      copyPublicDir: false,
    },
    logLevel: "error",
  });

  // 第二步：加载 SSR bundle 渲染各页面
  const { renderPage } = await import(
    path.join(SSR_OUT_DIR, "entry.js") + `?t=${Date.now()}`
  );

  let count = 0;
  for (const [page, fileName] of Object.entries(PAGE_FILES)) {
    const file = path.join(OUT_DIR, fileName);
    if (!fs.existsSync(file)) {
      console.warn(`[pre-render] 跳过 ${fileName}（文件不存在）`);
      continue;
    }

    // 1. SSR 渲染页面内容
    const content = await renderPage(page);

    // 2. 读回构建后的 HTML 模板
    let html = fs.readFileSync(file, "utf8");

    // 3. 用 SSR 内容替换 <div id="app"></div> 空壳
    const appContainer = /<div id="app"><\/div>/;
    if (!appContainer.test(html)) {
      console.warn(`[pre-render] ${fileName} 中未找到空 #app 容器，跳过`);
      continue;
    }

    // Vue SSR 输出不含 #app 包裹元素 —— 需手动包回
    const appHtml = `<div id="app">${content}</div>`;
    html = html.replace(appContainer, appHtml);

    // 4. 写回
    fs.writeFileSync(file, html, "utf8");
    count++;
    console.log(`[pre-render] ✔ ${fileName} 已预渲染（${content.length} 字符内容）`);
  }

  // 清理临时 SSR 构建目录
  fs.rmSync(SSR_OUT_DIR, { recursive: true, force: true });

  console.log(`[pre-render] 完成：共 ${count} 个页面已全量预渲染。`);
}

main().catch((err) => {
  console.error("[pre-render] 失败：", err);
  process.exit(1);
});
