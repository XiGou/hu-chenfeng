// =============================================================================
// reference/scripts/demo.js
// -----------------------------------------------------------------------------
// 参考文字库 · 读取示例
//
// 运行：node scripts/demo.js
//
// 演示内容：
//   1. 统计参考库概况（条目数、月份、文字稿数量）
//   2. 读取某个文件全文的前若干字符
//   3. 读取某个文件的"某一行"数据
//   4. 全文迭代器（按文件遍历某月）
//   5. 全文迭代器（按行遍历单个文件）
// =============================================================================

import {
  openArchive,
  listFiles,
  readFile,
  readLine,
  fullTextIterator,
  archiveStats,
} from "../lib/reader.js";

function line(prefix, s) {
  console.log(`\n--- ${prefix} ---\n${s}`);
}

// 1) 概况
const stats = archiveStats();
line("① 参考库概况", [
  `归档文件        : ${stats.archive}`,
  `压缩包大小      : ${(stats.bytes / 1024 / 1024).toFixed(1)} MB`,
  `全部条目        : ${stats.totalEntries}`,
  `文字稿文件数    : ${stats.markdownFiles}`,
  `覆盖月份数      : ${stats.months.length}（${stats.months[0]} ~ ${stats.months[stats.months.length - 1]}）`,
].join("\n"));

// 2) 读取某文件全文（取前 200 字）
const sampleFile = "2023年05月/2023-05-21.md";
line(`② 读取文件全文（${sampleFile}）`, readFile(sampleFile).slice(0, 200) + " ……");

// 3) 读取某文件的某一行（此处取第 3 行）
const L = 3;
const got = readLine(sampleFile, L);
line(`③ 读取文件第 ${L} 行`, `行号 ${got.line} | 是否还有下一行: ${got.hasNext}\n${got.text}`);

// 4) 全文迭代器（按文件，仅 2023年05月，打印前 3 篇）
line("④ 全文迭代器 · 按文件（2023年05月，前 3 篇）", "");
let n = 0;
for (const { file, month, content } of fullTextIterator({ month: "2023年05月" })) {
  if (n < 3) console.log(`  · ${file}（${month}，${content.length} 字）`);
  n++;
}
console.log(`  （本月共 ${n} 篇）`);

// 5) 全文迭代器（按行，遍历单个文件，打印前 5 行）
line("⑤ 全文迭代器 · 按行（单个文件，前 5 行）", "");
let k = 0;
for (const { file, line: ln, text } of fullTextIterator({
  file: sampleFile,
  byLine: true,
})) {
  if (k < 5) console.log(`  [${file}#${ln}] ${text.slice(0, 60)}`);
  k++;
}
console.log(`  （该文件共 ${k} 行）`);
