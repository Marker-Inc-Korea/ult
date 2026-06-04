#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" == "Darwin" ]]; then
  export LANG=en_US.UTF-8
  export LC_CTYPE=en_US.UTF-8
  unset LC_ALL
fi

PRODUCT_NAME="Ult"
VERSION="$(sed -nE 's/.*"version": "([^"]+)".*/\1/p' package.json | head -n 1)"
ARCH="$(uname -m)"
APP_PATH="${1:-src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app}"
DMG="${2:-src-tauri/target/release/bundle/dmg/${PRODUCT_NAME}_${VERSION}_${ARCH}.dmg}"
CHECKSUM="${3:-${DMG}.sha256}"
REQUIRE_SIGNING="${ULT_REQUIRE_SIGNING:-0}"
STATUS=0

warn() {
  printf 'WARN: %s\n' "$1" >&2
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  STATUS=1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
  fi
}

require_command codesign
require_command shasum

if [[ "$REQUIRE_SIGNING" == "1" ]]; then
  require_command spctl
  require_command xcrun
fi

if [[ ! -d "$APP_PATH" ]]; then
  fail "app bundle not found: $APP_PATH"
elif ! codesign --verify --deep --strict --verbose=2 "$APP_PATH"; then
  fail "app codesign verification failed"
else
  printf 'OK: app codesign verification passed\n'
fi

APP_SIGNATURE="$(codesign -dv --verbose=4 "$APP_PATH" 2>&1 || true)"
printf '%s\n' "$APP_SIGNATURE" | grep -E '^(Identifier|Authority|TeamIdentifier|Signature)=' || true

if [[ "$REQUIRE_SIGNING" == "1" ]]; then
  if printf '%s\n' "$APP_SIGNATURE" | grep -Eq '^Signature=adhoc$'; then
    fail "release app is ad-hoc signed"
  fi
  if ! printf '%s\n' "$APP_SIGNATURE" | grep -Eq '^Authority=Developer ID Application:'; then
    fail "release app is not signed with a Developer ID Application certificate"
  fi
  if ! xcrun stapler validate "$APP_PATH"; then
    fail "app notarization staple validation failed"
  fi
  if ! spctl --assess --type execute --verbose "$APP_PATH"; then
    fail "app Gatekeeper assessment failed"
  fi
fi

if [[ ! -f "$DMG" ]]; then
  fail "DMG not found: $DMG"
elif [[ -f "$CHECKSUM" ]]; then
  if (cd "$(dirname "$CHECKSUM")" && shasum -a 256 -c "$(basename "$CHECKSUM")"); then
    printf 'OK: DMG checksum verification passed\n'
  else
    fail "DMG checksum verification failed"
  fi
else
  warn "checksum file not found: $CHECKSUM"
fi

if [[ "$REQUIRE_SIGNING" == "1" && -f "$DMG" ]]; then
  if ! codesign --verify --deep --strict --verbose=2 "$DMG"; then
    fail "DMG codesign verification failed"
  fi
  if ! xcrun stapler validate "$DMG"; then
    fail "DMG notarization staple validation failed"
  fi
  if ! spctl --assess --type open --verbose "$DMG"; then
    fail "DMG Gatekeeper assessment failed"
  fi
fi

if [[ "$STATUS" != "0" ]]; then
  exit "$STATUS"
fi

printf 'OK: macOS release verification complete\n'
