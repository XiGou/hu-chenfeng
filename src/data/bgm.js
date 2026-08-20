// ==========================================================================
// 背景音乐 · BGM
//
// 悬浮迷你播放器可选的静态 BGM 曲目。音频文件放置在 `public/bgm/` 目录下，
// 以静态资源方式引用（`/bgm/xxx.mp3`）。
//
// 说明：以下为站方暂定的几首候选 BGM。受版权限制，本仓库不直接托管受版权
// 保护的音频文件；请将对应音频（mp3/ogg）放入 `public/bgm/` 后即可在播放器
// 中选择。若某首尚无文件，对应 src 置空，播放器将自动置灰该曲目。
// ==========================================================================

export const bgmTracks = [
  {
    id: "hcf-xiaoqu",
    label: "户晨风小曲",
    src: "/bgm/hu-chenfeng-xiaoqu.mp3",
  },
  {
    id: "youjing",
    label: "游京",
    src: "/bgm/youjing.mp3",
  },
  {
    id: "andalusia",
    label: "《购买力的小曲》· Andalusia（Antoine Chambe）",
    src: "/bgm/andalusia.mp3",
  },
  {
    id: "anlizhaomi",
    label: "收入公开小曲 · 暗里着迷（刘德华）",
    src: "/bgm/anlizhaomi.mp3",
  },
  {
    id: "qifengle",
    label: "起风了 · 纯音乐",
    src: "/bgm/qifengle.mp3",
  },
];
