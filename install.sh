#!/bin/bash
set -euo pipefail

PLUGIN_DIR="$HOME/.swiftbar-plugins"
PLUGIN_NAME="claude-usage.2m.js"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Claude Usage Tracker installer"

if ! command -v brew >/dev/null 2>&1; then
  echo "ERROR: Homebrew is required. Install it from https://brew.sh first." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing node..."
  brew install node
fi

if ! command -v ccusage >/dev/null 2>&1; then
  echo "==> Installing ccusage..."
  npm install -g ccusage
fi

if [ ! -d "/Applications/SwiftBar.app" ]; then
  echo "==> Installing SwiftBar..."
  brew install --cask swiftbar
fi

NODE_BIN="$(command -v node)"
CCUSAGE_BIN="$(command -v ccusage)"

echo "==> Installing plugin to $PLUGIN_DIR/$PLUGIN_NAME"
mkdir -p "$PLUGIN_DIR"
sed -e "s|/opt/homebrew/bin/node|$NODE_BIN|g" \
    -e "s|/opt/homebrew/bin/ccusage|$CCUSAGE_BIN|g" \
    "$SCRIPT_DIR/$PLUGIN_NAME" > "$PLUGIN_DIR/$PLUGIN_NAME"
chmod +x "$PLUGIN_DIR/$PLUGIN_NAME"

defaults write com.ameba.SwiftBar PluginDirectory "$PLUGIN_DIR"

echo "==> Launching SwiftBar"
open -a SwiftBar
sleep 2
open -g "swiftbar://refreshallplugins" || true

echo ""
echo "Done! Look for the ✳ icon in your menu bar."
echo "If macOS asks for Keychain access to 'Claude Code-credentials', click 'Always Allow'."
echo "Make sure you are logged into Claude Code at least once on this machine."
