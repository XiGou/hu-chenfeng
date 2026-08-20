# 户晨风语录 · Loquitur

户晨风的语录集静态站点，像一册泛黄的经文，供翻阅、检索与聆听。

## ✨ 特性

- **纯静态、零依赖**：原生 HTML + CSS + JS，无框架、无构建，首屏秒开，任意静态服务器可直接部署
- **数据驱动**：所有语录集中在 `assets/data/quotes.json`，新增语录无需改页面代码
- **多媒体可选**：每篇语录可独立选择是否附带**音频、视频、超链接**（YouTube / Spotify）
- **艺术化风格**：宋体衬线正文 × 打字机/铜版印刷标题 × 纸质感做旧背景 × 朱砂印章点缀
- **高性能**：视频 iframe 懒加载、音频 `preload="none"`、检索实时过滤

## 🚀 部署

### GitHub Pages

1. 把仓库推送到 GitHub
2. 仓库 `Settings → Pages` 选择部署分支（如 `main`）的根目录
3. 访问 `https://<username>.github.io/<repo>/`

### 本地预览

```bash
# 任选一个静态服务器
python3 -m http.server 8000
# 或
npx serve .
```

## 📝 如何新增一条语录

编辑 `assets/data/quotes.json`，在 `quotes` 数组中追加一条：

```json
{
  "id": 6,
  "date": "2025-01-01",
  "category": "哲思",
  "tags": ["智慧"],
  "text": "语录正文……",
  "audio": "assets/media/quote-6.mp3",
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

> 音频文件建议放到 `assets/media/` 目录下。
