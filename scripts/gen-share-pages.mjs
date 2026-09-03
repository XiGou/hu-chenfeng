#!/usr/bin/env node
/**
 * gen-share-pages.mjs — 用生成器把站点里的「选读」详情静态化为独立 HTML
 *
 * 读取 src/data/essence/<id>.md（front-matter + 正文），为每条生成
 *   dist/选读/<id>.html
 * 一个可直接独立访问的静态详情页（既是站内详情，也是「分享」的载体——
 * 复制地址栏即可分享，无需单独维护“给 X 用的分享页”）。页面内嵌：
 *   - OG / Twitter Card meta：og:title/description/audio，以及 og:image/twitter:image
 *     —— og:image 优先用 scripts/gen-og-cards.mjs 生成的 1200×630 标准社交卡片
 *       （dist/og-cards/<id>.png，含标题文字），无则退化为按选读 id 确定性挑选的 gallery 图；
 *   - OG / Twitter Card meta 说明：X/Twitter 本身**没有音频卡片**，og:audio 只能让其它
 *     支持音频的平台（如部分 IM / 社交）直接点播，X 不会因此给出可点击播放的媒体；
 *     要让 X 在时间线里“点一下就能播”，只能以视频形式（静帧 gallery 图 + 音频）呈现，
 *     因此脚本会优先基于是否有视频直链决定 twitter:card：
 *       · 有视频直链（scripts/gen-quote-videos.mjs 已合成 dist/videos/quotes/<id>.mp4）→
 *         twitter:card=player + twitter:player:stream，X 可内联播放该“图+音”视频；
 *       · 无视频 → 退回 summary_large_image / summary 大图/摘要卡。
 *   - og:video / twitter:player 直链：若构建阶段已由 scripts/gen-quote-videos.mjs 为该条选读
 *     用 ffmpeg 合成 dist/videos/quotes/<id>.mp4（同封面 gallery 图 + 音频），则附加视频直链，
 *     供支持视频内嵌预览的平台（如 X、部分 IM / 社交）展示；网页内仍用纯 <audio> 播放、不嵌视频。
 *     视频类 meta 与 og:audio / og:image 一样用「相对本页目录」的路径（如 ../videos/quotes/<id>.mp4），
 *     配 SITE_URL 时烘成绝对 https；未配置时保持域名无关、由运行时以当前页面所在子路径补齐 ——
 *     这样同一份 dist 无论部署到 COS、GitHub Pages 子路径还是其它站点都能正确解析（不写死站点根 / 路径，
 *     避免在 GitHub Pages 子路径部署下被解析到域名根而丢失子路径前缀）。
 *   - 波形播放器（基于 Wavesurfer.js v7，含波形 + 播放/暂停 + 点按跳转 + 播放着色进度，
 *     无 JS 时自动回退为原生 <audio controls>）+ 展厅预览图 + 标题/日期/主题/正文（含 video/links 媒体）
 *   - 分享操作条：底部「复制链接」（复制无 .html 的 canonical 干净地址）与「分享到 X」
 *     （X(Twitter) intent 带标题+链接跳转发推），让分享只需复制/一点即可完成
 *
 * 另外会给首页 dist/index.html 补写基础 OG/Twitter meta（og:image 优先用首条选读卡片），
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
// 站点绝对基址（可选）。若为空，og meta 走相对路径，页面运行时用 location 补齐。
// 产物保持域名无关，同一份 dist 可复用于 GitHub Pages / Cloudflare Pages / COS 等任意站点。
// 如确实需要绝对 https（X/Twitter 爬虫不执行 JS），请在构建时通过环境变量 SITE_URL 显式指定。
const _DEFAULT_SITE = '';
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

/** 将 Markdown 正文转为纯文本（去粗体/标题/行内代码等标记），用于 og:description */
function toPlainText(md) {
  return String(md || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // **bold**
    .replace(/#{1,3}\s+/g, '')                // 标题 #
    .replace(/`([^`]+)`/g, '$1')               // `code`
    .replace(/^\s*>\s?/gm, '')               // 引用 > 
    .replace(/[\n\r]+/g, ' ')                // 换行 → 空格
    .replace(/\s+/g, ' ')
    .trim();
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
  // —— 文本/描述：去 Markdown 标记后拼「标题 —— 正文预览」，总长截到 ~115 码点（社交平台约显示 125 字符）
  const displayTitle = title || `选读 #${id}`;
  const cleanText = toPlainText(text);
  const SEP = ' —— ';
  const maxDescLen = 115;
  let description = title ? `${displayTitle}${SEP}${cleanText}` : cleanText;
  if ([...description].length > maxDescLen) {
    description = [...description].slice(0, maxDescLen - 1).join('') + '…';
  }
  // 页面 <title>：更充分地利用 SERP 空间 —— 标题 + 站点说明
  const pageTitle = title
    ? `${displayTitle} · 户晨风直播精选 | 选读 #${id}`
    : `户晨风 · 选读 #${id} | 直播文字稿精华摘录`;

  const shareFile = path.join(OUT_DIR, DIR_NAME, `${id}.html`);
  const relRoot = relToDist(shareFile); // 从分享页 → dist/ 的相对路径
  // 波形播放器（Wavesurfer）ESM 的相对路径：从分享页 → dist/vendor/wavesurfer.esm.js
  const waveModuleRel = relRoot + '/vendor/wavesurfer.esm.js';

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
  // 分享用的 canonical 干净地址（无 .html 后缀，避免 308 重定向、利于发推出卡片）
  const shareCleanUrl = SITE_URL ? `${SITE_URL}/${DIR_NAME}/${id}` : '';
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
  // 页内 <img>：展厅原图（确定性挑选，与旧逻辑一致）
  let imageRelUrl = '';
  if (galleryImages.length) {
    const gi = pickGalleryIndex(id || 0, galleryImages.length);
    const galleryImg = galleryImages[gi];
    imageRelUrl = relRoot + '/' + galleryImg; // 相对本页，供页面内 <img>
  }

  // og:image —— 优先用构建期生成的 1200×630 社交卡片（dist/og-cards/<id>.png）；
  // 若无（如 ffmpeg/字体缺失时跳过生成），退化为选一张 gallery 图（尽力而为，不作 og:image 比率要求）。
  let ogImageSitePath = '';
  const ogCardFile = path.join(OUT_DIR, 'og-cards', `${id}.png`);
  const hasOgCard = fs.existsSync(ogCardFile);
  if (hasOgCard) {
    ogImageSitePath = `og-cards/${id}.png`;
  } else if (galleryImages.length) {
    const gi = pickGalleryIndex(id || 0, galleryImages.length);
    ogImageSitePath = galleryImages[gi];
  }
  // og:image 站点相对地址 → 绝对 URL（配 SITE_URL）或相对路径
  let imageAbsUrl = '';
  if (ogImageSitePath) {
    const ogImageRelUrl = relRoot + '/' + ogImageSitePath;
    imageAbsUrl = SITE_URL
      ? `${SITE_URL}/${ogImageSitePath}`.replace(/([^:])\/+/g, '$1/')
      : ogImageRelUrl;
  }

  // 视频直链（og:video）：站点资源路径 videos/quotes/<id>.mp4。
  // 视频 meta 必须与 og:audio / og:image 一样用「相对本页目录」的路径（如 ../videos/quotes/<id>.mp4，
  // 配 SITE_URL 时烘成绝对 https），而**不能**用「/」开头的站点根绝对路径——
  // 因为站点可能部署在子路径下（如 GitHub Pages 的 https://<user>.github.io/<repo>/），
  // 根绝对路径会被解析到域名根（丢掉子路径前缀）而失效。相对路径由运行时以当前页面目录补齐，
  // 既兼容子路径部署，又保留同一份 dist 跨站点（COS / GitHub Pages / CF）复用的域名无关性。
  const videoSitePath = `videos/quotes/${id}.mp4`;
  // 站点资源绝对地址（配 SITE_URL）或相对本页目录的相对路径（无 SITE_URL，运行时补齐）
  const videoRelUrl = relRoot + '/' + videoSitePath; // 相对本页目录，如 ../videos/quotes/<id>.mp4
  let videoUrl = '';
  if (hasVideo) {
    videoUrl = SITE_URL
      ? `${SITE_URL}/${videoSitePath}`.replace(/([^:])\/+/g, '$1/')
      : videoRelUrl;
  }
  // twitter:card —— 有视频直链时用 player 卡（配合 twitter:player:stream，
  // X 会在时间线里直接给出可点播放的视频预览，即可点播“图 + 音频/视频”）；无视频再退而求其次：
  // 有大图用 summary_large_image，否则 summary。og:audio 本身 X 不出音频卡，无法点播。
  // 注意：twitter:card=player 需先将站点域名在 X(Twitter) 开发者平台提交/校验（player 卡白名单），
  // 否则 X 可能回退到摘要卡或不出图。见 scripts/gen-quote-videos.mjs 生成的 videos/quotes/<id>.mp4。
  const twitterCardType = videoUrl
    ? 'player'
    : (imageAbsUrl ? 'summary_large_image' : 'summary');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(pageTitle)}</title>
  <meta name="description" content="${escHtml(description)}">
  <meta name="theme-color" content="#ffffff">
  <!-- 随机 favicon：与全站其它页面一致，apple / tesla / sam 中随机 -->
  <link id="favicon" rel="icon" type="image/svg+xml" href="${relRoot}/favicons/apple.svg">

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
  <meta property="og:image:type" content="image/png">
  ${hasOgCard ? `
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">` : ''}
  <meta property="og:image:alt" content="${escHtml(displayTitle)}">` : ''}
  ${videoUrl ? `
  <meta property="og:video" content="${escHtml(videoUrl)}">
  <meta property="og:video:secure_url" content="${escHtml(videoUrl)}">
  <meta property="og:video:type" content="video/mp4">
  <meta property="og:video:width" content="1280">
  <meta property="og:video:height" content="720">` : ''}

  <!-- ======== Twitter / X Card ======== -->
  <!-- twitter:card 由 twitterCardType 决定：有视频直链→player（可点播），否则大图/摘要卡。
       三种情况下都带上 title/description；有图时带 twitter:image 作 player 卡封面。 -->
  <meta name="twitter:card" content="${twitterCardType}">
  <meta name="twitter:title" content="${escHtml(displayTitle)}">
  <meta name="twitter:description" content="${escHtml(description)}">
  ${imageAbsUrl ? `
  <meta name="twitter:image" content="${escHtml(imageAbsUrl)}">` : ''}
  ${videoUrl ? `
  <meta name="twitter:player" content="${escHtml(videoUrl)}">
  <meta name="twitter:player:stream" content="${escHtml(videoUrl)}">
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
    /* 音频播放器（波形 + 控件 + 播放着色） */
    .audio-wrap {
      margin: 20px 0 24px;
      padding: 18px 18px 14px;
      background: #ffffff;
      border: 1px solid #ececec;
      border-radius: 16px;
      box-shadow: 0 1px 2px rgba(0,0,0,.03);
    }
    /* 无 JS 兜底：原生播放器默认展示 */
    .audio-wrap audio.audio-native {
      display: block;
      width: 100%;
      height: 40px;
      outline: none;
    }
    /* 波形播放器接管后须真正隐藏原生播放器（作者样式的 display 覆盖 UA 的 [hidden]） */
    .audio-wrap audio.audio-native[hidden] { display: none; }
    /* JS 增强：波形播放器 */
    .wave-player[hidden] { display: none; }
    .wave-player .wave-bar {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 10px;
    }
    .wave-play {
      flex: none;
      width: 42px;
      height: 42px;
      border: 0;
      border-radius: 50%;
      background: #111;
      color: #fff;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background .15s ease, transform .05s ease;
    }
    .wave-play:hover { background: #333; }
    .wave-play:active { transform: scale(.96); }
    .wave-ico { display: block; }
    .wave-ico-pause { display: none; }
    .wave-player.is-playing .wave-ico-pause { display: block; }
    .wave-player.is-playing .wave-ico-play { display: none; }
    .wave-head { min-width: 0; }
    .wave-name {
      font-size: 13px;
      color: #333;
      font-weight: 600;
      letter-spacing: .02em;
    }
    .wave-time {
      font-size: 12px;
      color: #999;
      font-variant-numeric: tabular-nums;
      margin-top: 2px;
    }
    .wave-canvas {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
    }
    .audio-hint { display: none; }

    /* 分享操作条：复制链接 / 分享到 X */
    .share-bar {
      margin: 30px 0 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.4;
      font-family: inherit;
      border: 1px solid #ececec;
      background: #fff;
      color: #333;
      cursor: pointer;
      text-decoration: none;
      transition: border-color .15s ease, background .15s ease, color .15s ease;
    }
    .share-btn svg { width: 15px; height: 15px; flex: none; }
    .share-btn:hover { border-color: #111; color: #111; background: #fafafa; }
    .share-btn.tweet {
      background: #111;
      border-color: #111;
      color: #fff;
    }
    .share-btn.tweet:hover { background: #333; border-color: #333; color: #fff; }
    .share-bar-note {
      width: 100%;
      font-size: 12px;
      color: #aaa;
      margin-top: 2px;
    }
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
      <!-- 无 JS 兜底：原生播放器（JS 就绪后由波形播放器接管并隐藏本元素） -->
      <audio class="audio-native" controls preload="metadata" src="${escHtml(audioUrl)}"></audio>
      <!-- 波形播放器：加载 Wavesurfer 后展示（波形 + 播放控件 + 播放着色） -->
      <div class="wave-player" hidden>
        <div class="wave-bar">
          <button type="button" class="wave-play" data-wave-play aria-label="播放" aria-pressed="false">
            <svg class="wave-ico wave-ico-play" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
            <svg class="wave-ico wave-ico-pause" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>
          </button>
          <div class="wave-head">
            <div class="wave-name">边读边听</div>
            <div class="wave-time"><span data-wave-current>0:00</span><span class="wave-time-sep">/</span><span data-wave-duration>--:--</span></div>
          </div>
        </div>
        <div class="wave-canvas" data-wave-container></div>
      </div>
    </div>` : ''}

    <div class="content">${contentHtml}</div>

    ${mediaHtml}

    ${source ? `<div class="source">出处：${escHtml(source)}</div>` : ''}

    <div class="share-bar" role="group" aria-label="分享">
      <button type="button" class="share-btn" data-share-copy>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>
        <span data-share-copy-label>复制链接</span>
      </button>
      <a class="share-btn tweet" data-share-tweet href="#" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        分享到 X
      </a>
      <span class="share-bar-note">分享用当前干净地址（无 .html 后缀），直接发推即可出卡片</span>
    </div>

    <a class="back-link" href="${escHtml(backHref)}">← 返回全部选读</a>

    <footer>户晨风 · 摘录 — 安静阅读，边读边听。</footer>
  </div>

  <script>
    // 无 SITE_URL 时，运行时用当前页面的 location 将相对 URL 补齐为绝对地址
    //（对不执行 JS 的 X 爬虫无效，仅作浏览器/支持渲染的抓取兜底；
    //  生产建议在构建时配置 SITE_URL，让 og:url/og:image 直接烘成绝对 https）。
    // og:url 为「相对站点根的路径」（如 选读/1.html）；
    // og:audio / og:image / og:video（twitter:player）为「相对本页目录的路径」
    //（如 ../audio/quotes/x.mp3、../gallery/imgN.png、../videos/quotes/<id>.mp4）。
    // 相对路径以当前页面目录补齐，可兼容任意子路径部署（GitHub Pages /hu-chenfeng/ 等）。
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
      // og:audio / og:image / og:video（twitter:player）—— 相对当前页目录的路径
      //（如 ../audio/...、../gallery/imgN.png、../videos/quotes/<id>.mp4）。以 pageDir 补齐，
      // 使其跟随「当前页面所在子路径」（兼容 GitHub Pages 子路径 /hu-chenfeng/ 等部署）
      patch('meta[property="og:audio"]', pageDir);
      patch('meta[property="og:audio:secure_url"]', pageDir);
      patch('meta[property="og:image"]', pageDir);
      patch('meta[property="og:image:secure_url"]', pageDir);
      patch('meta[property="og:video"]', pageDir);
      patch('meta[property="og:video:secure_url"]', pageDir);
      patch('meta[name="twitter:player"]', pageDir);
      patch('meta[name="twitter:player:stream"]', pageDir);
    })();
  </script>

  <script type="module">
    // 波形播放器 —— 基于 Wavesurfer 渲染波形、支持点按跳转与「播放着色」进度条。
    // 页面无 JS 时保留原生 <audio controls> 兜底；本模块加载成功后接管为波形播放器。
    (async function () {
      var container = document.querySelector('[data-wave-container]');
      var nativeAudio = document.querySelector('.audio-native');
      if (!container || !nativeAudio) return;
      var playerEl = container.closest('.wave-player');
      var playBtn = playerEl.querySelector('[data-wave-play]');
      var curEl = playerEl.querySelector('[data-wave-current]');
      var durEl = playerEl.querySelector('[data-wave-duration]');

      try {
        var WaveSurfer = (await import('${waveModuleRel}')).default;
        var ws = WaveSurfer.create({
          container: container,
          url: nativeAudio.getAttribute('src'),
          height: 64,
          waveColor: '#e9e9e9',
          progressColor: '#111111',
          cursorColor: '#111111',
          cursorWidth: 2,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
          dragToSeek: true,
          fillParent: true,
          hideScrollbar: true,
        });

        // 原生播放器已由波形播放器接管，隐藏之
        nativeAudio.hidden = true;
        playerEl.hidden = false;

        function fmt(sec) {
          sec = Math.floor(sec || 0);
          if (!isFinite(sec) || sec < 0) sec = 0;
          var m = Math.floor(sec / 60);
          var s = sec % 60;
          return m + ':' + (s < 10 ? '0' : '') + s;
        }
        function setPlaying(on) {
          playerEl.classList.toggle('is-playing', !!on);
          playBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
          playBtn.setAttribute('aria-label', on ? '暂停' : '播放');
        }

        ws.on('ready', function () { durEl.textContent = fmt(ws.getDuration()); });
        ws.on('timeupdate', function (t) { curEl.textContent = fmt(t); });
        ws.on('play', function () { setPlaying(true); });
        ws.on('pause', function () { setPlaying(false); });
        ws.on('finish', function () { setPlaying(false); });
        playBtn.addEventListener('click', function () { ws.playPause(); });
      } catch (err) {
        // 波形播放器加载/初始化失败：保持原生播放器可用
        console.warn('波形播放器加载失败，已回退原生播放器', err);
      }
    })();
  </script>

  <script>
    // 分享操作条：复制当前 canonical 链接 / 跳转 X(Twitter) 发推。
    // canonical 统一为「无 .html」的干净地址（Cloudflare 等对 .html 走 308，
    // 去掉后缀既是规范地址、也避免分享时被爬虫因重定向折成纯文本）。
    (function () {
      var title = ${JSON.stringify(displayTitle)};
      // canonical：优先构建期 SITE_URL 绝对地址；否则用地址栏并去掉可能残留的 .html
      var url = ${JSON.stringify(shareCleanUrl)};
      var btn = document.querySelector('[data-share-copy]');
      var label = btn && btn.querySelector('[data-share-copy-label]');
      var tweet = document.querySelector('[data-share-tweet]');

      function canonical() {
        var base = location.href.split('#')[0].split('?')[0];
        return base.replace(/\\.html$/i, '');
      }
      if (!url || url === '') url = canonical();

      if (tweet) {
        var intent = 'https://twitter.com/intent/tweet?text=' +
          encodeURIComponent(title) + '&url=' + encodeURIComponent(url);
        tweet.setAttribute('href', intent);
      }

      if (btn && label) {
        var restore = function () {
          label.textContent = '复制链接';
        };
        var flash = function (ok) {
          label.textContent = ok ? '已复制 ✓' : '复制失败';
          setTimeout(restore, 2000);
        };
        btn.addEventListener('click', function () {
          var done = function () { flash(true); };
          var fail = function () { flash(false); };
          function legacyCopy() {
            var ta = document.createElement('textarea');
            ta.value = url;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); done(); }
            catch (e) { fail(); }
            document.body.removeChild(ta);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, legacyCopy);
          } else {
            legacyCopy();
          }
        });
      }
    })();
  </script>

  <script>
    // 状态栏缩略图：与全站页面一致，刷新在 apple / tesla / sam 间随机出现
    (function () {
      var logos = ["apple", "tesla", "sam"];
      var pick = logos[Math.floor(Math.random() * logos.length)];
      var link = document.getElementById("favicon");
      if (link) {
        link.setAttribute("href", "${relRoot}/favicons/" + pick + ".svg");
      }
    })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

/**
 * 给首页 dist/index.html 补写 Open Graph / Twitter 基础 meta。
 * og:image 优先用首条选读生成的社交卡片（如存在）；否则退化为选 landscape 向 gallery 图。
 * 幂等：已含相关 meta 则跳过。
 */
function injectIndexOg() {
  const file = path.join(OUT_DIR, 'index.html');
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');

  const galleryImages = getGalleryImages();
  const hasOgTitle = /property="og:title"/.test(html);

  if (hasOgTitle) return; // 已注入过

  const ogUrl = SITE_URL ? `${SITE_URL}/index.html` : 'index.html';

  // og:image 选择：优先用站点专属的 og-card（og-cards/0.png，标题=站点名）；
  // 若无则退化为选首条选读的卡片，再退化为 landscape 向 gallery 图。
  let imageSite = '';
  const siteCard = path.join(OUT_DIR, 'og-cards', '0.png');
  const firstCard = path.join(OUT_DIR, 'og-cards', '1.png');
  const landscapeCandidates = ['gallery/img3.png', 'gallery/img4.png', 'gallery/img5.png'];
  if (fs.existsSync(siteCard)) {
    imageSite = 'og-cards/0.png';
  } else if (fs.existsSync(firstCard)) {
    imageSite = 'og-cards/1.png';
  } else if (galleryImages.length) {
    imageSite = landscapeCandidates.find((p) => galleryImages.includes(p))
      || galleryImages[0];
  }
  const ogImage = SITE_URL && imageSite
    ? `${SITE_URL}/${imageSite}`.replace(/([^:])\/+/g, '$1/')
    : imageSite;

  const ogBlock = [
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="户晨风直播文字稿精华摘录">',
    '<meta property="og:description" content="户晨风直播文字稿精华摘录——从万千场直播中精选的思考片段：选读 / 观点 / 语录 / 展厅，安静阅读，边读边听。">',
    '<meta property="og:site_name" content="户晨风 · 摘录">',
    '<meta property="og:url" content="' + escHtml(ogUrl) + '">',
  ];
  if (ogImage) {
    ogBlock.push('<meta property="og:image" content="' + escHtml(ogImage) + '">');
    ogBlock.push('<meta property="og:image:secure_url" content="' + escHtml(ogImage) + '">');
  }
  ogBlock.push('<meta name="twitter:card" content="' + (ogImage ? 'summary_large_image' : 'summary') + '">');
  ogBlock.push('<meta name="twitter:title" content="户晨风直播文字稿精华摘录">');
  ogBlock.push('<meta name="twitter:description" content="户晨风直播文字稿精华摘录——从万千场直播中精选的思考片段：选读 / 观点 / 语录 / 展厅。">');
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
