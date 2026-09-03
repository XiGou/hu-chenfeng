# 户晨风 · 摘录

户晨风的**精华摘录**静态站点 —— 从 2023–2025 年直播文字稿中手工挑选的只言片语，以**极简主义**的风格呈现，专注文本与多媒体。

基于 **Vite + Vue 3** 构建，站彻底 **MPA（多页应用）**：首页 / 观点 / 语录 / 展厅各自为独立 URL 页面，构建期全量预渲染（SSR），无需执行 JS 即可阅读内容。

## ✨ 特性

- **极简主义 UI**：白底、留白、衬线正文，专注内容本身
- **站彻底 MPA**：每个栏目独立 URL 页，互链导航——
  - **首页（选读 Essence）**：`/` 从全集文字稿中摘取的精华片段列表，每条链接到独立详情页 `选读/<id>.html`
  - **观点 Viewpoints**：`/viewpoints.html` AI 通读全集后归纳的核心立场
  - **语录 Quotations**：`/quotations.html` 按主题整理的语录小文章
  - **展厅 Gallery**：`/gallery.html` 图像资料集锦，点击查看大图
- **全量预渲染（SSR）**：构建期用 `@vue/server-renderer` 渲染所有页面内容到静态 HTML，搜索引擎与无 JS 环境可直接读取正文
- **实时检索**：每页搜索框可按关键词实时过滤当前栏目内容（客户端交互）
- **多媒体可选**：选读可独立附带音频、外链（视频/YouTube 等）
- **波形播放器**：选读详情页用 Wavesurfer.js 渲染音频波形，带播放/暂停、点按跳转与「播放着色」进度；无 JS 时自动回退原生播放器
- **悬浮 BGM 播放器**：右下角悬浮迷你播放器，可在多首静态 BGM 中任选一首循环播放
- **独立分享页**：每条选读构建时生成独立静态 HTML（`站点/选读/<id>.html`），含 OG / Twitter Card meta，可直接分享到 X(Twitter) 并点播音频

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 构建 | Vite 6（MPA 多入口） |
| 框架 | Vue 3（`<script setup>`） |
| 预渲染 | `@vue/server-renderer`（Vue 自带） |
| 样式 | 原生 CSS 变量 |

## 🚀 本地开发

```bash
npm install
npm run dev      # 开发服务器（http://localhost:5173）
npm run build    # 生产构建 → dist/（MPA + SSR 预渲染 + 选读详情页）
npm run preview  # 预览构建产物
```

## ☁️ 部署

通过根目录 `.cnb.yml` 流水线，push 到 `main` 分支自动构建并部署：

- **构建**：`vite build` → `pre-render.mjs`（SSR 预渲染）→ `gen-quote-videos` → `gen-share-pages`
- **公网部署**：将 `dist/` 静态产物同步到腾讯云 COS 对象存储

> **路径兼容**：构建产物中的资源（JS / CSS / 音频 / BGM）均使用**相对路径**引用（`vite.config.js` 中 `base: "./"`），`dist/` 可部署到任意位置（GitHub Pages 子路径 / COS / Cloudflare Pages）。

## 📁 项目结构

```
├── index.html                  # 首页入口 HTML（选读列表）
├── viewpoints.html             # 观点栏目入口 HTML
├── quotations.html             # 语录栏目入口 HTML
├── gallery.html                # 展厅栏目入口 HTML
├── vite.config.js              # Vite 配置（MPA 多入口）
├── scripts/
│   ├── pre-render.mjs          # SSR 预渲染脚本（生成全量静态 HTML）
│   ├── gen-share-pages.mjs     # 选读详情页生成器
│   └── gen-quote-videos.mjs    # ffmpeg 合成视频
├── src/
│   ├── layout/
│   │   └── PageShell.vue       # 共享页面骨架（页头 + 栏目导航 + BGM）
│   ├── pages/
│   │   ├── HomePage.vue        # 首页（选读 Essence 列表）
│   │   ├── ViewpointsPage.vue  # 观点页
│   │   ├── QuotationsPage.vue  # 语录页
│   │   └── GalleryPage.vue     # 展厅页
│   ├── main/
│   │   ├── home.js             # 首页客户端入口（hydrate）
│   │   ├── viewpoints.js       # 观点页客户端入口
│   │   ├── quotations.js       # 语录页客户端入口
│   │   └── gallery.js          # 展厅页客户端入口
│   ├── ssr/
│   │   └── entry.js            # SSR 渲染入口（供 pre-render.mjs 使用）
│   ├── components/
│   │   ├── Masthead.vue        # 页头
│   │   ├── Toc.vue             # 选读列表 + 检索
│   │   ├── Viewpoints.vue      # 观点内容组件
│   │   ├── Quotes.vue          # 语录内容组件（列表 + 详情切换）
│   │   ├── Gallery.vue         # 展厅内容组件（网格 + 灯箱）
│   │   ├── About.vue           # 关于浮层
│   │   └── BgmPlayer.vue       # 悬浮迷你 BGM 播放器
│   ├── data/
│   │   ├── essence.js          # 选读数据（meta + md 汇总）
│   │   ├── essence/            # 选读 Markdown 文件
│   │   ├── viewpoints.js       # 观点数据
│   │   ├── quotes.js           # 语录数据
│   │   ├── gallery.js          # 展厅数据
│   │   └── bgm.js              # BGM 曲目配置
│   └── styles/main.css         # 全局样式
├── public/404.html             # 404 页面
├── .cnb.yml                    # CNB 构建部署流水线
└── .github/workflows/          # GitHub Actions 部署
```

## 🗺 页面路由

| URL | 内容 |
|-----|------|
| `/` 或 `/index.html` | 首页 —— 选读（Essence）精华列表 + 检索 |
| `/viewpoints.html` | 观点 —— 户晨风核心立场 |
| `/quotations.html` | 语录 —— 按主题辑录的言论小文章 |
| `/gallery.html` | 展厅 —— 图像资料集锦 |
| `/选读/<id>.html` | 选读详情页（独立静态页，分享用） |
| `/videos/quotes/<id>.mp4` | 选读视频（og:video 直链） |
