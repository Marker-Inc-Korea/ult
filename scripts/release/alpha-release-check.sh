#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PRODUCT_NAME="Ult"
VERSION="$(sed -nE 's/.*"version": "([^"]+)".*/\1/p' package.json | head -n 1)"
ARCH="$(uname -m)"
TAG="${GITHUB_REF_NAME:-v${VERSION}}"
if [[ "$TAG" != v* ]]; then
  TAG="v${VERSION}"
fi

APP_PATH="${1:-src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app}"
DMG_PATH="${2:-src-tauri/target/release/bundle/dmg/${PRODUCT_NAME}_${VERSION}_${ARCH}.dmg}"
CHECKSUM_PATH="${3:-${DMG_PATH}.sha256}"
NOTES_PATH="${4:-src-tauri/target/release/bundle/dmg/release-notes-${TAG}.md}"
REQUIRE_RELEASE="${ULT_REQUIRE_RELEASE:-0}"
REQUIRE_MANUAL="${ULT_REQUIRE_ALPHA_MANUAL:-0}"
MANUAL_REPORT="${ULT_ALPHA_REPORT:-}"
SKIP_LAUNCH="${ULT_SKIP_LAUNCH:-1}"
STATUS=0
MOUNT_POINT=""

cleanup() {
  if [[ -n "$MOUNT_POINT" && -d "$MOUNT_POINT" ]]; then
    hdiutil detach "$MOUNT_POINT" -quiet >/dev/null 2>&1 || true
    rmdir "$MOUNT_POINT" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  STATUS=1
}

ok() {
  printf 'OK: %s\n' "$1"
}

require_file() {
  local path="$1"
  local label="$2"
  if [[ -e "$path" ]]; then
    ok "$label exists: $path"
  else
    fail "$label missing: $path"
  fi
}

require_command() {
  if command -v "$1" >/dev/null 2>&1; then
    return
  fi
  fail "missing command: $1"
}

validate_release_notes() {
  require_file "$NOTES_PATH" "release notes"
  [[ -f "$NOTES_PATH" ]] || return

  for heading in \
    "## Supported Platforms" \
    "## Supported Native Delivery Targets" \
    "## Known Limitations" \
    "## Privacy Boundary" \
    "## Manual Update"
  do
    if grep -Fq "$heading" "$NOTES_PATH"; then
      ok "release notes include ${heading}"
    else
      fail "release notes missing ${heading}"
    fi
  done

  for forbidden in "terminal contents" "shell history" "agent responses"; do
    if grep -Fiq "$forbidden" "$NOTES_PATH"; then
      ok "release notes state privacy boundary for ${forbidden}"
    else
      fail "release notes do not state privacy boundary for ${forbidden}"
    fi
  done

  for stale in "allowlist" "copy-only" "copy fallback" "fallback copy"; do
    if grep -Fiq "$stale" "$NOTES_PATH"; then
      fail "release notes contain stale product wording: ${stale}"
    else
      ok "release notes avoid stale product wording: ${stale}"
    fi
  done
}

validate_dmg_layout() {
  require_file "$DMG_PATH" "DMG"
  [[ -f "$DMG_PATH" ]] || return
  if [[ "$(uname -s)" != "Darwin" ]]; then
    printf 'WARN: skipping DMG mount layout check outside macOS\n' >&2
    return
  fi
  require_command hdiutil
  [[ "$STATUS" == "0" ]] || return

  MOUNT_POINT="$(mktemp -d "${TMPDIR:-/tmp}/ult-dmg-check.XXXXXX")"
  hdiutil attach "$DMG_PATH" -nobrowse -readonly -mountpoint "$MOUNT_POINT" -quiet
  if [[ -d "$MOUNT_POINT/${PRODUCT_NAME}.app" ]]; then
    ok "DMG contains ${PRODUCT_NAME}.app"
  else
    fail "DMG does not contain ${PRODUCT_NAME}.app"
  fi
  if [[ -L "$MOUNT_POINT/Applications" || -d "$MOUNT_POINT/Applications" ]]; then
    ok "DMG contains Applications link"
  else
    fail "DMG does not contain Applications link"
  fi
}

printf '# Ult Alpha Release Check\n\n'
printf '| Field | Value |\n'
printf '| --- | --- |\n'
printf '| Version | %s |\n' "$VERSION"
printf '| App | `%s` |\n' "$APP_PATH"
printf '| DMG | `%s` |\n' "$DMG_PATH"
printf '| Checksum | `%s` |\n' "$CHECKSUM_PATH"
printf '| Release notes | `%s` |\n' "$NOTES_PATH"
printf '| Strict release required | `%s` |\n' "$REQUIRE_RELEASE"
printf '| Manual report required | `%s` |\n' "$REQUIRE_MANUAL"
printf '| Manual report | `%s` |\n' "${MANUAL_REPORT:-not provided}"
printf '| Smoke launch skipped | `%s` |\n\n' "$SKIP_LAUNCH"

require_command codesign
require_command shasum
require_file "$APP_PATH" "app bundle"
require_file "$CHECKSUM_PATH" "checksum"
validate_release_notes
validate_dmg_layout

if [[ "$REQUIRE_RELEASE" == "1" ]]; then
  ULT_REQUIRE_SIGNING=1 scripts/release/verify-macos.sh "$APP_PATH" "$DMG_PATH" "$CHECKSUM_PATH" || STATUS=1
else
  scripts/release/verify-macos.sh "$APP_PATH" "$DMG_PATH" "$CHECKSUM_PATH" || STATUS=1
fi

ULT_SKIP_LAUNCH="$SKIP_LAUNCH" scripts/release/smoke-macos.sh "$APP_PATH" || STATUS=1

if [[ -n "$MANUAL_REPORT" ]]; then
  scripts/release/alpha-report.sh verify "$MANUAL_REPORT" || STATUS=1
elif [[ "$REQUIRE_MANUAL" == "1" ]]; then
  fail "ULT_REQUIRE_ALPHA_MANUAL=1 requires ULT_ALPHA_REPORT"
fi

if [[ "$STATUS" != "0" ]]; then
  exit "$STATUS"
fi

if [[ -n "$MANUAL_REPORT" ]]; then
  cat <<'EOF'

OK: automated alpha release checks passed.
OK: manual alpha report verified.
EOF
  exit 0
fi

cat <<'EOF'

OK: automated alpha release checks passed.

Manual gates still required before public alpha:

- Fresh install menu-bar launch
- Tray menu open/close behavior
- Native Delivery denied and granted paths
- Multi-monitor Palette and Launcher behavior
- Personal Library path boundary and $skill source reveal
- Accessibility identity after relaunch and update
- Human review of generated release notes
EOF
