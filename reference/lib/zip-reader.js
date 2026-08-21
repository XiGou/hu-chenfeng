// =============================================================================
// reference/lib/zip-reader.js
// -----------------------------------------------------------------------------
// 纯 JS 的 ZIP 读取器 —— 不落盘、不解包整个压缩包，仅按需读取指定条目内容。
//
// 特性：
//   * 解析 ZIP 中央目录（End of Central Directory + Central Directory）
//   * 支持两种最常见的压缩方式：
//       - 0 (store)   ：直接按偏移截取原始字节
//       - 8 (deflate) ：用 Node 内置 zlib.inflateRawSync 就地解压
//   * 可枚举全部条目、按路径读取条目、按文件名匹配读取
//   * 纯 ESM，可在 Node 环境运行（依赖内置 fs / zlib，无需第三方包）
//
// 使用前提：本模块面向 Node 环境（命令行脚本 / 离线处理），因此使用
// `node:fs` 与 `node:zlib` 内置模块；若需在浏览器端使用，可将 deflate
// 解压替换为任一纯 JS inflate 实现（如 fflate），其余解析逻辑保持不变。
// =============================================================================

import { readFileSync, statSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

// ZIP 常量
const EOCD_SIG = 0x06054b50; // End of Central Directory signature
const CENTRAL_SIG = 0x02014b50; // Central Directory File Header signature
const LOCAL_SIG = 0x04034b50; // Local File Header signature

// ---------------------------------------------------------------------------
// 读取小端序整数（Buffer 读取工具）
// ---------------------------------------------------------------------------
function u16(buf, off) {
  return buf.readUInt16LE(off);
}
function u32(buf, off) {
  return buf.readUInt32LE(off);
}

// ---------------------------------------------------------------------------
// 在文件末尾回溯查找 End of Central Directory 记录
// ---------------------------------------------------------------------------
function findEOCD(buf) {
  const minOffset = Math.max(0, buf.length - 65557);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      return i;
    }
  }
  throw new Error("zip-reader: 未找到 End of Central Directory 记录，文件可能损坏或不是合法 ZIP");
}

// ---------------------------------------------------------------------------
// 解析中央目录，返回条目列表
// 每个条目字段（均为文件内的绝对偏移量）：
//   name           文件名
//   compression    压缩方式（0=store, 8=deflate）
//   crc32          CRC32 校验
//   compSize       压缩后大小
//   size           解压后大小
//   localOffset    对应 Local File Header 的偏移
//   dataOffset     实际数据区起始偏移
// ---------------------------------------------------------------------------
function parseCentralDirectory(buf, eocdOffset) {
  const totalEntries = u16(buf, eocdOffset + 10);
  const cdOffset = u32(buf, eocdOffset + 16);
  const cdSize = u32(buf, eocdOffset + 12);

  const entries = [];
  let p = cdOffset;
  const cdEnd = cdOffset + cdSize;

  for (let i = 0; i < totalEntries && p < cdEnd; i++) {
    if (buf.readUInt32LE(p) !== CENTRAL_SIG) {
      throw new Error("zip-reader: 中央目录签名不匹配，解析中断于条目 " + i);
    }
    const comp = u16(buf, p + 10);
    const compSize = u32(buf, p + 20);
    const size = u32(buf, p + 24);
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    const localOffset = u32(buf, p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    entries.push({
      name,
      compression: comp,
      compSize,
      size,
      localOffset,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// ---------------------------------------------------------------------------
// 根据中央目录条目，计算其数据区在文件中的绝对偏移
// 需要读取该条目的 Local File Header 来得到文件名/扩展字段长度。
// ---------------------------------------------------------------------------
function computeDataOffset(buf, entry) {
  const p = entry.localOffset;
  if (buf.readUInt32LE(p) !== LOCAL_SIG) {
    throw new Error("zip-reader: 本地头签名不匹配: " + entry.name);
  }
  const nameLen = u16(buf, p + 26);
  const extraLen = u16(buf, p + 28);
  return p + 30 + nameLen + extraLen;
}

// ---------------------------------------------------------------------------
// 提取单个条目 → Buffer
// ---------------------------------------------------------------------------
function extractEntry(buf, entry) {
  const dataOffset = computeDataOffset(buf, entry);
  const data = buf.subarray(dataOffset, dataOffset + entry.compSize);

  switch (entry.compression) {
    case 0: // store
      return Buffer.from(data);
    case 8: // deflate
      return inflateRawSync(data);
    default:
      throw new Error(
        `zip-reader: 不支持的压缩方式(${entry.compression}): ${entry.name}`
      );
  }
}

// ---------------------------------------------------------------------------
// ZipArchive —— 主类
// ---------------------------------------------------------------------------
export class ZipArchive {
  /**
   * @param {string} filePath ZIP 文件路径
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.size = statSync(filePath).size;
    this.buffer = readFileSync(filePath); // 将整个包读入内存（不解压）
    const eocd = findEOCD(this.buffer);
    this.entries = parseCentralDirectory(this.buffer, eocd);
    this._byName = new Map(this.entries.map((e) => [e.name, e]));
  }

  /** 全部条目名（可按需过滤目录） */
  listAll() {
    return this.entries.map((e) => e.name);
  }

  /** 判断某个条目是否存在 */
  has(name) {
    return this._byName.has(name);
  }

  /**
   * 读取某个条目的完整内容（文本）
   * @param {string} name ZIP 内的路径名，如 "HuChenFeng-main/2023年03月/2023-03-10.md"
   * @param {string} [encoding] 文本编码，默认 utf-8
   * @returns {string}
   */
  readText(name, encoding = "utf8") {
    const entry = this._byName.get(name);
    if (!entry) {
      throw new Error(`zip-reader: 条目不存在: ${name}`);
    }
    const raw = extractEntry(this.buffer, entry);
    return raw.toString(encoding);
  }

  /**
   * 读取某个条目的原始字节
   * @returns {Buffer}
   */
  readBuffer(name) {
    const entry = this._byName.get(name);
    if (!entry) {
      throw new Error(`zip-reader: 条目不存在: ${name}`);
    }
    return extractEntry(this.buffer, entry);
  }

  /**
   * 读取某个条目中指定行（1 起始）
   * @param {string} name ZIP 内路径名
   * @param {number} lineNumber 行号，从 1 开始
   * @returns {{ line: number, text: string, hasNext: boolean }}
   */
  readLine(name, lineNumber) {
    const text = this.readText(name);
    const lines = splitLines(text);
    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(
        `zip-reader: 行号越界 ${name}#${lineNumber}（共 ${lines.length} 行）`
      );
    }
    return {
      line: lineNumber,
      text: lines[lineNumber - 1],
      hasNext: lineNumber < lines.length,
    };
  }

  /**
   * 按行读取条目（惰性迭代器）
   * @param {string} name ZIP 内路径名
   * @returns {Generator<string>}
   */
  *lines(name) {
    const text = this.readText(name);
    for (const line of splitLines(text)) {
      yield line;
    }
  }
}

// ---------------------------------------------------------------------------
// 工具：按 \n 切分行（保留 Windows \r\n 与末尾行为）
// ---------------------------------------------------------------------------
export function splitLines(text) {
  if (!text) return [];
  return text.replace(/\r\n/g, "\n").split("\n");
}

// 便捷单例：默认引用库路径
export const DEFAULT_ZIP = new URL("./HuChenFeng-main.zip", import.meta.url);
export function openDefault() {
  return new ZipArchive(DEFAULT_ZIP.pathname);
}
