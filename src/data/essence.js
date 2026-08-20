// ==========================================================================
// 精华摘录 · Essence
//
// 这些片段从 submodule `reference/hu-chenfeng` 的直播文字稿中手工摘取，
// 截取其相对完整、可独立阅读的段落作为展示。每一条都标注了原始出处，
// 可在参考仓库中按月份/日期追溯完整上下文。
// ==========================================================================

export const meta = {
  title: "户晨风 · 摘录",
  subtitle: "Selected fragments · 精华选读",
  description:
    "从 2023–2025 年的直播文字稿中挑选的只言片语，供安静阅读。",
};

// source 指向 submodule 内相对路径；date 用于展示
// 兼容 GitHub Pages 子路径部署的静态资源基址
const base = import.meta.env.BASE_URL || "/";

export const essence = [
  {
    id: 1,
    date: "2025-01-14",
    theme: "节奏",
    text: "我的人生啊，可以说是跟绝大部分人不一样。我的人生是——你看视频需要加速吧？我一般都加速的。我的人生是三倍速。",
    source: "reference/hu-chenfeng/2025年01月/2025-01-14.md",
    audio: `${base}audio/quotes/2025-01-14.mp3`,
  },
  {
    id: 2,
    date: "2023-05-21",
    theme: "经济",
    text: "一切的行为其实都可以用经济去看待它。任何事物其本质都是可以用经济来解释的，社会的任何活动也都是经济活动。",
    source: "reference/hu-chenfeng/2023年05月/2023-05-21.md",
  },
  {
    id: 3,
    date: "2023-11-15",
    theme: "现实",
    text: "有钱人能享受到更好的食物，本来就是啊，这个难道不是社会现实吗？",
    source: "reference/hu-chenfeng/2023年11月/2023-11-15.md",
    links: [
      { type: "youtube", label: "完整直播录像", url: "https://www.youtube.com/results?search_query=户晨风+2023-11-15" },
    ],
  },
  {
    id: 4,
    date: "2023-12-05",
    theme: "幸存者偏差",
    text: "你这是幸存者偏差，因为这几篇东西，是在过去几千年里面好不容易才找出来的这几篇。",
    source: "reference/hu-chenfeng/2023年12月/2023-12-05.md",
  },
  {
    id: 5,
    date: "2023-03-12",
    theme: "价值观",
    text: "你喜欢礼物、喜欢钱很正常，我也喜欢礼物、喜欢钱，但是前提是你得通过自己的努力。",
    source: "reference/hu-chenfeng/2023年03月/2023-03-12-INC.md",
  },
  {
    id: 6,
    date: "2023-04-15",
    theme: "自述",
    text: "我是一个普通人，我也没有什么太大的雄心。直播通过正能量的直播挣点钱，这就是我最大的心愿了。",
    source: "reference/hu-chenfeng/2023年04月/2023-04-15.md",
  },
  {
    id: 7,
    date: "2023-12-03",
    theme: "幸存者偏差",
    text: "你这是幸存者偏差。挂到了这个是幸存者，绝大部分是挂不到的。北京协和、四川华西挂不到，绝大部分是挂不到的。",
    source: "reference/hu-chenfeng/2023年12月/2023-12-03.md",
  },
  {
    id: 8,
    date: "2023-04-18",
    theme: "认知",
    text: "你就是一切以 money 为中心。对，你绝对不是 23 岁，23 岁没有你这样的认知。",
    source: "reference/hu-chenfeng/2023年04月/2023-04-18.md",
  },
  {
    id: 9,
    date: "2023-12-30",
    theme: "意义",
    text: "那我现在问你，那我学这个东西，它的意义在哪里？因为我的人生是有限的。",
    source: "reference/hu-chenfeng/2023年12月/2023-12-30.md",
  },
  {
    id: 10,
    date: "2023-05-01",
    theme: "职业",
    text: "我就做教育的，做教育的。对，那天跟你说过，不过我那天麦不好就提前下麦了。",
    source: "reference/hu-chenfeng/2023年05月/2023-05-01.md",
  },
];
