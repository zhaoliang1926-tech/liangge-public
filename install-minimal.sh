#!/usr/bin/env bash
# 亮哥发版助理 · 简化安装脚本 (适合已有 node+npm 环境, 比如装过 Claude Code)
#
# 用法:
#   curl -fsSL https://raw.githubusercontent.com/zhaoliang1926-tech/liangge-public/main/install-minimal.sh \
#     | bash -s -- --onb-token onb_xxx
#
# 朋友交互: 1) sudo 密码 (装 gh/pm2) | 2) 浏览器 GitHub Device 授权 | 完事

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

# 主动 source brew env (新 shell 默认 PATH 没含 /opt/homebrew/bin)
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi
# brew 的 node@20 是 keg-only, 需手动加 PATH
if [ -d /opt/homebrew/opt/node@20/bin ]; then
  export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
elif [ -d /usr/local/opt/node@20/bin ]; then
  export PATH="/usr/local/opt/node@20/bin:$PATH"
fi

# [1/5] 检查必备工具
step "[1/5] 检查环境"
for cmd in node npm curl tar python3; do
  if ! command -v $cmd &>/dev/null; then
    echo "  ✗ $cmd 未装. 请先用 install.sh (完整版) 装环境"
    exit 1
  fi
done
echo "  ✓ node $(node --version) / npm $(npm --version) / python3"

# [2/5] 装 pm2 + gh cli (如果没)
step "[2/5] PM2 + GitHub CLI"
if command -v pm2 &>/dev/null; then
  echo "  ✓ pm2 $(pm2 --version | head -1)"
else
  echo "  npm install -g pm2..."
  npm install -g pm2
  echo "  ✓ pm2 $(pm2 --version)"
fi
if command -v gh &>/dev/null; then
  echo "  ✓ $(gh --version | head -1)"
else
  if ! command -v brew &>/dev/null; then
    echo "  ✗ 需要 brew 装 gh cli. 请先跑 install.sh (完整版)"
    exit 1
  fi
  echo "  brew install gh..."
  brew install gh
  echo "  ✓ $(gh --version | head -1)"
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

# [4/5] 解 onb_token + GitHub Device Flow 登录 + 自动接受 repo 邀请 + 写 config
step "[4/5] GitHub 登录 + 接受邀请 + 配置"

TOKEN_BODY=${ONB_TOKEN#onb_}
ONB_JSON=$(echo "$TOKEN_BODY" | base64 -d 2>/dev/null) || {
  echo "✗ onb_token 格式错"; exit 1;
}

FRIEND_NAME=$(echo "$ONB_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["name"])')
SUBS=$(echo "$ONB_JSON" | python3 -c 'import sys,json; print(" ".join(json.load(sys.stdin).get("subscriptions",[])))')
echo "  ✓ friend = $FRIEND_NAME"
echo "  ✓ subscriptions: $SUBS"
echo ""

# Device Flow 登录 (如已登录会自动 skip)
if gh auth status &>/dev/null; then
  GH_USER=$(gh api /user --jq .login 2>/dev/null || echo "?")
  echo "  ✓ GitHub 已登录: $GH_USER"
else
  cat <<EOF
  下一步: GitHub Device Flow 授权 (比手动建 PAT 简单 — 0 选项)
    1) 终端会显示 8 位 code (例: ABCD-1234)
    2) 自动打开浏览器, 登录你的 GitHub 账号
    3) 粘 8 位 code → 点 Authorize → 完事

EOF
  gh auth login --hostname github.com --git-protocol https --web --scopes "repo" </dev/tty
  GH_USER=$(gh api /user --jq .login 2>/dev/null || echo "?")
  echo "  ✓ GitHub 登录: $GH_USER"
fi
echo ""

GH_TOKEN=$(gh auth token)
[ -z "$GH_TOKEN" ] && { echo "✗ gh auth token 取不到"; exit 1; }

# 自动接受 repo 邀请
echo "  自动接受 repo 邀请..."
for repo in $SUBS; do
  INV_ID=$(gh api /user/repository_invitations --jq ".[] | select(.repository.full_name == \"zhaoliang1926-tech/$repo\") | .id" 2>/dev/null || echo "")
  if [ -n "$INV_ID" ]; then
    gh api -X PATCH "/user/repository_invitations/$INV_ID" >/dev/null && \
      echo "    ✓ 接受 zhaoliang1926-tech/$repo 邀请"
  else
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GH_TOKEN" \
      "https://api.github.com/repos/zhaoliang1926-tech/$repo")
    if [ "$HTTP" = "200" ]; then
      echo "    ✓ zhaoliang1926-tech/$repo 已可访问"
    else
      echo "    ⚠ zhaoliang1926-tech/$repo HTTP $HTTP — 请让亮哥 \`liangge sub add $FRIEND_NAME $repo\` 重发邀请"
    fi
  fi
done
echo ""

# 用 python3 安全 escape 写 config.json (不依赖 jq)
TOKEN_BODY_FOR_PY="$TOKEN_BODY" GH_TOKEN_FOR_PY="$GH_TOKEN" python3 <<'PYEOF'
import json, os, base64
onb_body = os.environ["TOKEN_BODY_FOR_PY"]
gh_token = os.environ["GH_TOKEN_FOR_PY"]
d = json.loads(base64.b64decode(onb_body))
cfg = {
  "friend_id": d["friend_id"],
  "friend_name": d.get("name", d["friend_id"]),
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
  ✓ 安装完成 — $FRIEND_NAME 的 daemon 已上线

  接下来 (推荐立刻做):
    1. 终端跑: cd ~/[项目名] && claude
       例: cd ~/moments && claude
    2. Claude 第一次进入会引导你填人设和样本 (一次性, 永久保留)
    3. 之后亮哥发版 → 飞书群卡片点 [同意更新] → 自动装

  管理命令 (一般用不上):
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
