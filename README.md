# 户晨风语录 · Loquitur

户晨风的语录集静态站点，像一册泛黄的经文，供翻阅、检索与聆听。

基于 **Vite + Vue 3** 构建，采用现代前端工程化技术栈，站在巨人肩膀上打造精致美观的阅读体验。

## ✨ 特性

- **现代化构建**：基于 [Vite](https://vitejs.dev/) + [Vue 3](https://vuejs.org/)，组件化开发、热更新、按需打包
- **数据驱动**：所有语录集中在 `src/data/quotes.json`，新增语录无需改页面代码
- **多媒体可选**：每篇语录可独立选择是否附带**音频、视频、超链接**（YouTube / Spotify）
- **艺术化风格**：宋体衬线正文 × 书法标题 × 纸质感做旧背景 × 朱砂印章点缀
- **高性能**：视频 iframe 懒加载、音频 `preload="none"`、Vue 虚拟列表与过渡动画、检索实时过滤
- **响应式 & 可访问性**：适配移动端，支持 `prefers-reduced-motion` 减少动效偏好

## 🛠 技术栈

| 层 | 技术 |
|----|------|
| 构建 | Vite 6 |
| 框架 | Vue 3 (`<script setup>`) |
| 样式 | 原生 CSS 变量 + scoped 样式 |
| 语言 | ES Modules、现代 JS |

## 🚀 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（热更新，默认 http://localhost:5173）
npm run dev

# 生产构建，产物输出到 dist/
npm run build

# 本地预览构建产物
npm run preview
```

## ☁️ 部署

### CNB 直接部署（当前默认）

通过根目录 `.cnb.yml` 流水线，push 到 `main` 分支即自动构建校验并部署：

- **构建**：`npm ci` 安装依赖 → `vite build` 打包到 `dist/`
- **公网部署**：将 `dist/` 静态产物同步到腾讯云 COS 对象存储（配合静态网站托管对外访问）。
  需在 CNB 流水线环境变量 / 密钥仓库中配置：
  `COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`（可选，默认 `ap-guangzhou`）。
  未配置 COS 凭证时，流水线仅执行构建，部署步骤自动跳过。

### GitHub Actions（后期迁移到 GitHub Pages）

仓库已内置 `.github/workflows/deploy.yml`，会先 `vite build` 再发布 `dist/` 到 Pages：

1. 把仓库推送到 GitHub
2. 仓库 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**
3. push 到 `main`（或手动触发）后访问 `https://<username>.github.io/<repo>/`

## 📝 如何新增一条语录

编辑 `src/data/quotes.json`，在 `quotes` 数组中追加一条：

```json
{
  "id": 9,
  "date": "2025-01-01",
  "category": "哲思",
  "tags": ["智慧"],
  "text": "语录正文……",
  "audio": null,
  "video": "https://www.youtube.com/embed/VIDEO_ID",
  "links": [
    { "type": "youtube", "label": "YouTube", "url": "https://youtu.be/VIDEO_ID" },
    { "type": "spotify", "label": "Spotify", "url": "https://open.spotify.com/track/TRACK_ID" }
  ]
}
```

字段说明：

| 字段 | 必填 | 说明 |
|------|------|------|
| `text` | ✅ | 语录正文 |
| `category` | — | 分类，缺省显示"未分类" |
| `date` | — | 日期，格式 `YYYY-MM-DD` |
| `tags` | — | 标签数组 |
| `audio` | — | 音频文件路径；有则显示播放器 |
| `video` | — | YouTube 内嵌地址（`/embed/`）；有则懒加载视频 |
| `links` | — | 外部链接数组（YouTube / Spotify 等） |

> 音频文件建议放到 `public/` 或 `src/assets/media/` 目录下。

## 📁 项目结构

```
├── index.html              # Vite 入口 HTML
├── vite.config.js          # Vite 配置（别名、分包、构建）
├── src/
│   ├── main.js             # Vue 应用入口
│   ├── App.vue             # 根组件
│   ├── data/quotes.json    # 语录数据
│   ├── styles/main.css     # 全局样式（纸墨印主题）
│   └── components/
│       ├── Masthead.vue    # 页眉 + 检索框
│       └── QuoteCard.vue   # 语录卡片（懒加载视频）
├── public/404.html         # 404 页面
├── .cnb.yml                # CNB 构建部署流水线
└── .github/workflows/      # GitHub Actions 部署
```
