#!/usr/bin/env node
/**
 * gen-og-cards.mjs — 为每条「选读」生成标准 1200×630 社交分享卡片图（og:image）
 *
 * 背景：此前分享页的 og:image 直接使用展厅 gallery 大图（多为竖图，长宽比各异，
 * 无任何文字/标题）。社交平台（X/Twitter/微信等）按 1.91:1 裁剪，卡片会被截断；
 * 且图片上无文字说明，传播点击率低。本脚本在构建期用 ffmpeg 为每条选读合成一张
 * 标准 1200×630 卡片：
 *   · 背景 = 该选读确定性对应的 gallery 图（与 gen-share-pages
 *     相同的确定性随机选择逻辑），先 scale+crop 填满画布再轻微模糊，避免画面过杂
 *   · 中部叠加半透明黑色横条，提高文字对比度
 *   · 标题（白色大字）+ 站点品牌「户晨风 · 摘录」
 * 产物输出到 dist/og-cards/<id>.png，gen-share-pages 检测到即优先用此卡作 og:image。
 *
 * ffmpeg 依赖：需要系统装有 ffmpeg 与 CJK 字体（fonts-noto-cjk）。若缺失，本脚本
 * 打印警告并跳过（不阻断构建，gen-share-pages 回退用 gallery 图）。
 *
 * 用法：
 *   node scripts/gen-og-cards.mjs
 *     OUT_DIR=xx      覆盖输出目录（默认 dist）
 *     CARD_W=1200     覆盖卡片宽度
 *     CARD_H=630      覆盖卡片高度
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ESSENCE_DIR = process.env.ESSENCE_DIR || path.join(ROOT, 'src/data/essence');
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'dist');
const CW = Number(process.env.CARD_W || 1200);
const CH = Number(process.env.CARD_H || 630);

// 复用仓库的 front-matter 解析器
import { parseMarkdownItem } from '../src/data/lib/essence-md.js';

// ---- 可用的 CJK 字体（按优先级排列，兼容不同发行版/容器） ----
const FONT_CANDIDATES = [
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
  '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  '/System/Library/Fonts/PingFang.ttc',
  '/System/Library/Fonts/STHeiti Light.ttc',
  'C:/Windows/Fonts/msyh.ttc',
  'C:/Windows/Fonts/simhei.ttf',
];

/** 查找可用字体文件 */
function findCjkFont() {
  for (const f of FONT_CANDIDATES) {
    if (fs.existsSync(f)) return f;
  }
  return '';
}

// ---- 展厅 gallery 图（与 gen-share-pages 同一套读取） ----
let _galleryCache = null;
function getGalleryImages() {
  if (_galleryCache) return _galleryCache;
  const gDir = path.join(ROOT, 'public', 'gallery');
  if (!fs.existsSync(gDir)) { _galleryCache = []; return _galleryCache; }
  const files = fs.readdirSync(gDir)
    .filter((f) => /^img\d+\.png$/i.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/^img(\d+)\.png$/i)[1]);
      const nb = Number(b.match(/^img(\d+)\.png$/i)[1]);
      return na - nb;
    });
  _galleryCache = files.map((f) => 'gallery/' + f);
  return _galleryCache;
}

/** 确定性随机选择（与 gen-share-pages 一致） */
function pickGalleryIndex(seed, len) {
  if (len <= 0) return -1;
  const h = (Math.imul(seed || 0, 2654435761) >>> 0);
  return h % len;
}

/** 收集 essence（与 gen-share-pages 一致） */
function collectEssence(dir) {
  if (!fs.existsSync(dir)) return [];
  const items = [];
  for (const name of fs.readdirSync(dir)) {
    const m = /^(\d+)\.md$/.exec(name);
    if (!m) continue;
    try {
      const raw = fs.readFileSync(path.join(dir, name), 'utf8');
      const item = parseMarkdownItem(raw);
      if (typeof item.id !== 'number') continue;
      items.push(item);
    } catch (e) {
      console.warn(`[gen-og-cards] 跳过解析 ${name}: ${e.message}`);
    }
  }
  return items.sort((a, b) => a.id - b.id);
}

/** 检测 ffmpeg 是否可用 */
function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 将长标题按 CJK 字符宽度估算拆成多行（中文约 1 字宽，英文/数字约 0.55 字宽）。
 * @param {string} text 标题
 * @param {number} maxCharsPerLine 单行最大「中文字符当量」数
 * @returns {string[]} 分行后的数组
 */
