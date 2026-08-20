# 户晨风 · 摘录

户晨风的**精华摘录**静态站点 —— 从 2023–2025 年直播文字稿中手工挑选的只言片语，以**极简主义**的风格呈现，专注文本与多媒体。

基于 **Vite + Vue 3** 构建，干净、留白、克制，无多余装饰。

## ✨ 特性

- **极简主义 UI**：白底、留白、衬线正文，专注内容本身，无纸纹 / 印章 / 装饰性动效
- **精华选读**：仅展示从全集文字稿中摘取的精华片段，安静阅读
- **多媒体可选**：每条摘录可独立附带音频、视频、外链
- **追溯出处**：每条摘录标注原始出处，可一键跳转到 HuChenFeng 全集对应章节
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

## 📝 如何新增一条摘录

编辑 `src/data/essence.js`，在 `essence` 数组中追加一条：

```js
{
  id: 11,
  date: "2025-01-14",                          // 直播日期 YYYY-MM-DD
  theme: "节奏",                                // 主题标签
  text: "摘录的正文……",                         // 文本
  source: "reference/hu-chenfeng/2025年01月/2025-01-14.md", // 原始出处
  audio: null,                                  // 音频路径（可选）
  video: "https://www.youtube.com/embed/VIDEO_ID",          // 视频（可选）
  links: [                                      // 外链（可选）
    { type: "youtube", label: "YouTube", url: "..." }
  ]
}
```

> 出处路径对应 `reference/hu-chenfeng` submodule 内的文件，便于追溯完整上下文。

## 📁 项目结构

```
├── index.html                  # Vite 入口 HTML
├── vite.config.js              # Vite 配置
├── reference/hu-chenfeng       # HuChenFeng 全集 submodule
├── src/
│   ├── main.js                 # Vue 应用入口
│   ├── App.vue                 # 根组件（列表 / 详情视图切换）
│   ├── data/essence.js         # 精华摘录数据（含 meta）
│   ├── styles/main.css         # 极简全局样式
│   └── components/
│       ├── Masthead.vue        # 页头
│       ├── Toc.vue             # 摘录列表
│       └── Entry.vue           # 详情（文本 + 多媒体 + 出处）
├── public/404.html             # 404 页面
├── .cnb.yml                    # CNB 构建部署流水线
└── .github/workflows/          # GitHub Actions 部署
```
