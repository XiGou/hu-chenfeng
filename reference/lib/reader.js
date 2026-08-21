// =============================================================================
// reference/lib/reader.js
// -----------------------------------------------------------------------------
// 参考文字库 · 高层读取 API
//
// 基于 reference/lib/zip-reader.js 封装，面向"户晨风全集"（HuChenFeng-main.zip）
// 提供便捷读取函数：
//   * readFile(file, options)          —— 读取某个文件全文
//   * readLine(file, line)             —— 读取某个文件的某一行
//   * fullTextIterator(month?, file?)  —— 全文迭代器（可按月 / 按文件 / 全文遍历）
//   * listFiles(month?)                —— 列出所有（或某月的）文字稿文件
//   * openArchive()                    —— 直接获取底层 ZipArchive 实例
//
// 说明：本模块只读取"某文件中某行"的数据并支持全文迭代，不会把整个压缩包
// 解包落盘。它作为参考资源库的离线读取工具使用，不参与网页渲染。
// =============================================================================

import { ZipArchive } from "./zip-reader.js";
import { fileURLToPath } from "node:url";

// 参考库压缩包相对本模块的路径
const ARCHIVE_PATH = fileURLToPath(
  new URL("../HuChenFeng-main.zip", import.meta.url)
);

// 仓库根前缀（压缩包内所有文件都挂在 HuChenFeng-main/ 之下）
const ROOT = "HuChenFeng-main/";

let _archive = null;

/**
 * 打开（惰性单例）参考文字库归档。
 * @returns {ZipArchive}
 */
export function openArchive() {
  if (!_archive) {
    _archive = new ZipArchive(ARCHIVE_PATH);
  }
  return _archive;
}

/**
 * 将仓库内相对路径规范化为压缩包内完整路径。
 * @param {string} file 如 "2023年05月/2023-05-21.md" 或 "HuChenFeng-main/2023年05月/..."
 */
export function toEntryName(file) {
  let p = file;
  if (p.startsWith(ROOT)) return p;
  return ROOT + p.replace(/^\/+/, "");
}

/** 列出全部（或指定月份的）文字稿文件。 */
export function listFiles(month) {
  const arc = openArchive();
  const prefix = ROOT + (month ? month + "/" : "");
  return arc
    .listAll()
    .filter(
      (n) =>
        n.startsWith(prefix) &&
        n.endsWith(".md") &&
        !n.endsWith("README.md") &&
        !n.endsWith("/README.md")
    )
    .map((n) => n.slice(ROOT.length));
}

/**
 * 读取某个文件的全文（文本）。
 * @param {string} file 仓库内相对路径，如 "2023年05月/2023-05-21.md"
 * @param {object} [opts] { encoding }
 * @returns {string}
 */
export function readFile(file, opts = {}) {
  return openArchive().readText(toEntryName(file), opts.encoding || "utf8");
}

/**
 * 读取某个文件中某一行的数据。
 * @param {string} file 仓库内相对路径
 * @param {number} line 行号，从 1 开始
 * @returns {{ file: string, line: number, text: string, hasNext: boolean }}
 */
export function readLine(file, line) {
  const entry = toEntryName(file);
  const r = openArchive().readLine(entry, line);
  return { file, ...r };
}

/**
 * 全文迭代器 —— 遍历文字稿全文。
 *
 * 可选参数：
 *   - month: 仅遍历某个月（如 "2023年05月"）；缺省遍历全部月份
 *   - file:  仅遍历指定单个文件
 *   - byLine: true 时按"行"产出（yield 单行字符串），否则按"文件"产出
 *
 * 产出（byLine=false 时）：
 *   { file, month, date, content }
 * 产出（byLine=true 时）：
 *   { file, line, text }
 *
 * @returns {AsyncGenerator | Generator}
 */
export function* fullTextIterator(options = {}) {
  const { month, file, byLine = false } = options;
  const arc = openArchive();

  if (file) {
    const entry = toEntryName(file);
    if (!arc.has(entry)) throw new Error(`文件不存在: ${file}`);
    if (byLine) {
      let ln = 0;
      for (const line of arc.lines(entry)) {
        ln += 1;
        yield { file, line: ln, text: line };
      }
    } else {
      yield {
        file,
        month: guessMonth(file),
        date: guessDate(file),
        content: arc.readText(entry),
      };
    }
    return;
  }

  const files = listFiles(month);
  for (const f of files) {
    if (byLine) {
      let ln = 0;
      for (const line of arc.lines(toEntryName(f))) {
        ln += 1;
        yield { file: f, line: ln, text: line };
      }
    } else {
      yield {
        file: f,
        month: guessMonth(f),
        date: guessDate(f),
        content: arc.readText(toEntryName(f)),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// 小工具：从文件名中猜测月份 / 日期（用于展示，非精确语义）
// ---------------------------------------------------------------------------
function guessMonth(file) {
  const m = file.match(/(\d{4}年\d{2}月)/);
  return m ? m[1] : "";
}
function guessDate(file) {
  const m = file.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

// 便捷导出：统计
export function archiveStats() {
  const arc = openArchive();
  const all = arc.listAll();
  const mds = all.filter((n) => n.endsWith(".md"));
  const months = new Set();
  for (const n of mds) {
    const m = n.match(/(\d{4}年\d{2}月)/);
    if (m) months.add(m[1]);
  }
  return {
    archive: "HuChenFeng-main.zip",
    totalEntries: all.length,
    markdownFiles: mds.length,
    months: [...months].sort(),
    bytes: arc.size,
  };
}
