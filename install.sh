#!/usr/bin/env bash
# 亮哥发版助理 · 朋友首装一键脚本
#
# 用法 (朋友 Mac 上跑):
#   curl -fsSL https://cdn.jsdelivr.net/gh/zhaoliang1926-tech/liangge-public@main/install.sh \
#     | bash -s -- --onb-token onb_xxxxx

set -euo pipefail

ONB_TOKEN=""
PUBLIC_REPO="zhaoliang1926-tech/liangge-public"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --onb-token) ONB_TOKEN="$2"; shift 2 ;;
    --public-repo) PUBLIC_REPO="$2"; shift 2 ;;
    -h|--help) head -10 "$0"; exit 0 ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$ONB_TOKEN" ]; then
  echo "✗ 缺少 --onb-token 参数, 请向亮哥索要" >&2
  exit 1
fi

print_step() { echo ""; echo "━━━ $* ━━━"; }

# [1/8] macOS 版本
print_step "[1/8] macOS 版本检查"
OS_VER=$(sw_vers -productVersion)
OS_MAJOR=$(echo "$OS_VER" | cut -d. -f1)
if [ "$OS_MAJOR" -lt 12 ]; then
  echo "✗ 需要 macOS 12+, 当前: $OS_VER" >&2
  exit 1
fi
ARCH=$(uname -m)
echo "  ✓ macOS $OS_VER ($ARCH)"

# [2/8] Xcode CLT
print_step "[2/8] Xcode Command Line Tools"
if xcode-select -p &>/dev/null && [ -x "$(xcode-select -p)/usr/bin/git" ]; then
  echo "  ✓ 已安装 ($(xcode-select -p))"
else
  echo "  CLT 未装, 自动启动安装..."
  echo "  (需要你 Mac 登录密码, 提示 Password 时输入)"

  # macOS 13+ trick: 建 magic file 让 softwareupdate 列出 CLT
  sudo touch /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress

  echo "  拉取 CLT 列表 (5-30 秒)..."
  CLT_LABEL=$(softwareupdate -l 2>&1 | awk -F'Label: ' '/Command Line Tools/{print $2}' | sort -V | tail -1)

  if [ -n "$CLT_LABEL" ]; then
    echo "  找到: $CLT_LABEL"
    echo "  下载安装 (约 900 MB, 5-15 分钟, 终端会显示进度)..."
    sudo softwareupdate -i "$CLT_LABEL" --verbose
    sudo rm -f /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress

    if xcode-select -p &>/dev/null && [ -x "$(xcode-select -p)/usr/bin/git" ]; then
      echo "  ✓ CLT 安装成功 ($(xcode-select -p))"
    else
      echo "  ✗ 装完但 xcode-select 没识别, 请手动跑 xcode-select -p 排查"
      exit 1
    fi
  else
    # 兜底: softwareupdate 没列出 CLT, 走老 GUI 对话框路径
    sudo rm -f /tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress
    echo "  softwareupdate 没列出 CLT, 试 GUI 对话框路径..."
    xcode-select --install 2>&1 || true
    echo ""
    echo "  如未弹窗 (macOS 26+ beta 可能), 请去 App Store 装 Xcode:"
    echo "    open 'macappstore://apps.apple.com/app/id497799835'"
    echo "  装完后重跑此脚本"
    exit 0
  fi
fi

# [3/8] Homebrew
print_step "[3/8] Homebrew"
if command -v brew &>/dev/null; then
  echo "  ✓ $(brew --version | head -1)"
else
  echo "  正在安装 (可能几分钟)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [ "$ARCH" = "arm64" ] && [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -f /usr/local/bin/brew ]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
fi

# [4/8] node@20 / jq / pm2
print_step "[4/8] 基础依赖 (node@20, jq, pm2)"
brew list node@20 &>/dev/null || brew install node@20
if [ "$ARCH" = "arm64" ]; then
  export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
else
  export PATH="/usr/local/opt/node@20/bin:$PATH"
fi
brew list jq &>/dev/null || brew install jq
command -v pm2 &>/dev/null || npm install -g pm2
echo "  ✓ node $(node -v) / jq / pm2 $(pm2 --version)"

# [5/8] 拉 updater 客户端
print_step "[5/8] 拉 release-updater 客户端"
INSTALL_DIR="$HOME/.release-updater"
mkdir -p "$INSTALL_DIR" "$INSTALL_DIR/logs"
chmod 700 "$INSTALL_DIR"

TARBALL_URL="https://github.com/${PUBLIC_REPO}/tarball/main"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

curl -fsSL "$TARBALL_URL" | tar -xz -C "$TMPDIR"
TOP=$(find "$TMPDIR" -maxdepth 1 -mindepth 1 -type d | head -1)
if [ -z "$TOP" ] || [ ! -d "$TOP/updater" ]; then
  echo "✗ 未在 $PUBLIC_REPO 找到 updater/ 目录" >&2
  exit 1
fi

rsync -a --delete \
  --exclude config.json --exclude state.json \
  --exclude staging --exclude logs \
  "$TOP/updater/" "$INSTALL_DIR/"

cd "$INSTALL_DIR"
if [ -f package.json ]; then
  echo "  装 updater 运行时依赖..."
  npm install --omit=dev --silent
fi
echo "  ✓ updater 已就绪 ($INSTALL_DIR)"

