#!/usr/bin/env bash
# LOOPZLX 回归脚本：先起本地静态服务，再按编号顺序跑各模块自检。
# 用法：bash tests/run.sh            （默认端口 8770）
#      PORT=8771 bash tests/run.sh
set -u
PORT="${PORT:-8770}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! curl -s -o /dev/null "http://localhost:${PORT}/load.html"; then
  echo "[run] starting static server on ${PORT}"
  (cd "$ROOT" && nohup python3 -m http.server "$PORT" >/tmp/lzx-server.log 2>&1 &)
  sleep 1.5
fi

sed -i "s/8770/${PORT}/g" "$ROOT"/tests/*.py 2>/dev/null || true

fail=0
for f in "$ROOT"/tests/*.py; do
  echo "── $(basename "$f")"
  if python3 "$f" 2>&1 | tail -n 8; then :; else fail=1; fi
done
echo
if [ "$fail" = "0" ]; then echo "[run] done."; else echo "[run] some checks failed."; fi
