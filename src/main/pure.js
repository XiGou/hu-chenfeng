/**
 * 纯享模式入口 — pure.html
 *
 * 「黑胶唱机」式沉浸聆听页。整页为一台黑胶唱机：
 *   - 左侧：黑胶唱片（转盘），中央把随机选出的 gallery 图像 mask 成圆标，
 *     播放时旋转；唱臂随之就位/归位。
 *   - 中间/右侧：全部「选读」构成的播放列表 + 当前条文本正文。
 *
 * 纯浏览器端应用（无需 SSR 预渲染）：播放/动画/列表都依赖 JS，
 * 故以普通 createApp 挂载（容器在构建期保持为空）。
 */
import { createApp } from "vue";
import PurePlayerPage from "../pages/PurePlayerPage.vue";
import "../styles/main.css";
import "../styles/pure.css";

createApp(PurePlayerPage).mount("#app");
