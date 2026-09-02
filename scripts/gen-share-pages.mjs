#!/usr/bin/env node
/**
 * gen-share-pages.mjs — 为每条「选读」生成独立静态分享页
 *
 * 读取 src/data/essence/<id>.md（front-matter + 正文），为每条生成
 *   dist/选读/<id>.html
 * 一个独立静态 HTML，内嵌：
 *   - OG / Twitter Card meta 标签（含 og:audio / twitter:card=player）
 *   - 原生 <audio controls> 播放器
 *   - 标题、日期、主题、正文
 *
 * 供分享到 X/Twitter 等外部平台时，预览卡片直接可点播音频。
 *
 * 用法：
 *   node scripts/gen-share-pages.mjs                # 默认扫描 src/data/essence
 *   ESSENCE_DIR=xx node scripts/gen-share-pages.mjs # 覆盖目录
 *   OUT_DIR=xx node scripts/gen-share-pages.mjs     # 覆盖输出目录
 *   SITE_URL=https://example.com  node scripts/gen-share-pages.mjs  # 指定站点绝对地址（og:url / twitter:player 会用它）
 *   # 若不设 SITE_URL，页面会在浏览器运行时用 location.origin 自动补齐绝对地址，
 *   #   og:url / og:audio 等写成相对当前页的链接；大部分平台（含 X 爬虫）能正确解析。
 *
 * 无真实选读数据时脚本正常退出（打印提示），不会报错，保证构建通过。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 与 vite.config.js 保持一致（相对部署的静态基址）
const ESSENCE_DIR = process.env.ESSENCE_DIR || path.join(ROOT, 'src/data/essence');
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'dist');
// 站点绝对基址（可选）。若为空，页面运行时用 location 补齐。
const SITE_URL = (process.env.SITE_URL || '').trim().replace(/\/+$/, '');
// 分享页目录名：路径形如 站点/选读/1.html
const DIR_NAME = '选读';
// 复用仓库的 front-matter 解析器（纯函数）
import { parseMarkdownItem } from '../src/data/lib/essence-md.js';

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

/** 去除音频值前导的 public/ 前缀，保证为「相对 public 的站点资源路径」 */
function cleanAudioPath(audio) {
  if (!audio) return '';
  let p = audio.trim();
  if (p.startsWith('public/')) p = p.slice('public/'.length);
  if (p.startsWith('/')) p = p.slice(1);
  return p;
}

/** 判断是否为外链 URL */
function isExternalUrl(s) {
  return /^https?:\/\//.test(s || '');
}

/** HTML 转义 */
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 文本截断到 ~len 字符（中文按字符计） */
function truncate(s, len = 80) {
  s = String(s || '');
  return s.length > len ? s.slice(0, len) + '…' : s;
}