# [6/8] 解 onb_token + 引导生成 GH PAT
print_step "[6/8] 解析 onboarding token"
TOKEN_BODY=${ONB_TOKEN#onb_}
if ! TOKEN_JSON=$(echo "$TOKEN_BODY" | base64 -d 2>/dev/null); then
  echo "✗ onb_token 格式错误 (不是合法 base64)" >&2
  exit 1
fi
if ! echo "$TOKEN_JSON" | jq . &>/dev/null; then
  echo "✗ onb_token 解出来不是合法 JSON" >&2
  exit 1
fi

FRIEND_ID=$(echo "$TOKEN_JSON" | jq -r '.friend_id // empty')
FRIEND_NAME=$(echo "$TOKEN_JSON" | jq -r '.name // empty')
if [ -z "$FRIEND_ID" ]; then
  echo "✗ onb_token 缺 friend_id" >&2
  exit 1
fi

SUBSCRIPTIONS=$(echo "$TOKEN_JSON" | jq -r '.subscriptions[]?')
echo "  ✓ friend = $FRIEND_NAME ($FRIEND_ID)"
echo "  ✓ subscriptions:"
echo "$SUBSCRIPTIONS" | sed 's/^/      - /'

cat <<EOF

请在 GitHub 给以下 repo 授权 (read contents):
EOF
echo "$SUBSCRIPTIONS" | while read -r repo; do
  [ -n "$repo" ] && echo "    - zhaoliang1926-tech/$repo"
done
cat <<EOF

操作步骤:
  1. 浏览器打开: https://github.com/settings/personal-access-tokens/new
  2. Token name:         liangge-updater
  3. Expiration:         90 days
  4. Repository access:  Only select repositories → 勾选上面所列 repo
  5. Permissions:
       Contents:  Read-only
       Metadata:  Read-only (强制)
  6. 点 Generate token → 复制
EOF

echo ""
echo -n "粘贴 GH PAT 到这里: "
read -r GITHUB_TOKEN
if [ -z "$GITHUB_TOKEN" ]; then
  echo "✗ 未粘贴 token" >&2
  exit 1
fi

HTTP=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user)
if [ "$HTTP" != "200" ]; then
  echo "✗ PAT 验证失败 (HTTP $HTTP), 请重新生成" >&2
  exit 1
fi
echo "  ✓ PAT 验证通过"

# [7/8] 写 config.json + pm2 start
print_step "[7/8] 写 config.json + 启动 daemon"

PROJECTS_JSON=$(echo "$TOKEN_JSON" | jq -c '.projects // {}')
FEISHU_APP_ID=$(echo "$TOKEN_JSON" | jq -r '.feishu_app_id')
FEISHU_APP_SECRET=$(echo "$TOKEN_JSON" | jq -r '.feishu_app_secret')
UPDATER_TOKEN=$(echo "$TOKEN_JSON" | jq -r '.updater_token')
BRIDGE_CHAT_ID=$(echo "$TOKEN_JSON" | jq -r '.bridge_chat_id')

jq -n \
  --arg fid "$FRIEND_ID" \
  --arg fappid "$FEISHU_APP_ID" \
  --arg fappsecret "$FEISHU_APP_SECRET" \
  --arg utok "$UPDATER_TOKEN" \
  --arg gtok "$GITHUB_TOKEN" \
  --arg bchat "$BRIDGE_CHAT_ID" \
  --argjson projects "$PROJECTS_JSON" \
  '{
    friend_id: $fid,
    feishu_app_id: $fappid,
    feishu_app_secret: $fappsecret,
    updater_token: $utok,
    github_token: $gtok,
    bridge_chat_id: $bchat,
    projects: $projects
  }' > "$INSTALL_DIR/config.json"

chmod 600 "$INSTALL_DIR/config.json"
echo "  ✓ config.json 已写入 (chmod 600)"

pm2 delete release-updater &>/dev/null || true
pm2 start "$INSTALL_DIR/dist/index.js" \
  --name release-updater --time \
  --max-memory-restart 256M \
  --output "$INSTALL_DIR/logs/out.log" \
  --error "$INSTALL_DIR/logs/err.log"
pm2 save

echo ""
echo "  配置开机自启 (可能要求 sudo 密码)..."
STARTUP_CMD=$(pm2 startup launchd -u "$USER" --hp "$HOME" 2>&1 | grep "sudo " || true)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD" || echo "  ⚠ 开机自启配置失败 (可手动重跑: $STARTUP_CMD)"
fi

# [8/8] 验证
print_step "[8/8] 验证 daemon 上线"
sleep 6
DAEMON_STATUS=$(pm2 jlist | jq -r '.[] | select(.name=="release-updater") | .pm2_env.status' 2>/dev/null || echo "missing")
if [ "$DAEMON_STATUS" = "online" ]; then
  echo "  ✓ daemon online (PID: $(pm2 jlist | jq -r '.[] | select(.name=="release-updater") | .pid'))"
else
  echo "  ✗ daemon 状态: $DAEMON_STATUS"
  pm2 logs release-updater --lines 20 --nostream || true
  exit 1
fi

osascript -e "display notification \"$FRIEND_NAME 你好, 亮哥发版助理 daemon 已上线\" with title \"release-updater\" sound name \"Glass\"" 2>/dev/null || true

cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ 安装完成

  请去飞书群查看欢迎卡片. 后续亮哥发版时, 你会在群里收到 [待确认]
  卡片, 点 [同意更新] 即可自动安装最新版.

  管理命令:
    pm2 logs release-updater          看日志
    pm2 reload release-updater        重启
    pm2 list                          看进程
    pm2 delete release-updater        停止
    rm -rf ~/.release-updater         卸载
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
