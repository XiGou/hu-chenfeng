#!/usr/bin/env node
/**
 * gen-quote-videos.mjs — 部署时用 ffmpeg 为每条「选读」合成一条可公开访问的视频
 *
 * 背景：X/Twitter 等平台对「视频」直链的可点播/内嵌预览支持更好。本脚本在构建阶段
 * 用 ffmpeg 把「该条选读在展厅(gallery)里映射固定的那张图」+「该条音频」合成一个
 * 静帧视频（画面 = 模糊大图铺底 + 居中完整小图），输出到
 *   dist/videos/quotes/<id>.mp4
 * 供分享页 og:video / og:image 对同一张图做封面、网页仍用纯 <audio> 播放等用途。
 *
 * 关键约定 —— 与 gen-share-pages.mjs 完全一致：
 *   · 画面用的 gallery 图 = 该选读 og:image 选定的同一张（同一确定性随机种子 pickGalleryIndex(id)），
 *     保证「映射固定」：同一 id 每次构建都用同一张图，且分享页封面与视频画面一致。
 *   · 未配置 SITE_URL 时本脚本只负责产出 dist 下的视频文件，绝对 URL 由分享页负责拼。
 *
 * ffmpeg 依赖：需要系统装有 ffmpeg。若缺失，脚本打印警告并跳过（不阻断构建）。
 * 用法：
 *   node scripts/gen-quote-videos.mjs
 *     OUT_DIR=xx  覆盖输出目录（默认 dist）
 *     VIDEO_PRESET=veryfast / VIDEO_CRF=26  覆盖编码参数（默认 veryfast / 26）
 *     VIDEO_W=1280 / VIDEO_H=720            覆盖输出画布（默认 1280x720）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const ESSENCE_DIR = process.env.ESSENCE_DIR || path.join(ROOT, 'src/data/essence');
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'dist');
// ffmpeg 输出参数（可用环境变量覆盖）
const VW = Number(process.env.VIDEO_W || 1280);
const VH = Number(process.env.VIDEO_H || 720);
const PRESET = process.env.VIDEO_PRESET || 'veryfast';
const CRF = process.env.VIDEO_CRF || '26';
// 复用仓库的 front-matter 解析器（纯函数）
import { parseMarkdownItem } from '../src/data/lib/essence-md.js';

// ---------------------------------------------------------------------------
// 工具（与 gen-share-pages.mjs 保持一致）
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

/** 展厅预览图（与 gen-share-pages.mjs 同一套读取） */
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

/** 由 seed 派生的确定性下标（与 gen-share-pages.mjs 完全一致） */
function pickGalleryIndex(seed, len) {
  if (len <= 0) return -1;
  const h = (Math.imul(seed || 0, 2654435761) >>> 0);
  return h % len;
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

/** 解析选择：音频为本地仓库资源，输出绝对/相对站点根的静态音频路径 */
function resolveAudioPath(audio) {
  const clean = cleanAudioPath(audio);
  if (!clean || isExternalUrl(clean)) return ''; // 外链音频/无音频无法本地合成
  // 相对站点根的音频文件（public/ 下）
  const abs = path.join(ROOT, 'public', clean);
  return fs.existsSync(abs) ? abs : '';
}

// ---------------------------------------------------------------------------
// 收集 essence（与 gen-share-pages.mjs 一致）
// ---------------------------------------------------------------------------
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
      console.warn(`[gen-quote-videos] 跳过解析 ${name}: ${e.message}`);
    }
  }
  return items.sort((a, b) => a.id - b.id);
}

/** 生成单条选读的视频（静帧图 + 音频 → mp4），返回输出文件绝对路径 */
function genVideoFor(item, galleryImages) {
  const { id, audio = '' } = item;
  const audioAbs = resolveAudioPath(audio);
  if (!audioAbs) {
    console.warn(`[gen-quote-videos] 选读 #${id} 无可本地合成的音频，跳过`);
    return '';
  }
  const gi = pickGalleryIndex(id || 0, galleryImages.length);
  if (gi < 0) {
    console.warn(`[gen-quote-videos] 选读 #${id} 无 gallery 图可用，跳过`);
    return '';
  }
  const imageSite = galleryImages[gi];           // 相对站点根：gallery/imgN.png
  const imageAbs = path.join(ROOT, 'public', imageSite);
  if (!fs.existsSync(imageAbs)) {
    console.warn(`[gen-quote-videos] 选读 #${id} 找不到图 ${imageAbs}，跳过`);
    return '';
  }

  // 输出路径：dist/videos/quotes/<id>.mp4
  const outFile = path.join(OUT_DIR, 'videos', 'quotes', `${id}.mp4`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  // 幂等：目标已存在且不旧于 音频/图片 源则跳过（构建/数据未变时不重复编码，节省 CI 时间）
  try {
    const srcNewest = Math.max(
      fs.statSync(imageAbs).mtimeMs,
      fs.statSync(audioAbs).mtimeMs
    );
    if (fs.existsSync(outFile) && fs.statSync(outFile).mtimeMs >= srcNewest) {
      console.log(`[gen-quote-videos] ✔ 已存在且未过期，跳过: ${path.relative(ROOT, outFile)}`);
      return outFile;
    }
  } catch (e) { /* 出错则重新生成 */ }

  console.log(`[gen-quote-videos] 合成 #${id} 视频（图=${imageSite} + 音频）…`);
  const t0 = Date.now();

  // 画面：模糊放大的背景铺满画布 + 居中完整（等比缩放 fit）前景图
  const vf = [
    `[0:v]scale=${VW}:${VH}:force_original_aspect_ratio=increase,crop=${VW}:${VH},boxblur=20:5[bg]`,
    `[0:v]scale=${VW}:${VH}:force_original_aspect_ratio=decrease[fg]`,
    `[bg][fg]overlay=(W-w)/2:(H-h)/2[v]`
  ].join(';');

  const args = [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-framerate', '25', '-i', imageAbs,
    '-i', audioAbs,
    '-filter_complex', vf,
    '-map', '[v]', '-map', '1:a',
    // 视频：走 libx264 + crf 压缩（静帧图需压缩转码才能流式内嵌，保留压缩参数）
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-profile:v', 'main',
    '-preset', PRESET, '-crf', CRF,
    // 音频：仅流复制不重新编码（-c:a copy），保留原始音频码流，不做压缩 / 二次转码，避免音质损失
    '-c:a', 'copy', '-movflags', '+faststart',
    '-shortest', outFile
  ];

  try {
    execFileSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  } catch (e) {
    console.warn(`[gen-quote-videos] 选读 #${id} 视频合成失败: ${e.message}`);
    return '';
  }

  console.log(`[gen-quote-videos] ✔ 生成 ${path.relative(ROOT, outFile)}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  return outFile;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const items = collectEssence(ESSENCE_DIR);
  if (!items.length) {
    console.log('[gen-quote-videos] 未发现真实选读数据，跳过视频生成。');
    return;
  }
  const galleryImages = getGalleryImages();
  if (!galleryImages.length) {
    console.warn('[gen-quote-videos] public/gallery/ 下无大图，无法合成视频，跳过。');
    return;
  }
  if (!hasFfmpeg()) {
    console.warn('[gen-quote-videos] 系统未安装 ffmpeg，跳过视频生成（分享页将不含 og:video）。');
    return;
  }

  let ok = 0;
  for (const item of items) {
    if (genVideoFor(item, galleryImages)) ok++;
  }
  console.log(`[gen-quote-videos] 共生成 ${ok}/${items.length} 条选读视频。`);
}

main();
