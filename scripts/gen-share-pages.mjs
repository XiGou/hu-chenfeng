#!/usr/bin/env node
/**
 * gen-share-pages.mjs — 用生成器把站点里的「选读」详情静态化为独立 HTML
 *
 * 读取 src/data/essence/<id>.md（front-matter + 正文），为每条生成
 *   dist/选读/<id>.html
 * 一个可直接独立访问的静态详情页（既是站内详情，也可作为分享/被爬取的地址，
 * 无需再单独维护一套“给 X 用的分享页”）。页面内嵌：
 *   - OG / Twitter Card meta：og:title/description/audio，以及 og:image/twitter:image
 *     —— 预览图从 public/gallery/ 里按选读 id 确定性随机任选一张；
 *   - Twitter 卡片用 summary_large_image（X 无需白名单即可稳定出“大图+标题”预览，
 *     og:audio 直链让支持音频的平台可直接点播；twitter:card=player 需 X 白名单，故不使用）
 *   - og:video / twitter:player 直链：若构建阶段已由 scripts/gen-quote-videos.mjs 为该条选读
 *     用 ffmpeg 合成 dist/videos/quotes/<id>.mp4（同封面 gallery 图 + 音频），则附加视频直链，
 *     供支持视频内嵌预览的平台（如 X、部分 IM / 社交）展示；网页内仍用纯 <audio> 播放、不嵌视频。
 *   - 原生 <audio controls> 播放器 + 展厅预览图 + 标题/日期/主题/正文（含 video/links 媒体）
 *
 * 另外会给首页 dist/index.html 补写基础 OG/Twitter meta（含一张 gallery 预览图），
 * 使“分享站点首页”也能出预览卡片。
 *
 * 用法：
 *   node scripts/gen-share-pages.mjs                # 默认扫描 src/data/essence
 *   ESSENCE_DIR=xx node scripts/gen-share-pages.mjs # 覆盖目录
 *   OUT_DIR=xx node scripts/gen-share-pages.mjs     # 覆盖输出目录
 *   SITE_URL=https://example.com  node scripts/gen-share-pages.mjs
 *     # 指定站点绝对地址，og:url / og:image / og:audio 等直接烘成绝对 https。
 *     # X 等平台的爬虫不执行 JS，要让预览卡片真正出图/可点播，务必在构建时配置 SITE_URL
 *     #（.cnb.yml 会在配置 SITE_URL 或 COS_BUCKET 时自动推导）。未配置则退化为相对路径，
 *     #   仅浏览器/支持渲染的抓取器能自动补齐。
 *
 * 无真实选读数据时脚本仍会给首页注入 og meta，然后正常退出，保证构建通过。
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
// 注意：X/Twitter 等平台爬虫不执行 JS，og:url/og:image/og:audio 必须烘成绝对 https 才能出预览卡片。
// 因此当未显式配置 SITE_URL 时，默认回退到生产站点域名（可用环境变量 SITE_URL 覆盖，便于复用部署到其它域名/子路径）。
const _DEFAULT_SITE = 'https://hu-chenfeng.19960312.xyz';
const SITE_URL = (process.env.SITE_URL || _DEFAULT_SITE).trim().replace(/\/+$/, '');
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


// ---------------------------------------------------------------------------
// 展厅预览图 · gallery
// 从 public/gallery/ 挑选一张作为该页面的 OG / Twitter 预览图（og:image）。
// 规则：以选读 id 作「确定性种子」，在 gallery 大图中任选一张 ——
//   · 同一 id 每次构建都稳定选到同一张（避免反复构建导致 meta 抖动、平台缓存失效）
//   · 不同 id 落在不同位置，观感上呈随机分布
// ---------------------------------------------------------------------------
let _galleryCache = null;
function getGalleryImages() {
  if (_galleryCache) return _galleryCache;
  const gDir = path.join(ROOT, 'public', 'gallery');
  if (!fs.existsSync(gDir)) { _galleryCache = []; return _galleryCache; }
  // 只取顶层大图（imgN.png），排除 thumbs/ 缩略子目录
  const files = fs.readdirSync(gDir)
    .filter((f) => /^img\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/^img(\d+)\.png$/i)[1]);
      const nb = Number(b.match(/^img(\d+)\.png$/i)[1]);
      return na - nb;
    });
  _galleryCache = files.map((f) => 'gallery/' + f); // 相对站点根的静态资源路径
  return _galleryCache;
}

/** 由 seed 派生的确定性下标，在 [0,len) 内「伪随机」挑一个 */
function pickGalleryIndex(seed, len) {
  if (len <= 0) return -1;
  // Knuth 乘法散列：相邻 id 会落到不同图，形成稳定而分散的选择
  const h = (Math.imul(seed || 0, 2654435761) >>> 0);
  return h % len;
}

