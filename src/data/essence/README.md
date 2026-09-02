# Essence · 选读数据

本目录维护「选读（Essence）」栏目内容。**每一条选读内容对应一个独立的
Markdown 文件**（以数字 id 命名，如 `1.md`、`12.md`），采用「YAML
front-matter + 正文」的易读格式。`src/data/essence.js` 会通过
`import.meta.glob` 自动收集本目录下所有数字命名的 `*.md`，按 id 升序展示。

## 文件格式

```md
---
id: 1                      # 必填 · 数字 id（唯一、升序）
title: 关于人生节奏的一段话  # 可选 · 简短标题（列表/详情页突出展示；也用作音频文件名）
date: 2025-01-14           # 可选 · 直播日期 YYYY-MM-DD
theme: 节奏                # 可选 · 主题标签（可含多个，用空格/、/、/等分隔）
source: reference/hu-chenfeng/2025年01月/2025-01-14.md  # 可选 · 原始出处
audio: audio/quotes/2025-01-14.mp3  # 可选 · 站点音频资源路径（相对 public，勿带 public/ 前缀）
video: https://...         # 可选 · 外链视频
links:                     # 可选 · 外链列表
  - type: youtube
    label: 完整直播录像
    url: https://...
---
（此处为摘录正文 text，保留换行与空行）
```

- **front-matter** 中的 `#` 为注释，`audio`/`video` 仅保留单行值。
- `title` 为可选的简短标题：前端「选读」列表主要展示标题（点进去才展示完整正文），
  无 `title` 时列表回退展示正文；提交选读时也会用标题清洗后作为音频基础文件名。
- `theme` 为主题标签，可填**一个或多个**；多个时用「空格」「/」「、」等任一分隔符隔开，
  前端会渲染成多个独立 tag 并支持点按检索。例如：
  - 一个：`theme: 节奏`
  - 两个：`theme: 小地方 / 大城市`
  - 也可写作：`theme: 小地方 大城市` 或 `theme: 经济、现实`
- `audio` 一律填**相对 `public/` 的仓库内资源路径**（如 `audio/quotes/xx.mp3`）；
  构建时会自动拼接站点 `BASE_URL`。**不允许**以 `http(s)://` 外链形式保留，
  外链音频须先下载并 commit 进 `public/audio/quotes/`。
- 正文（front-matter 结束的 `---` 之后）即摘录文本 `text`，可含换行。

## 命名与 id

文件名为 `<id>.md`（如 `3.md`）。id 需唯一且升序；新增时取现有最大 id + 1。
`README.md` 等说明文件因不以数字开头，不会被 glob 收集为选读。

## 如何新增

- **人工方式**：按上述格式在 `src/data/essence/` 新建一个 `<id>.md` 并提交 PR。
- **Issue 方式（推荐）**：在仓库新建「提交新选读」Issue（带「选读」标签），
  `Submit Selection` 工作流会自动把内容生成为 `src/data/essence/<id>.md` 并建 PR。
