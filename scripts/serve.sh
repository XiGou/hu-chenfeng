#!/usr/bin/env bash
# ==========================================================================
# serve.sh — 本地 / CNB 云原生开发环境静态站点预览
#
# 用法：
#   ./scripts/serve.sh [端口]      # 默认 8000
#
# 站点为纯静态零依赖，任意静态服务器可直接承载。
# 在 CNB 云原生开发环境中运行后，可通过 WebIDE「端口」面板的
# 端口映射 URL（形如 https://xxx-{{port}}.cnb.run）直接访问。
# ==========================================================================
set -euo pipefail

PORT="${1:-8000}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"

if command -v python3 >/dev/null 2>&1; then
  echo "==> 启动静态站点: http://0.0.0.0:${PORT}  (Ctrl+C 停止)"
  exec python3 -m http.server "${PORT}" --bind 0.0.0.0
elif command -v python >/dev/null 2>&1; then
  echo "==> 启动静态站点: http://0.0.0.0:${PORT}  (Ctrl+C 停止)"
  exec python -m SimpleHTTPServer "${PORT}"
elif command -v npx >/dev/null 2>&1; then
  echo "==> 启动静态站点: http://0.0.0.0:${PORT}  (Ctrl+C 停止)"
  exec npx serve -l "${PORT}" .
else
  echo "错误: 未找到 python3 / python / npx，无法启动静态服务器。" >&2
  exit 1
fi