/** 生成单条分享页 HTML 字符串 */
function buildShareHtml(item) {
  const { id, title = '', date = '', theme = '', source = '', note = '', audio = '', text = '', video = '', links = [] } = item;

  const themes = splitThemes(theme);
  const body = renderMarkdown(text);
  const textPreview = truncate(String(text || '').split('\n').map((l) => l.trim()).filter(Boolean).join(' '), 120);
  const pageTitle = title ? `${title} · 户晨风` : `户晨风 · 选读 #${id}`;
  const description = title ? `${title} —— ${textPreview}` : textPreview;
  const displayTitle = title || `选读 #${id}`;

  const shareFile = path.join(OUT_DIR, DIR_NAME, `${id}.html`);
  const relRoot = relToDist(shareFile); // 从分享页 → dist/ 的相对路径

  // 视频（og:video）：若构建阶段已由 scripts/gen-quote-videos.mjs 为该 id 合成
  // dist/videos/quotes/<id>.mp4，则此处带上 og:video 直链，供支持视频预览的平台展示
  //（网页内仍用纯 <audio> 播放，不在页面里 <video>；封面沿用 gallery 预览图）。
  const quoteVideoFile = path.join(OUT_DIR, 'videos', 'quotes', `${id}.mp4`);
  const hasVideo = fs.existsSync(quoteVideoFile);

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

  // 页面的站点相对地址（og:url 用；配 SITE_URL 时烘成绝对 https）
  const pageRel = `${DIR_NAME}/${id}.html`;
  const ogUrl = SITE_URL ? `${SITE_URL}/${pageRel}` : pageRel;
  // 主题标签 HTML
  const themeHtml = themes.length
    ? themes.map((t) => `<span class="tag">${escHtml(t)}</span>`).join('')
    : '';

  // 日期
  const dateHtml = fmtDate(date) ? `<time>${escHtml(fmtDate(date))}</time>` : '';

  // 正文（去掉最外层包裹 p 的多余行为已由 renderMarkdown 处理好）
  const contentHtml = body || '<p>（本条暂无正文。）</p>';

  // 媒体区：外链视频（iframe）+ 关联链接（与站内 Entry 一致）
  const mediaParts = [];
  if (video) {
    mediaParts.push(`<div class="media-video"><iframe src="${escHtml(video)}" title="${escHtml(displayTitle)}" loading="lazy" allowfullscreen allow="encrypted-media; picture-in-picture"></iframe></div>`);
  }
  if (Array.isArray(links) && links.length) {
    const lis = links
      .filter((l) => l && l.url)
      .map((l) => `<a class="media-link" href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer"><span>${escHtml((l.type||'').slice(0,1)||'↗')}</span>${escHtml(l.label || l.type || '链接')}</a>`)
      .join('');
    if (lis) mediaParts.push(`<div class="media-links">${lis}</div>`);
  }
  const mediaHtml = mediaParts.length ? `<div class="media">${mediaParts.join('')}</div>` : '';


  // 返回链接 — 站点根 index.html，可能部署于子路径下，用相对路径
  const backHref = relRoot + '/index.html';

  const themesAttr = themeHtml ? `<div class="tags">${themeHtml}</div>` : '';

  // og:type —— 有视频用 video.other（供视频预览）；否则有音频用 music.song；再否则 article
  const ogType = hasVideo ? 'video.other' : (audioAbsUrl ? 'music.song' : 'article');

  // 展厅预览图（og:image）：每个页面从 gallery 里确定性随机任选一张
  const galleryImages = getGalleryImages();
  let imageSitePath = ''; // 相对站点根：gallery/imgN.png
  let imageAbsUrl = '';   // og:image 需要的绝对/相对站点 URL
  let imageRelUrl = '';   // 相对本页：../gallery/imgN.png（页面内 <img> 用）
  if (galleryImages.length) {
    const gi = pickGalleryIndex(id || 0, galleryImages.length);
    imageSitePath = galleryImages[gi];
    imageRelUrl = relRoot + '/' + imageSitePath; // 相对本页，供页面内 <img>
    // og:image —— 配了 SITE_URL 用绝对 URL；未配则用「相对本页」路径，
    // 使爬虫能基于真实页面 URL（站点/选读/<id>.html）解析到站点/gallery/<n>.png
    imageAbsUrl = SITE_URL
      ? `${SITE_URL}/${imageSitePath}`.replace(/([^:])\/+/g, '$1/')
      : imageRelUrl;
  }

  // 视频直链（og:video）：站点相对路径 videos/quotes/<id>.mp4，配 SITE_URL 烘成绝对 https
  const videoSitePath = `videos/quotes/${id}.mp4`;
  let videoAbsUrl = '';
  if (hasVideo) {
    videoAbsUrl = SITE_URL
      ? `${SITE_URL}/${videoSitePath}`.replace(/([^:])\/+/g, '$1/')
      : relRoot + '/' + videoSitePath; // 无 SITE_URL 用相对本页，运行时 JS 补齐
  }

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
  ${imageAbsUrl ? `
  <meta property="og:image" content="${escHtml(imageAbsUrl)}">
  <meta property="og:image:secure_url" content="${escHtml(imageAbsUrl)}">
  <meta property="og:image:alt" content="${escHtml(displayTitle)}">` : ''}
  ${videoAbsUrl ? `
  <meta property="og:video" content="${escHtml(videoAbsUrl)}">
  <meta property="og:video:secure_url" content="${escHtml(videoAbsUrl)}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">` : ''}

  <!-- ======== Twitter / X Card ======== -->
  ${imageAbsUrl ? `
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escHtml(displayTitle)}">
  <meta name="twitter:description" content="${escHtml(description)}">
  <meta name="twitter:image" content="${escHtml(imageAbsUrl)}">` : `
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escHtml(displayTitle)}">
  <meta name="twitter:description" content="${escHtml(description)}">`}
  ${videoAbsUrl ? `
  <meta name="twitter:player" content="${escHtml(videoAbsUrl)}">
  <meta name="twitter:player:stream" content="${escHtml(videoAbsUrl)}">
  <meta name="twitter:player:stream:type" content="video/mp4">
  <meta name="twitter:player:width" content="1280">
  <meta name="twitter:player:height" content="720">` : ''}

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
    .brand:hover { color: #111; }
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
    /* 编者批注 */
    .editor-note {
      margin: 0 0 24px;
      padding: 12px 16px;
      background: #faf8f2;
      border: 1px solid #efe7d3;
      border-left: 3px solid #c9b458;
      border-radius: 8px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
    .editor-note-mark {
      flex: 0 0 auto;
      font-size: 12px;
      color: #8a7a3a;
      border: 1px solid #e0d3a8;
      background: #fff;
      border-radius: 999px;
      padding: 1px 10px;
      margin-top: 3px;
      letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .editor-note p {
      margin: 0;
      font-size: 14px;
      color: #6b5f3a;
      line-height: 1.7;
    }
    /* 展厅预览图 */
    .preview {
      margin: 4px 0 24px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #ececec;
      background: #fafafa;
      text-align: center;
    }
    .preview img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 460px;
      object-fit: contain;
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
    .audio-hint .play-icon { color: #111; font-size: 14px; }
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
    .media { margin: 24px 0 4px; }
    .media-video { position: relative; padding-top: 56.25%; border-radius: 12px; overflow: hidden; background:#000; margin-bottom: 16px; }
    .media-video iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    .media-links { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
    .media-link {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border: 1px solid #ececec; border-radius: 999px;
      color: #333; text-decoration: none; font-size: 14px;
    }
    .media-link span { color: #999; }
    .media-link:hover { border-color: #111; color: #111; }
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
    .back-link:hover { color: #111; }
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

    ${note ? `
    <div class="editor-note" role="note">
      <span class="editor-note-mark">编者注</span>
      <p>${escHtml(note)}</p>
    </div>` : ''}

    ${imageRelUrl ? `
    <figure class="preview">
      <img src="${escHtml(imageRelUrl)}" alt="${escHtml(displayTitle)}" loading="lazy">
    </figure>` : ''}

    ${audioAbsUrl ? `
    <div class="audio-wrap">
      <div class="audio-hint">
        <span class="play-icon">♪</span>
        <span class="tip">点击播放音频</span>
      </div>
      <audio controls preload="metadata" src="${escHtml(audioUrl)}"></audio>
    </div>` : ''}

    <div class="content">${contentHtml}</div>

    ${mediaHtml}

    ${source ? `<div class="source">出处：${escHtml(source)}</div>` : ''}

    <a class="back-link" href="${escHtml(backHref)}">← 返回全部选读</a>

    <footer>户晨风 · 摘录 — 安静阅读，边读边听。</footer>
  </div>

  <script>
    // 无 SITE_URL 时，运行时用当前页面的 location 将相对 URL 补齐为绝对地址
    //（对不执行 JS 的 X 爬虫无效，仅作浏览器/支持渲染的抓取兜底；
    //  生产建议在构建时配置 SITE_URL，让 og:url/og:image 直接烘成绝对 https）。
    // og:url 为「相对站点根的路径」（如 选读/1.html）；
    // og:audio / og:image 为「相对本页目录的路径」（如 ../audio/quotes/x.mp3、../gallery/imgN.png）。
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
      // og:url —— 相对站点根（如 选读/1.html）
      patch('meta[property="og:url"]', root);
      // og:audio / og:image —— 相对当前页目录（如 ../audio/...、../gallery/imgN.png）
      patch('meta[property="og:audio"]', pageDir);
      patch('meta[property="og:audio:secure_url"]', pageDir);
      patch('meta[property="og:image"]', pageDir);
      patch('meta[property="og:image:secure_url"]', pageDir);
      // og:video / twitter:player —— 相对当前页目录（如 ../videos/quotes/<id>.mp4）
      patch('meta[property="og:video"]', pageDir);
      patch('meta[property="og:video:secure_url"]', pageDir);
      patch('meta[name="twitter:player"]', pageDir);
      patch('meta[name="twitter:player:stream"]', pageDir);
    })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * 给首页 dist/index.html 补写 Open Graph / Twitter 基础 meta（含一张 gallery 预览图），
 * 让“分享整站/首页”时也能出预览卡片。幂等：已含相关 meta 则跳过。
 */
function injectIndexOg() {
  const file = path.join(OUT_DIR, 'index.html');
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');

  const galleryImages = getGalleryImages();
  const hasOgTitle = /property="og:title"/.test(html);

  if (hasOgTitle) return; // 已注入过

  const ogUrl = SITE_URL ? `${SITE_URL}/index.html` : 'index.html';
  const imageSite = galleryImages.length
    ? galleryImages[pickGalleryIndex(0, galleryImages.length)]
    : '';
  const ogImage = SITE_URL && imageSite
    ? `${SITE_URL}/${imageSite}`.replace(/([^:])\/+/g, '$1/')
    : imageSite;

  const ogBlock = [
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="户晨风 · 摘录">',
    '<meta property="og:description" content="户晨风直播文字稿精华摘录：选读 / 观点 / 语录 / 展厅。安静阅读，边读边听。">',
    '<meta property="og:site_name" content="户晨风 · 摘录">',
    '<meta property="og:url" content="' + escHtml(ogUrl) + '">',
  ];
  if (ogImage) {
    ogBlock.push('<meta property="og:image" content="' + escHtml(ogImage) + '">');
    ogBlock.push('<meta property="og:image:secure_url" content="' + escHtml(ogImage) + '">');
  }
  ogBlock.push('<meta name="twitter:card" content="' + (ogImage ? 'summary_large_image' : 'summary') + '">');
  ogBlock.push('<meta name="twitter:title" content="户晨风 · 摘录">');
  ogBlock.push('<meta name="twitter:description" content="户晨风直播文字稿精华摘录：选读 / 观点 / 语录 / 展厅。">');
  if (ogImage) ogBlock.push('<meta name="twitter:image" content="' + escHtml(ogImage) + '">');

  // 注入到 <head> 内、</head> 前
  html = html.replace('</head>', '  ' + ogBlock.join('\n  ') + '\n  </head>');
  fs.writeFileSync(file, html, 'utf8');
  console.log('[gen-share-pages] 首页 index.html 已注入 og meta（og:image=' + (ogImage || '无，未发现 gallery 图') + '）');
}

function main() {
  const items = collectEssence(ESSENCE_DIR);

  // 首页 og meta（无论有无选读都注入，保证分享首页也有预览图）
  injectIndexOg();

  if (!items.length) {
    console.log('[gen-share-pages] 未发现真实选读数据，跳过详情静态页生成。');
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
  console.log(`[gen-share-pages] 共生成 ${count} 个静态详情页。`);
}

main();
