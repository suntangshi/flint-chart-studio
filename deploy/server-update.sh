#!/usr/bin/env bash
# 在服务器上运行:拉取最新代码,有变化就重新构建并重启容器。
#   首次:  bash deploy/server-update.sh            (会直接构建并启动)
#   定时:  crontab -e 加一行(每 5 分钟检查一次):
#          */5 * * * * cd /opt/flint-chart-studio && bash deploy/server-update.sh >> /var/log/flint-studio-update.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=flint-studio
PORT="${PORT:-3000}"

git fetch --quiet origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse '@{u}')
RUNNING=$(docker ps -q -f "name=^${NAME}$")

if [ "$LOCAL" = "$REMOTE" ] && [ -n "$RUNNING" ]; then
  exit 0   # 没有新代码,容器也在跑
fi

echo "$(date '+%F %T') 更新到 ${REMOTE:0:7}"
git merge --ff-only --quiet '@{u}'
docker build -q -t "$NAME" .
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped -p "$PORT:3000" -v flint-data:/data "$NAME" >/dev/null

for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/datasets"; then echo "已上线:http://<服务器IP>:$PORT"; exit 0; fi
  sleep 1
done
echo "启动后自检失败,查看日志:docker logs $NAME" >&2
exit 1
