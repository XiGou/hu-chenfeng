// ==========================================================================
// 背景音乐 · BGM
//
// 悬浮迷你播放器可选的静态 BGM 曲目。音频文件放置在 `public/bgm/` 目录下，
// 使用 import.meta.env.BASE_URL 拼接，兼容 GitHub Pages 子路径部署。
//
// 说明：以下为站方暂定的几首候选 BGM。受版权限制，本仓库不直接托管受版权
// 保护的音频文件；请将对应音频（mp3/ogg）放入 `public/bgm/` 后即可在播放器
// 中选择。若某首尚无文件，对应 src 置空，播放器将自动置灰该曲目。
// ==========================================================================

const base = import.meta.env.BASE_URL || "/";

export const bgmTracks = [
  {
    id: "youjing",
    label: "私有化の小曲 · 游京",
    src: `${base}bgm/私有化小曲-游京DJ.mp3`,
  },
  {
    id: "andalusia",
    label: "购买力の小曲 · Andalusia",
    src: `${base}bgm/购买力の小曲-Hi-Res无损音质-Andalusia.mp3`,
  },
  {
    id: "anlizhaomi",
    label: "收入公开の小曲 · 暗里着迷（1993年刘德华演唱的粤语流行歌曲）",
    src: `${base}bgm/公布收入小曲-吉他的天空-暗里着迷.mp3`,
  },
  {
    id: "qifengle",
    label: "汽修工の黄粱一梦小曲 · 起风了-纯音乐",
    src: `${base}bgm/汽修工黄粱一梦的小曲-收入结算的小曲-起风了纯音乐-高桥优.mp3`,
  },
];
