#!/usr/bin/env bash
# 亮哥发版助理 · 朋友端卸载脚本
#
# 用法:
#   curl -fsSL https://cdn.jsdelivr.net/gh/zhaoliang1926-tech/liangge-public@main/uninstall.sh | bash

set -euo pipefail

INSTALL_DIR="$HOME/.release-updater"

echo "━━━ 卸载 release-updater ━━━"

if command -v pm2 &>/dev/null; then
  pm2 delete release-updater &>/dev/null || true
  pm2 save &>/dev/null || true
  echo "  ✓ 已停 PM2 进程"
fi

if [ -f "$INSTALL_DIR/config.json" ]; then
  BACKUP="$HOME/Desktop/release-updater-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP"
  cp "$INSTALL_DIR/config.json" "$BACKUP/"
  echo "  ✓ config.json 已备份到 $BACKUP/"
fi

if [ -d "$INSTALL_DIR" ]; then
  rm -rf "$INSTALL_DIR"
  echo "  ✓ 已删 $INSTALL_DIR"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ release-updater 已卸载"
echo ""
echo "  备份位置: $HOME/Desktop/release-updater-backup-*"
echo ""
echo "  注意: 业务项目目录 (如 ~/moments, ~/wechat-pipeline) 保留不动."
echo "        如不再需要, 请自行 rm -rf"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
