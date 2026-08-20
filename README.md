# 户晨风语录 · Loquitur

户晨风的语录集静态站点，像一册泛黄的经文，供翻阅、检索与聆听。

## ✨ 特性

- **纯静态、零依赖**：原生 HTML + CSS + JS，无框架、无构建，首屏秒开，任意静态服务器可直接部署
- **数据驱动**：所有语录集中在 `assets/data/quotes.json`，新增语录无需改页面代码
- **多媒体可选**：每篇语录可独立选择是否附带**音频、视频、超链接**（YouTube / Spotify）
- **艺术化风格**：宋体衬线正文 × 打字机/铜版印刷标题 × 纸质感做旧背景 × 朱砂印章点缀
- **高性能**：视频 iframe 懒加载、音频 `preload="none"`、检索实时过滤

## 🚀 部署

### CNB 直接部署（当前默认）

通过根目录 `.cnb.yml` 流水线，push 到 `main` 分支即自动构建校验并部署：

- **构建校验**：校验站点必需文件齐全、`quotes.json` 数据合法、`main.js` 语法正确。
- **公网部署**：将静态站点同步到腾讯云 COS 对象存储（配合静态网站托管对外访问）。
  需在 CNB 流水线环境变量 / 密钥仓库中配置：
  `COS_SECRET_ID`、`COS_SECRET_KEY`、`COS_BUCKET`、`COS_REGION`（可选，默认 `ap-guangzhou`）。
  未配置 COS 凭证时，流水线仅执行构建校验，部署步骤自动跳过。

### GitHub Actions（后期迁移到 GitHub Pages）

仓库已内置 `.github/workflows/deploy.yml`，迁移到 GitHub 后即可一键发布到 Pages：

1. 把仓库推送到 GitHub
2. 仓库 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**
3. push 到 `main`（或手动触发）后访问 `https://<username>.github.io/<repo>/`

### 本地 / CNB 开发环境预览

```bash
# 方式一：直接跑静态服务器（任选其一）
python3 -m http.server 8000
# 或
npx serve .

# 方式二：使用仓库内置脚本
./scripts/serve.sh 8000
```

> 在 CNB 云原生开发环境中运行 `./scripts/serve.sh` 后，可通过 WebIDE「端口」面板的
> 端口映射 URL（`https://xxx-{{port}}.cnb.run`）直接访问站点。

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
