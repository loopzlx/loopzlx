#!/usr/bin/env bash
# LOOPZLX 回归脚本：起本地静态服务，按编号顺序跑各模块自检，任何一项失败则整体退出码非 0。
# 依赖：python3 + playwright（pip install playwright && playwright install chromium）
# 用法：bash tests/run.sh                 默认端口 8770
#      PORT=8771 bash tests/run.sh       换端口
#      CHROMIUM=/path/to/chrome bash tests/run.sh   指定浏览器可执行文件（默认用 playwright 自带的）
#      OUT_DIR=./out bash tests/run.sh   截图输出目录（默认系统临时目录）
set -u
export PORT="${PORT:-8770}"
export OUT_DIR="${OUT_DIR:-${TMPDIR:-/tmp}}"
mkdir -p "$OUT_DIR"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

SERVER_PID=""
if ! curl -s -o /dev/null "http://localhost:${PORT}/load.html"; then
  echo "[run] starting static server on ${PORT}"
  (cd "$ROOT" && python3 -m http.server "$PORT" >"$OUT_DIR/lzx-server.log" 2>&1) &
  SERVER_PID=$!
  trap '[ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null' EXIT
  for _ in $(seq 1 20); do curl -s -o /dev/null "http://localhost:${PORT}/load.html" && break; sleep 0.25; done
fi

# 探测外网：音频直链 / GitHub API 相关检查离线时自动跳过
if [ -z "${LZX_NET:-}" ]; then
  export LZX_NET=1   # 具体是否离线由测试在浏览器里探测（75-judge-view 会自动跳过依赖外网的检查）
fi

# 先做静态检查：所有 JS 语法
fail=0
if command -v node >/dev/null 2>&1; then
  echo "── node --check js/**"
  while IFS= read -r f; do node --check "$f" || { echo "SYNTAX ERROR: $f"; fail=1; }; done < <(find "$ROOT/js" "$ROOT/sw.js" -name '*.js')
fi

for f in "$ROOT"/tests/*.py; do
  echo "── $(basename "$f")"
  out="$(python3 "$f" 2>&1)"; code=$?
  echo "$out" | tail -n 14
  if [ "$code" != "0" ] || echo "$out" | grep -qE '^FAIL|Traceback'; then fail=1; echo "   ✗ $(basename "$f") failed"; fi
done

echo
if [ "$fail" = "0" ]; then echo "[run] all passed."; else echo "[run] some checks FAILED."; fi
exit "$fail"