/** 极简 Markdown → HTML（与前端 md-render.js 保持一致的语义子集） */
function renderMarkdown(text) {
  const src = String(text || '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const blocks = [];
  let i = 0;
  const n = lines.length;
  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const renderInline = (line) => {
    let html = esc(line);
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
    return html;
  };
  while (i < n) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const trimmed = line.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const lv = heading[1].length;
      blocks.push(`<h${lv}>${renderInline(heading[2])}</h${lv}>`);
      i++;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      const buf = [];
      while (i < n && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(`<blockquote>${buf.map(renderInline).join('<br>')}</blockquote>`);
      continue;
    }
    const isOl = /^\d+[.)]\s+/.test(trimmed);
    const isUl = /^[-*]\s+/.test(trimmed);
    if (isOl || isUl) {
      const tag = isUl ? 'ul' : 'ol';
      const items = [];
      while (i < n && /^(\d+[.)]|[-*])\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInline(lines[i].trim().replace(/^(\d+[.)]|[-*])\s+/, ''))}</li>`);
        i++;
      }
      blocks.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }
    const para = [];
    while (i < n) {
      const cur = lines[i];
      if (!cur.trim()) break;
      const ct = cur.trim();
      if (/^(#{1,3})\s/.test(ct) || /^>\s?/.test(ct)) break;
      if (/^(\d+[.)]|[-*])\s+/.test(ct)) break;
      para.push(renderInline(cur));
      i++;
    }
    blocks.push(`<p>${para.join('<br>')}</p>`);
  }
  return blocks.join('\n');
}

/** 主题拆分（与前端 tags.js 一致的切分逻辑） */
function splitThemes(theme) {
  if (!theme) return [];
  return theme.split(/[\s/、，,|;；]+/).map((s) => s.trim()).filter(Boolean);
}

/** 日期格式化（同前端）：2025-01-14 → 2025 年 1 月 14 日 */
function fmtDate(d) {
  if (!d) return '';
  const p = String(d).split('-');
  if (p.length === 3) return `${p[0]} 年 ${Number(p[1])} 月 ${Number(p[2])} 日`;
  return d;
}

/** 对分享页所在路径求「从分享页指向公共资源根（dist/）的相对路径」 */
function relToDist(filePath) {
  const rel = path.relative(path.dirname(filePath), OUT_DIR);
  const norm = rel.split(path.sep).join('/');
  return norm === '' ? '.' : norm;
}

/** 绝对路径的原始音频 URL（从 SITE_URL 派生） */
function absoluteAudioUrl(audioSitePath, siteUrl, sharePageRelPath) {
  // audioSitePath 为相对 public/ 的路径，站点部署后即相对于站点根
  if (!audioSitePath) return '';
  if (isExternalUrl(audioSitePath)) return audioSitePath;
  if (siteUrl) return `${siteUrl}/${audioSitePath}`.replace(/([^:])\/+/g, '$1/');
  // 无 SITE_URL → 用相对路径，运行时由 <script> 补齐
  return sharePageRelPath + '/' + audioSitePath;
}

// ---------------------------------------------------------------------------
// 扫描 essence 单文件并生成
// ---------------------------------------------------------------------------

function collectEssence(dir) {
  if (!fs.existsSync(dir)) return [];
  const items = [];
  for (const name of fs.readdirSync(dir)) {
    const m = /^(\d+)\.md$/.exec(name);
    if (!m) continue; // 跳过 README 等非数字文件
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      const item = parseMarkdownItem(raw);
      if (typeof item.id !== 'number') continue;
      items.push(item);
    } catch (e) {
      console.warn(`[gen-share-pages] 跳过解析 ${name}: ${e.message}`);
    }
  }
  return items.sort((a, b) => a.id - b.id);
}

/** 生成单条分享页 HTML 字符串 */
function buildShareHtml(item) {
  const { id, title = '', date = '', theme = '', source = '', audio = '', text = '' } = item;

  const themes = splitThemes(theme);
  const body = renderMarkdown(text);
  const textPreview = truncate(String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).join(' '), 120);
  const pageTitle = title ? `${title} · 户晨风` : `户晨风 · 选读 #${id}`;
  const description = title ? `${title} —— ${textPreview}` : textPreview;
  const displayTitle = title || `选读 #${id}`;

  const shareFile = path.join(OUT_DIR, DIR_NAME, `${id}.html`);
  const relRoot = relToDist(shareFile); // 从分享页 → dist/ 的相对路径

  // 音频：分「外链URL」「仓库资源（相对 public/，构建后位于 dist/ 根）」两种情况
  const audioClean = cleanAudioPath(audio);
  let audioUrl = '';      // 页面内 <audio> 的 src（相对本页）
  let audioAbsUrl = '';   // og:audio 等需要的绝对/相对站点 URL

  if (isExternalUrl(audioClean)) {
    audioUrl = audioClean;
    audioAbsUrl = audioClean;

  } else if (audioClean) {
    // 相对 dist 根的音频：../audio/quotes/x.mp3
    audioUrl = relRoot + '/' + audioClean;
    audioAbsUrl = absoluteAudioUrl(audioClean, SITE_URL, relRoot);
  }

  // 页面的绝对地址（og:url / twitter:player 用）
  const pageRel = `${DIR_NAME}/${id}.html`;
  const ogUrl = SITE_URL ? `${SITE_URL}/${pageRel}` : pageRel;
  // twitter:player 需要一个可 iframe 的页面（这里就指向当前分享页）
  const playerUrl = SITE_URL ? `${SITE_URL}/${pageRel}` : pageRel;
  // 主题标签 HTML
  const themeHtml = themes.length
    ? themes.map((t) => `<span class="tag">${escHtml(t)}</span>`).join('')
    : '';

  // 日期
  const dateHtml = fmtDate(date) ? `<time>${escHtml(fmtDate(date))}</time>` : '';

  // 正文（去掉最外层包裹 p 的多余行为已由 renderMarkdown 处理好）
  const contentHtml = body || '<p>（本条暂无正文。）</p>';

  // 返回链接 — 站点根 index.html，可能部署于子路径下，用相对路径
  const backHref = relRoot + '/index.html';

  const themesAttr = themeHtml ? `<div class="tags">${themeHtml}</div>` : '';

  // og:type —— 有音频用 music.song，无音频用 article
  const ogType = audioAbsUrl ? 'music.song' : 'article';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(pageTitle)}</title>
  <meta name="description" content="${escHtml(description)}">
  <meta name="theme-color" content="#ffffff">

  <!-- ======== Open Graph ======== -->
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${escHtml(displayTitle)}">
  <meta property="og:description" content="${escHtml(description)}">
  <meta property="og:site_name" content="户晨风 · 摘录">
  <meta property="og:url" content="${escHtml(ogUrl)}">
  ${dateHtml ? `<meta property="og:article:published_time" content="${escHtml(date)}">` : ''}
  ${audioAbsUrl ? `
  <meta property="og:audio" content="${escHtml(audioAbsUrl)}">
  <meta property="og:audio:secure_url" content="${escHtml(audioAbsUrl)}">
  <meta property="og:audio:type" content="audio/mpeg">` : ''}

  <!-- ======== Twitter / X Card ======== -->
  ${audioAbsUrl ? `
  <meta name="twitter:card" content="player">
  <meta name="twitter:player" content="${escHtml(playerUrl)}">
  <meta name="twitter:player:width" content="600">
  <meta name="twitter:player:height" content="400">
  <meta name="twitter:title" content="${escHtml(displayTitle)}">
  <meta name="twitter:description" content="${escHtml(description)}">` : `
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escHtml(displayTitle)}">
  <meta name="twitter:description" content="${escHtml(description)}">`}
  ${audioAbsUrl ? `<meta name="twitter:player:stream" content="${escHtml(audioAbsUrl)}">` : ''}

  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: #ffffff;
      color: #1a1a1a;
      line-height: 1.8;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 48px 24px 80px;
    }
    .brand {
      display: block;
      font-size: 13px;
      letter-spacing: 0.15em;
      color: #999;
      text-decoration: none;
      margin-bottom: 28px;
    }
    .brand:hover { color: #f0502f; }
    .meta {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 12px;
      margin-bottom: 14px;
      font-size: 14px;
      color: #888;
    }
    .meta time { color: #aaa; }
    .tags { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .tag {
      background: #f2f3f5;
      border-radius: 999px;
      padding: 2px 12px;
      font-size: 12px;
      color: #555;
      white-space: nowrap;
    }
    h1 {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.4;
      margin-bottom: 20px;
      color: #111;
      letter-spacing: -0.01em;
    }
    /* 音频 */
    .audio-wrap {
      margin: 20px 0 24px;
      padding: 16px 16px 12px;
      background: #fafafa;
      border: 1px solid #eee;
      border-radius: 12px;
    }
    .audio-wrap audio {
      display: block;
      width: 100%;
      height: 40px;
      outline: none;
    }
    .audio-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #999;
      margin-bottom: 8px;
    }
    .audio-hint .play-icon { color: #f0502f; font-size: 14px; }
    .audio-hint .tip { color: #888; }

    /* 正文 */
    .content {
      font-size: 17px;
      color: #2d2d2d;
      letter-spacing: 0.01em;
    }
    .content p { margin: 0 0 1.1em; }
    .content blockquote {
      border-left: 3px solid #ddd;
      padding-left: 16px;
      color: #666;
      font-style: italic;
      margin: 0 0 1.1em;
    }
    .content h1,.content h2,.content h3 {
      margin: 1.4em 0 0.6em;
      font-size: 1.2em;
      font-weight: 600;
    }
    .content ul,.content ol { margin: 0 0 1.1em; padding-left: 1.6em; }
    .content li { margin-bottom: 0.3em; }
    .content code {
      background: #f4f4f5;
      padding: 1px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
    .source {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #eee;
      font-size: 13px;
      color: #bbb;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-top: 32px;
      font-size: 14px;
      color: #555;
      text-decoration: none;
    }
    .back-link:hover { color: #f0502f; }
    .back-link svg { width: 14px; height: 14px; }
    footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
      font-size: 12px;
      color: #ccc;
      text-align: center;
    }
    @media (max-width: 640px) {
      .container { padding: 32px 20px 60px; }
      h1 { font-size: 24px; }
      .content { font-size: 16px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <a class="brand" href="${escHtml(backHref)}">户晨风 · 摘录</a>

    <div class="meta">
      ${dateHtml}
      ${themesAttr}
    </div>

    <h1>${escHtml(displayTitle)}</h1>

    ${audioAbsUrl ? `
    <div class="audio-wrap">
      <div class="audio-hint">
        <span class="play-icon">♪</span>
        <span class="tip">点击播放音频</span>
      </div>
      <audio controls preload="metadata" src="${escHtml(audioUrl)}"></audio>
    </div>` : ''}

    <div class="content">${contentHtml}</div>

    ${source ? `<div class="source">出处：${escHtml(source)}</div>` : ''}

    <a class="back-link" href="${escHtml(backHref)}">← 返回全部选读</a>

    <footer>户晨风 · 摘录 — 安静阅读，边读边听。</footer>
  </div>

  <script>
    // 无 SITE_URL 时，运行时用当前页面的 location 将相对 URL 补齐为绝对地址。
    // 分享页的 og:url/twitter:player 值为「相对站点根的路径」（如 选读/1.html），
    // og:audio/twitter:player:stream 值为「相对本页目录的路径」（如 ../bgm/x.mp3）。
    (function () {
      var hasSite = ${SITE_URL ? 'true' : 'false'};
      if (hasSite) return;
      var pageDir = location.href.slice(0, location.href.lastIndexOf('/') + 1);
      var patch = function (sel, base) {
        var el = document.querySelector(sel);
        if (el && el.content && el.content.indexOf('://') < 0) {
          el.content = new URL(el.content, base).toString();
        }
      };
      // 当前目录名
      var dir = ${JSON.stringify(DIR_NAME)};
      // 找当前页面在站点根下的路径
      var pathParts = location.pathname.split('/').filter(Boolean);
      var root = location.origin;
      var i = 0;
      // 找到 "选读" 目录出现的位置，站点根 = origin + (之前的路径段)
      for (; i < pathParts.length; i++) {
        if (decodeURIComponent(pathParts[i]) === dir) break;
        root += '/' + pathParts[i];
      }
      root += '/';
      // og:url / twitter:player —— 相对站点根
      patch('meta[property="og:url"]', root);
      patch('meta[name="twitter:player"]', root);
      // og:audio / twitter:player:stream —— 相对当前页
      patch('meta[property="og:audio"]', pageDir);
      patch('meta[property="og:audio:secure_url"]', pageDir);
      patch('meta[name="twitter:player:stream"]', pageDir);
    })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function main() {
  const items = collectEssence(ESSENCE_DIR);
  if (!items.length) {
    console.log('[gen-share-pages] 未发现真实选读数据，跳过分享页生成。');
    return;
  }
  const dir = path.join(OUT_DIR, DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });

  let count = 0;
  for (const item of items) {
    const file = path.join(dir, `${item.id}.html`);
    const html = buildShareHtml(item);
    fs.writeFileSync(file, html, 'utf8');
    count++;
    console.log(`[gen-share-pages] ✔ 生成 ${path.relative(ROOT, file)}`);
  }
  console.log(`[gen-share-pages] 共生成 ${count} 个分享页。`);
}

main();
