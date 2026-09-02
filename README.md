# 户晨风 · 摘录

户晨风的**精华摘录**静态站点 —— 从 2023–2025 年直播文字稿中手工挑选的只言片语，以**极简主义**的风格呈现，专注文本与多媒体。

基于 **Vite + Vue 3** 构建，干净、留白、克制，无多余装饰。

## ✨ 特性

- **极简主义 UI**：白底、留白、衬线正文，专注内容本身，无纸纹 / 印章 / 装饰性动效
- **三大栏目**：页首导航可在「选读」「观点」「语录」之间切换——
  - **选读**：从全集文字稿中摘取的精华片段，安静阅读
  - **观点**：AI 通读全集后归纳的重要观点（源自 `reference/viewpoints.md`）
  - **语录**：按主题整理的语录小文章（源自 `reference/quotations/`）
  - **展厅**：收集户晨风先生常见的图像资料及其介绍，点击后可查看大图
- **实时检索**：搜索框可按关键词 / 主题 / 日期实时过滤当前栏目
- **多媒体可选**：每条摘录可独立附带音频、视频、外链
- **追溯出处**：每条摘录标注原始出处，可一键跳转到 HuChenFeng 全集对应章节
- **悬浮 BGM 播放器**：右下角悬浮迷你播放器，可在多首静态 BGM 中任选一首循环播放
- **Submodule 集成**：`reference/hu-chenfeng` 以 submodule 方式引入 [HuChenFeng 全集](https://github.com/Olcmyk/HuChenFeng)

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 构建 | Vite 6 |
| 框架 | Vue 3 (`<script setup>`) |
| 样式 | 原生 CSS 变量 |
| 素材 | `reference/hu-chenfeng` submodule |

## 🚀 本地开发

```bash
# 克隆时初始化 submodule
git clone --recurse-submodules <repo>
# 或对已克隆仓库：
git submodule update --init --recursive

npm install
npm run dev      # 开发服务器（http://localhost:5173）
npm run build    # 生产构建到 dist/
npm run preview  # 预览构建产物
```

## ☁️ 部署

通过根目录 `.cnb.yml` 流水线，push 到 `main` 分支自动构建并部署：

- **构建**：初始化 submodule → `npm ci` → `vite build`
- **公网部署**：将 `dist/` 静态产物同步到腾讯云 COS 对象存储（配合静态网站托管）。
  需配置 `COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`（可选，默认 `ap-guangzhou`）。
  未配置 COS 凭证时仅执行构建，部署自动跳过。

> **路径兼容**：构建产物中的资源（JS / CSS / 音频 / BGM）均使用**相对路径**引用
> （`vite.config.js` 中 `base: "./"`），因此 `dist/` 可部署到任意位置，无需修改代码：
> - GitHub Pages 项目站点（`/hu-chenfeng/` 子路径）
> - Cloudflare Pages（根域名或任意子路径）
> - 对象存储 / 本地静态托管
>
> 只要将 `dist/` 目录整体上传到静态托管服务的根即可正常访问。

## 📝 如何新增一条摘录

选读（Essence）的**每一条内容都独立维护为一个 Markdown 文件**，存放于
`src/data/essence/`。文件采用「YAML front-matter + 正文」的易读格式，前端
`essence.js` 会自动收集该目录下所有以数字命名的 `*.md` 并按 id 升序汇总。
字段说明见 `src/data/essence/README.md`。

在 `src/data/essence/` 新建一个 `<id>.md`（id 取现有最大 id + 1）：

```md
---
id: 11
date: 2025-01-14                 # 直播日期 YYYY-MM-DD
theme: 小地方 / 大城市            # 主题标签（可多个，用空格/、/、/隔开）
source: reference/hu-chenfeng/2025年01月/2025-01-14.md  # 原始出处
audio: audio/quotes/xxx.mp3      # 音频（可选，相对 public，勿带前缀）
video: https://...               # 视频（可选，外链）
links:                           # 外链列表（可选）
  - type: youtube
    label: YouTube
    url: https://...
---
摘录的正文文本……
```

> `source` 路径对应 `reference/hu-chenfeng` submodule 内的文件，便于追溯完整上下文。

## ✍️ 通过 Issue 提交新选读

若不想直接改代码，可通过仓库的 **「提交新选读」** Issue 模板提交，自动生成 PR：

1. 新建 Issue → 选择 **「提交新选读」** 模板
2. 按提示填写 **标题、主题 tag、正文文本** 等必要信息
   （可选：原始出处、音频、外链）

   主题 tag 可直接使用常用标签（节奏、经济、现实、价值观、认知、自述、幸存者偏差、意义、职业等），
   也可自由填写自定义主题词。

   > **多个 tag 怎么隔开？** 支持一条内容挂多个 tag：用「空格」「/」「、」等任一分隔符隔开即可。
   > 例如 `小地方 / 大城市`（两个 tag）或 `小地方 大城市`、`经济、现实`。
   > 前端会把它们渲染成多个独立的 tag 胶囊，点任一个即可按该 tag 检索。
   > 前端已支持多 tag 解析（`src/data/lib/tags.js`），无需额外配置。
3. 提交后，`Submit Selection` 工作流会解析内容、将本条选读生成为
   `src/data/essence/<id>.md` 独立文件，并自动创建一个待合入的 PR

**音频（可选）** 支持三种方式：

- **上传音频文件**：直接在音频字段拖拽/上传二进制音频，工作流会将其下载并
  贴入 `public/audio/quotes/`，`essence.js` 自动引用本地资源
- **外链 URL**：填写 `https://...` 外链，原样保留
- **仓库内路径**：填写如 `public/audio/quotes/xxx.mp3`，自动转成站点资源路径

## 🎵 背景音乐（BGM）

右下角悬浮迷你播放器支持从几首静态 BGM 中任选一首循环播放。曲目配置在
`src/data/bgm.js`，音频文件放入 `public/bgm/` 目录（文件名与配置一致即可）。

受版权限制，仓库默认不托管受版权保护的音频文件；将对应音频放入后播放器即可选择。
详见 `public/bgm/README.md`。

## 📁 项目结构

```
├── index.html                  # Vite 入口 HTML
├── vite.config.js              # Vite 配置
├── reference/                  # 参考资源库（不参与网页展示）
│   ├── HuChenFeng-main.zip     # 户晨风全集文字稿压缩包（不解包读取）
│   ├── lib/                    # JS 读取 API（readFile/readLine/全文迭代器）
│   ├── viewpoints.md           # AI 分析的重要观点列表
│   └── quotations/             # 户晨风语录小文章
├── src/
│   ├── main.js                 # Vue 应用入口
│   ├── App.vue                 # 根组件（栏目导航 + 视图切换）
│   ├── data/essence.js         # 精华摘录数据（meta + 单文件汇总器）
│   ├── data/essence/           # 选读：每条内容一个独立 Markdown 文件
│   ├── data/lib/essence-md.js  # 选读 Markdown 解析/序列化（前端与工作流共用）
│   ├── data/viewpoints.js      # 观点栏目数据（源自 reference/viewpoints.md）
│   ├── data/quotes.js          # 语录栏目数据（源自 reference/quotations/）
│   ├── data/gallery.js         # 展厅栏目数据（图像资源及介绍）
│   ├── data/bgm.js             # 悬浮播放器的 BGM 曲目配置
│   ├── styles/main.css         # 极简全局样式
│   └── components/
│       ├── Masthead.vue        # 页头
│       ├── Toc.vue             # 选读：摘录列表 + 实时检索
│       ├── Entry.vue           # 选读：详情（文本 + 多媒体 + 出处）
│       ├── Viewpoints.vue      # 观点栏目（重要观点列表）
│       ├── Quotes.vue          # 语录栏目（语录小文章）
│       ├── Gallery.vue         # 展厅栏目（图像资料 + 大图灯箱）
│       └── BgmPlayer.vue       # 悬浮迷你 BGM 音乐播放器
├── public/404.html             # 404 页面
├── .cnb.yml                    # CNB 构建部署流水线
└── .github/workflows/          # GitHub Actions 部署
```

## 📚 参考资源库（reference/，不在网页展示）

`reference/` 目录用于存放户晨风直播文字稿的**参考资源**，仅供离线检索、分析与
研究，**不被任何页面组件引用，因此不会展示在网页上**。

- **`HuChenFeng-main.zip`**：户晨风全集（2023–2025，500+ 篇文字稿）压缩包。
  以 zip 归档保存，**不解包**；通过 `reference/lib/reader.js` 按需读取其中
  某个文件、某一行，并提供全文迭代器。
- **`lib/`**：JS 读取模块（`zip-reader.js` 底层解析 + `reader.js` 高层 API）。
  运行示例：`node reference/scripts/demo.js`。
- **`viewpoints.md`**：AI 通读全集后归纳的重要观点列表。
- **`quotations/`**：按主题整理的户晨风语录小文章（忠于原文，保留其语言特点）。

详见 [`reference/README.md`](reference/README.md)。
