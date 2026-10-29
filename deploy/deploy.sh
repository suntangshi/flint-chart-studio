#!/usr/bin/env bash
# 在你自己的电脑上运行:把项目同步到服务器并重启服务
#   ./deploy/deploy.sh user@your-server
# 前提:服务器已装 Node 20+,并按 deploy/flint-studio.service 配好了 systemd 服务
set -euo pipefail
TARGET="${1:?用法: ./deploy/deploy.sh user@host}"
APP_DIR=/opt/flint-chart-studio

rsync -az --delete --exclude node_modules --exclude web/dist --exclude data --exclude '*.zip' ./ "$TARGET:$APP_DIR/"
ssh "$TARGET" "cd $APP_DIR && npm ci && npm run build && sudo mkdir -p /var/lib/flint-studio && sudo chown -R www-data /var/lib/flint-studio && sudo systemctl restart flint-studio && sleep 2 && curl -fsS -o /dev/null http://127.0.0.1:39015/api/datasets && echo 部署成功"
