#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ "$(uname -s)" == "Darwin" ]]; then
  export LANG=en_US.UTF-8
  export LC_CTYPE=en_US.UTF-8
  unset LC_ALL
fi

VERSION="$(sed -nE 's/.*"version": "([^"]+)".*/\1/p' package.json | head -n 1)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
PRODUCT_NAME="Ult"
REF_NAME="${GITHUB_REF_NAME:-}"
if [[ "$REF_NAME" == v* ]]; then
  TAG="$REF_NAME"
else
  TAG="v${VERSION}"
fi
ARCH="$(uname -m)"
DMG_DIR="src-tauri/target/release/bundle/dmg"
APP_PATH="src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app"
DMG="${DMG_DIR}/${PRODUCT_NAME}_${VERSION}_${ARCH}.dmg"
CHECKSUM="${DMG}.sha256"
NOTES="$DMG_DIR/release-notes-${TAG}.md"
APP_NOTARY_ZIP="$DMG_DIR/${PRODUCT_NAME}_${VERSION}_${ARCH}.app.zip"
STAGING_ROOT=""
REQUIRE_RELEASE="${ULT_REQUIRE_RELEASE:-0}"
NOTARY_ENABLED=0
SIGNING_STATE="ad-hoc local signing"
NOTARIZATION_STATE="not notarized"

cleanup() {
  if [[ -n "$STAGING_ROOT" && -d "$STAGING_ROOT" ]]; then
    rm -rf "$STAGING_ROOT"
  fi
}
trap cleanup EXIT

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_command bun
require_command cargo
require_command codesign
require_command ditto
require_command hdiutil
require_command shasum

if [[ -n "${APPLE_API_ISSUER:-}" || -n "${APPLE_API_KEY:-}" || -n "${APPLE_API_KEY_PATH:-}" ]]; then
  if [[ -z "${APPLE_API_ISSUER:-}" || -z "${APPLE_API_KEY:-}" || -z "${APPLE_API_KEY_PATH:-}" ]]; then
    printf 'APPLE_API_ISSUER, APPLE_API_KEY, and APPLE_API_KEY_PATH must all be set for notarization.\n' >&2
    exit 1
  fi
  require_command xcrun
  NOTARY_ENABLED=1
fi

if [[ "$REQUIRE_RELEASE" == "1" ]]; then
  if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
    printf 'ULT_REQUIRE_RELEASE=1 requires APPLE_SIGNING_IDENTITY.\n' >&2
    exit 1
  fi
  if [[ "$NOTARY_ENABLED" != "1" ]]; then
    printf 'ULT_REQUIRE_RELEASE=1 requires notarization credentials.\n' >&2
    exit 1
  fi
fi

bun install --frozen-lockfile
bun run check
bun run build
bun run test:frontend
bun x playwright install webkit
bun run test:visual
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
bunx --bun tauri build --bundles app

if [[ ! -d "$APP_PATH" ]]; then
  printf 'Expected app bundle was not created: %s\n' "$APP_PATH" >&2
  exit 1
fi

rm -rf "$DMG_DIR"
mkdir -p "$DMG_DIR"

if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  SIGNING_STATE="Developer ID signed"
  CODESIGN_ARGS=(--force --deep --options runtime --sign "$APPLE_SIGNING_IDENTITY")
  if [[ "$REQUIRE_RELEASE" == "1" || "$NOTARY_ENABLED" == "1" ]]; then
    CODESIGN_ARGS+=(--timestamp)
  fi
  codesign "${CODESIGN_ARGS[@]}" "$APP_PATH"
else
  codesign --force --deep --sign - "$APP_PATH"
fi

codesign --verify --deep --strict --verbose=2 "$APP_PATH"

if [[ "$NOTARY_ENABLED" == "1" ]]; then
  NOTARIZATION_STATE="notarized and stapled"
  ditto -c -k --keepParent "$APP_PATH" "$APP_NOTARY_ZIP"
  xcrun notarytool submit "$APP_NOTARY_ZIP" \
    --issuer "$APPLE_API_ISSUER" \
    --key-id "$APPLE_API_KEY" \
    --key "$APPLE_API_KEY_PATH" \
    --wait
  xcrun stapler staple "$APP_PATH"
  xcrun stapler validate "$APP_PATH"
  rm -f "$APP_NOTARY_ZIP"
fi

STAGING_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ult-dmg.XXXXXX")"
ditto "$APP_PATH" "$STAGING_ROOT/${PRODUCT_NAME}.app"
ln -s /Applications "$STAGING_ROOT/Applications"

APP_KB="$(du -sk "$APP_PATH" | cut -f1)"
APP_MB=$(( (APP_KB + 1023) / 1024 ))
DMG_SIZE_MB=$(( APP_MB + 80 ))
if (( DMG_SIZE_MB < 128 )); then
  DMG_SIZE_MB=128
fi

hdiutil create \
  -volname "$PRODUCT_NAME" \
  -srcfolder "$STAGING_ROOT" \
  -ov \
  -format UDZO \
  -fs HFS+ \
  -size "${DMG_SIZE_MB}m" \
  "$DMG"

if [[ -n "${APPLE_SIGNING_IDENTITY:-}" ]]; then
  DMG_CODESIGN_ARGS=(--force --sign "$APPLE_SIGNING_IDENTITY")
  if [[ "$REQUIRE_RELEASE" == "1" || "$NOTARY_ENABLED" == "1" ]]; then
    DMG_CODESIGN_ARGS+=(--timestamp)
  fi
  codesign "${DMG_CODESIGN_ARGS[@]}" "$DMG"
fi

if [[ "$NOTARY_ENABLED" == "1" ]]; then
  xcrun notarytool submit "$DMG" \
    --issuer "$APPLE_API_ISSUER" \
    --key-id "$APPLE_API_KEY" \
    --key "$APPLE_API_KEY_PATH" \
    --wait
  xcrun stapler staple "$DMG"
fi

(cd "$DMG_DIR" && shasum -a 256 "$(basename "$DMG")" > "$(basename "$CHECKSUM")")

cat > "$NOTES" <<EOF
# Ult ${TAG}

Version: ${VERSION}
Commit: ${COMMIT}

## Artifact

- macOS DMG: $(basename "$DMG")
- SHA-256: $(cat "$CHECKSUM")
- Signing: ${SIGNING_STATE}
- Notarization: ${NOTARIZATION_STATE}

## Supported Platforms

- macOS menu-bar app.
- Windows and Linux delivery adapters are not included in this alpha.

## Supported Native Delivery Targets

Native delivery applies the loaded prompt to the app the user explicitly
clicks. The alpha QA matrix covers common terminal and coding-agent surfaces:

- Terminal.app
- iTerm2
- Warp
- Ghostty
- WezTerm
- Kitty
- Alacritty
- Hyper
- Tabby
- VS Code integrated terminal
- Cursor integrated terminal

If the clicked app cannot accept native paste/send/interrupt delivery, Ult
reports that failure. It does not switch to Copy unless Copy was the active
delivery mode.

## Known Limitations

- Native paste/send delivery requires macOS Accessibility permission.
- Clipboard restoration is best-effort and text-focused.
- Some apps may reject Accessibility-driven paste or keystroke events even after
  permission is granted.
- Multi-monitor behavior must pass the alpha dogfooding matrix before publishing.
- Automatic updates are not enabled; alpha updates are manual.

## Privacy Boundary

- Local usage history stores only timestamp, prompt handle, artifact kind,
  delivery mode, result, diagnostic code, and target app metadata when available.
- Diagnostics export includes app identity, permission state, config/library paths,
  and recent metadata-only failures; it excludes prompt/context bodies and terminal
  contents by default.
- Ult does not read terminal contents, scrollback, shell history,
  source files, clipboard history, or agent responses by default.
- Prompt/context library files and settings remain local files.

## Manual Update

1. Quit Ult from the menu-bar menu.
2. Open the DMG.
3. Drag \`Ult.app\` to \`Applications\` and replace the previous app.
4. Relaunch Ult.
5. If Native Delivery is unavailable after a local or ad-hoc build update,
   re-enable Ult in Privacy & Security > Accessibility.

## Verification

\`\`\`bash
shasum -a 256 -c "$(basename "$CHECKSUM")"
scripts/release/verify-macos.sh
\`\`\`
EOF

ULT_REQUIRE_SIGNING="$REQUIRE_RELEASE" scripts/release/verify-macos.sh "$APP_PATH" "$DMG" "$CHECKSUM"

printf 'DMG: %s\n' "$DMG"
printf 'Checksum: %s\n' "$CHECKSUM"
printf 'Release notes: %s\n' "$NOTES"