function wrapTitle(text, maxCharsPerLine) {
  const chars = [...String(text || '')];
  const lines = [];
  let cur = '';
  let curWidth = 0;
  for (const ch of chars) {
    // CJK / 全角 → 宽度 1；ASCII → ~0.55
    const w = /[\u3000-\u9fff\uff00-\uffef\u2000-\u206f\u2190-\u2bff]/.test(ch) ? 1 : 0.55;
    if (curWidth + w > maxCharsPerLine && cur) {
      lines.push(cur);
      cur = ch;
      curWidth = w;
    } else {
      cur += ch;
      curWidth += w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** 用 ffmpeg 为单条选读生成 og 卡片 */
function genCardFor(item, galleryImages, fontFile) {
  const { id, title = '' } = item;
  const displayTitle = title || `选读 #${id}`;

  const gi = pickGalleryIndex(id || 0, galleryImages.length);
  if (gi < 0) {
    console.warn(`[gen-og-cards] 选读 #${id} 无 gallery 图可用，跳过`);
    return '';
  }
  const imageSite = galleryImages[gi];
  const imageAbs = path.join(ROOT, 'public', imageSite);
  if (!fs.existsSync(imageAbs)) {
    console.warn(`[gen-og-cards] 选读 #${id} 找不到图 ${imageAbs}，跳过`);
    return '';
  }

  const outFile = path.join(OUT_DIR, 'og-cards', `${id}.png`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  // 幂等：目标已存在且源图未更新则跳过
  try {
    if (fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= fs.statSync(imageAbs).mtimeMs) {
      console.log(`[gen-og-cards] ✔ 已存在且未过期，跳过: ${path.relative(ROOT, outFile)}`);
      return outFile;
    }
  } catch (e) { /* 出错则重新生成 */ }

  console.log(`[gen-og-cards] 生成 #${id} 卡片（图=${imageSite}）…`);

  // ---- 设计参数 ----
  const titleFontSize = Math.min(42, Math.max(28, Math.floor(CW / 26)));
  const brandText = '户晨风 · 摘录';
  const brandFontSize = 20;
  const marginX = 60;
  const usableW = CW - marginX * 2; // 左右留白
  const maxCharsPerLine = Math.floor(usableW / (titleFontSize * 0.95)); // 中文约等于 fontsize 像素宽

  // 标题分多行
  const titleLines = wrapTitle(displayTitle, maxCharsPerLine);
  // 防止 title 过长 -> 最多 3 行
  const maxLines = 3;
  const shownLines = titleLines.slice(0, maxLines);
  const lineH = titleFontSize * 1.35;
  const titleBlockH = shownLines.length * lineH;

  // 底部覆盖条的高度 = 标题块高度 + 品牌区 + padding
  const pad = 40;
  const overlayH = Math.min(titleBlockH + pad * 2 + 50, CH * 0.55);
  const overlayTop = CH - overlayH;

  // ---- 用文本文件避免 ffmpeg 转义问题 ----
  const tmpTitle = path.join(path.dirname(outFile), `._title_${id}.txt`);
  const tmpBrand = path.join(path.dirname(outFile), `._brand_${id}.txt`);
  fs.writeFileSync(tmpTitle, shownLines.join('\n'), 'utf8');
  fs.writeFileSync(tmpBrand, brandText, 'utf8');

  try {
    // 构建 filter
    // 1. 背景图 scale+crop 填满画布 → [bg]
    // 2. 底部黑色半透明覆盖条
    // 3. 标题（白字，位于覆盖条上部）
    // 4. 品牌文字（位于覆盖条底部）
    const drawTitle = [
      'drawtext=textfile=' + tmpTitle,
      'fontfile=' + fontFile,
      'fontsize=' + titleFontSize,
      'fontcolor=white',
      'x=' + marginX,
      // y = overlay 顶部 + pad
      'y=' + Math.round(overlayTop + pad * 0.8),
      'line_spacing=' + Math.round(titleFontSize * 0.25),
      'shadowcolor=black@0.5:shadowx=1:shadowy=1',
    ].join(':');

    const drawBrand = [
      'drawtext=textfile=' + tmpBrand,
      'fontfile=' + fontFile,
      'fontsize=' + brandFontSize,
      'fontcolor=white@0.85',
      'x=' + marginX,
      // 品牌文字靠近底部
      'y=' + Math.round(CH - pad - brandFontSize),
    ].join(':');

    const vf = [
      `scale=${CW}:${CH}:force_original_aspect_ratio=increase,crop=${CW}:${CH},boxblur=8:2`,
      `drawbox=x=0:y=${overlayTop}:w=${CW}:h=${overlayH}:color=black@0.72:t=fill`,
      drawTitle,
      drawBrand,
    ].join(',');

    const args = [
      '-y', '-loglevel', 'error',
      '-i', imageAbs,
      '-vf', vf,
      '-frames:v', '1',
      '-pix_fmt', 'yuv420p',
      outFile
    ];

    execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log(`[gen-og-cards] ✔ 生成 ${path.relative(ROOT, outFile)}`);
    return outFile;
  } catch (err) {
    console.warn(`[gen-og-cards] 选读 #${id} 卡片生成失败: ${err.message}`);
    // 清理临时文件
    try { fs.unlinkSync(tmpTitle); } catch (e) {}
    try { fs.unlinkSync(tmpBrand); } catch (e) {}
    return '';
  } finally {
    try { fs.unlinkSync(tmpTitle); } catch (e) {}
    try { fs.unlinkSync(tmpBrand); } catch (e) {}
  }
}

// ---- main ----
function main() {
  const items = collectEssence(ESSENCE_DIR);
  if (!items.length) {
    console.log('[gen-og-cards] 未发现真实选读数据，跳过 og 卡片生成。');
    return;
  }
  const galleryImages = getGalleryImages();
  if (!galleryImages.length) {
    console.warn('[gen-og-cards] public/gallery/ 下无大图，跳过 og 卡片生成。');
    return;
  }
  if (!hasFfmpeg()) {
    console.warn('[gen-og-cards] 系统未安装 ffmpeg，跳过 og 卡片生成（分享页将回退用 gallery 大图）。');
    return;
  }
  const fontFile = findCjkFont();
  if (!fontFile) {
    console.warn('[gen-og-cards] 未找到 CJK 字体（如 fonts-noto-cjk），跳过 og 卡片生成。');
    return;
  }

  let ok = 0;
  for (const item of items) {
    if (genCardFor(item, galleryImages, fontFile)) ok++;
  }

  // 额外生成站点首页的 og 卡片（id=0，标题为站点名），供首页分享使用
  const siteItem = { id: 0, title: '户晨风直播文字稿精华摘录' };
  if (genCardFor(siteItem, galleryImages, fontFile)) ok++;

  console.log(`[gen-og-cards] 共生成 ${ok}/${items.length + 1} 条 og 卡片。`);
}

main();
