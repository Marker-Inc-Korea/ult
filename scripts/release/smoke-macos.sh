#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PRODUCT_NAME="Ult"
APP_PATH="${1:-src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app}"
PLIST="$APP_PATH/Contents/Info.plist"
EXPECTED_BUNDLE_ID="engineer.ultra.ult"
SKIP_LAUNCH="${ULT_SKIP_LAUNCH:-0}"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
  fi
}

if [[ "$(uname -s)" != "Darwin" ]]; then
  fail "macOS smoke checks must run on Darwin"
fi

require_command open
require_command pgrep
require_command pkill
require_command /usr/libexec/PlistBuddy

[[ -d "$APP_PATH" ]] || fail "app bundle not found: $APP_PATH"
[[ -f "$PLIST" ]] || fail "Info.plist not found: $PLIST"

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$PLIST")"
DISPLAY_NAME="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$PLIST")"
EXECUTABLE="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$PLIST")"
VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$PLIST")"

[[ "$BUNDLE_ID" == "$EXPECTED_BUNDLE_ID" ]] || fail "unexpected bundle id: $BUNDLE_ID"
[[ "$DISPLAY_NAME" == "$PRODUCT_NAME" ]] || fail "unexpected bundle name: $DISPLAY_NAME"
[[ -n "$VERSION" ]] || fail "bundle version is empty"
[[ -x "$APP_PATH/Contents/MacOS/$EXECUTABLE" ]] || fail "bundle executable is not runnable: $EXECUTABLE"

printf 'OK: bundle identity %s %s (%s)\n' "$DISPLAY_NAME" "$VERSION" "$BUNDLE_ID"

if [[ "$SKIP_LAUNCH" == "1" ]]; then
  printf 'OK: launch smoke skipped by ULT_SKIP_LAUNCH=1\n'
  exit 0
fi

open -n "$APP_PATH"

for _ in {1..30}; do
  if pgrep -x "$EXECUTABLE" >/dev/null 2>&1; then
    printf 'OK: packaged app launched (%s)\n' "$EXECUTABLE"
    pkill -x "$EXECUTABLE" >/dev/null 2>&1 || true
    exit 0
  fi
  sleep 0.2
done

fail "packaged app did not launch within timeout"
