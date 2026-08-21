# 参考文字库 · reference

本目录是**户晨风直播文字稿全集**的参考资源库，仅供离线检索、分析与研究使用，**不参与网页渲染**。

## 结构

```
reference/
├── HuChenFeng-main.zip        # 原始文字稿压缩包（2023–2025 全集，不解包、不落盘读取）
├── README.md                  # 本说明
├── lib/
│   ├── zip-reader.js          # 底层 ZIP 读取器（支持 store / deflate，纯 JS + Node 内置 zlib）
│   └── reader.js              # 高层 API：readFile / readLine / fullTextIterator / listFiles
├── viewpoints.md              # AI 分析出的户晨风重要观点列表
├── quotations/                # 户晨风语录小文章（忠于原文、保留其语言特点）
└── scripts/
    └── demo.js                # 读取示例（演示"读某文件某行"与"全文迭代"）
```

## 为什么不解包？

压缩包体积约 22MB、含 500+ 篇文字稿。以单个 zip 归档保存，配合 `lib/reader.js`
即可**按需读取**任意一篇文稿、某一行数据，或对全文做迭代，无需把整个包解压落盘，
便于版本管理、磁盘与仓库整洁。

## 用法示例

```bash
node scripts/demo.js
```

或在 Node 脚本中：

```js
import { listFiles, readFile, readLine, fullTextIterator } from "./lib/reader.js";

// 1) 读取某个文件全文
const text = readFile("2023年05月/2023-05-21.md");

// 2) 读取某个文件的某一行
const line = readLine("2023年05月/2023-05-21.md", 3);

// 3) 全文迭代器（按文件）
for (const { file, month, date, content } of fullTextIterator()) {
  // ...
}

// 4) 全文迭代器（按行）
for (const { file, line, text } of fullTextIterator({ byLine: true })) {
  // ...
}
```

## 说明

- 文字稿由语音转文字生成，可能存在识别错误、人名/数字脱落等情况，仅供研究参考。
- `viewpoints.md` 与 `quotations/` 由 AI 在忠于原文的基础上整理、提炼，保留户晨风的
  口语风格与表达特点；引用时建议对照 `source` 标注的原文追溯。
- 本目录所有文件均未被 `src/` 下的页面组件引用，因此不会展示在网页中。
