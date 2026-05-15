#!/usr/bin/env bash
# 亮哥发版助理 · 简化安装脚本 (适合已有 node+npm 环境, 比如装过 Claude Code)
#
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/zhaoliang1926-tech/liangge-public/main/install-minimal.sh \
#     | bash -s -- --onb-token onb_xxx

set -euo pipefail
trap 'rc=$?; if [ $rc -ne 0 ]; then echo "" >&2; echo "✗ 第 $LINENO 行 exit $rc 退出" >&2; fi' EXIT

ONB_TOKEN=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --onb-token) ONB_TOKEN="$2"; shift 2 ;;
    *) shift ;;
  esac
done
[ -z "$ONB_TOKEN" ] && { echo "✗ 缺 --onb-token" >&2; exit 1; }

step() { echo ""; echo "━━━ $* ━━━"; }

# [1/5] 检查必备工具
step "[1/5] 检查环境"
for cmd in node npm curl tar python3; do
  if ! command -v $cmd &>/dev/null; then
    echo "  ✗ $cmd 未装. 请先用 install.sh (完整版) 装环境"
    exit 1
  fi
done
echo "  ✓ node $(node --version) / npm $(npm --version) / python3"

# [2/5] 装 pm2 (如果没)
step "[2/5] PM2"
if command -v pm2 &>/dev/null; then
  echo "  ✓ $(pm2 --version)"
else
  echo "  npm install -g pm2..."
  npm install -g pm2
  echo "  ✓ pm2 $(pm2 --version)"
fi

# [3/5] 拉 updater 客户端
step "[3/5] 拉 release-updater 客户端"
INSTALL_DIR="$HOME/.release-updater"
mkdir -p "$INSTALL_DIR/logs"
chmod 700 "$INSTALL_DIR"

TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT
curl -fsSL "https://github.com/zhaoliang1926-tech/liangge-public/tarball/main" \
  | tar -xz -C "$TMPDIR"
TOP=$(find "$TMPDIR" -maxdepth 1 -mindepth 1 -type d | head -1)
[ -d "$TOP/updater" ] || { echo "✗ 未找到 updater"; exit 1; }

rsync -a --delete \
  --exclude config.json --exclude state.json \
  --exclude staging --exclude logs \
  "$TOP/updater/" "$INSTALL_DIR/"

cd "$INSTALL_DIR"
echo "  装运行时依赖..."
npm install --omit=dev --silent
echo "  ✓ updater 已就绪"

# [4/5] 解 onb_token + 引导 PAT + 写 config
step "[4/5] 配置 + GitHub PAT"

TOKEN_BODY=${ONB_TOKEN#onb_}
ONB_JSON=$(echo "$TOKEN_BODY" | base64 -d 2>/dev/null) || {
  echo "✗ onb_token 格式错"; exit 1;
}

FRIEND_NAME=$(echo "$ONB_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["name"])')
SUBS=$(echo "$ONB_JSON" | python3 -c 'import sys,json; print(" ".join(json.load(sys.stdin).get("subscriptions",[])))')
echo "  ✓ friend = $FRIEND_NAME"
echo "  ✓ subscriptions: $SUBS"

cat <<EOF

请在 GitHub 给以下 repo 授权 read:
EOF
for repo in $SUBS; do
  echo "    - zhaoliang1926-tech/$repo"
done
cat <<EOF

步骤:
  1. 浏览器打开: https://github.com/settings/personal-access-tokens/new
  2. Token name:        liangge-updater
  3. Expiration:        90 days
  4. Repository access: Only select repositories → 勾上面 repo
  5. Permissions → Contents: Read-only, Metadata: Read-only
  6. Generate token → 复制
EOF

open "https://github.com/settings/personal-access-tokens/new" 2>/dev/null || true

echo ""
echo -n "粘 GH PAT (ghp_xxx 或 github_pat_xxx): "
read -r GH_TOKEN </dev/tty
[ -z "$GH_TOKEN" ] && { echo "✗ 未粘"; exit 1; }

HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GH_TOKEN" https://api.github.com/user)
[ "$HTTP" = "200" ] || { echo "✗ PAT 无效 (HTTP $HTTP)"; exit 1; }
echo "  ✓ PAT 验证通过"

# 用 python3 安全 escape 写 config.json (不依赖 jq)
TOKEN_BODY_FOR_PY="$TOKEN_BODY" GH_TOKEN_FOR_PY="$GH_TOKEN" python3 <<'PYEOF'
import json, os, base64
onb_body = os.environ["TOKEN_BODY_FOR_PY"]
gh_token = os.environ["GH_TOKEN_FOR_PY"]
d = json.loads(base64.b64decode(onb_body))
cfg = {
  "friend_id": d["friend_id"],
  "feishu_app_id": d["feishu_app_id"],
  "feishu_app_secret": d["feishu_app_secret"],
  "updater_token": d["updater_token"],
  "github_token": gh_token,
  "bridge_chat_id": d["bridge_chat_id"],
  "projects": d.get("projects", {}),
}
home = os.path.expanduser("~")
path = f"{home}/.release-updater/config.json"
with open(path, "w") as f:
  json.dump(cfg, f, indent=2, ensure_ascii=False)
os.chmod(path, 0o600)
print(f"  ✓ {path} (chmod 600)")
PYEOF

# [5/5] pm2 start + 验证
step "[5/5] 启动 daemon + 验证"

pm2 delete release-updater &>/dev/null || true
pm2 start "$INSTALL_DIR/dist/index.js" \
  --name release-updater --time \
  --output "$INSTALL_DIR/logs/out.log" \
  --error "$INSTALL_DIR/logs/err.log"
pm2 save

sleep 4

STATUS=$(pm2 jlist | python3 -c '
import sys, json
for p in json.load(sys.stdin):
  if p.get("name") == "release-updater":
    print(p.get("pm2_env", {}).get("status", "?"))
    break
else:
  print("missing")
')

if [ "$STATUS" = "online" ]; then
  echo "  ✓ daemon online"
  osascript -e "display notification \"$FRIEND_NAME 你好, daemon 已上线\" with title \"亮哥发版助理\" sound name \"Glass\"" 2>/dev/null || true
  cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ 安装完成

  管理命令:
    pm2 logs release-updater    看日志
    pm2 restart release-updater 重启
    pm2 list                    看状态
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
else
  echo "  ✗ daemon 状态: $STATUS"
  pm2 logs release-updater --lines 30 --nostream
  exit 1
fi
