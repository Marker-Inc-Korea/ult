#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PRODUCT_NAME="Ult"
VERSION="$(sed -nE 's/.*"version": "([^"]+)".*/\1/p' package.json | head -n 1)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
APP_PATH="${1:-src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app}"
SKIP_LAUNCH="${ULT_SKIP_LAUNCH:-0}"
STATUS=0

run_step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  "$@"
}

warn() {
  printf 'WARN: %s\n' "$1" >&2
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  STATUS=1
}

print_display_snapshot() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    printf 'Display snapshot: unavailable outside macOS\n'
    return
  fi

  printf '\n## Display Snapshot\n\n'
  if command -v system_profiler >/dev/null 2>&1; then
    system_profiler SPDisplaysDataType 2>/dev/null \
      | awk '
          /Displays:/ { print; next }
          /Resolution:/ { print; next }
          /Main Display:/ { print; next }
          /Mirror:/ { print; next }
          /Online:/ { print; next }
          /Rotation:/ { print; next }
        '
  else
    warn "system_profiler unavailable; skipping display snapshot"
  fi
}

sign_preflight_app() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    printf 'Skipping ad-hoc app signing outside macOS\n'
    return
  fi
  if [[ ! -d "$APP_PATH" ]]; then
    fail "app bundle missing before signing: $APP_PATH"
    return
  fi
  if ! command -v codesign >/dev/null 2>&1; then
    fail "missing required command: codesign"
    return
  fi

  codesign --force --deep --sign - "$APP_PATH"
  codesign --verify --deep --strict --verbose=2 "$APP_PATH"
}

printf '# Ult Alpha Preflight\n\n'
printf '| Field | Value |\n'
printf '| --- | --- |\n'
printf '| Version | %s |\n' "$VERSION"
printf '| Commit | %s |\n' "$COMMIT"
printf '| App bundle | `%s` |\n' "$APP_PATH"
printf '| Skip launch smoke | `%s` |\n' "$SKIP_LAUNCH"

run_step "Typecheck frontend" bun run check
run_step "Build frontend" bun run build
run_step "Frontend tests" bun run test:frontend
run_step "Install visual browser" bun x playwright install webkit
run_step "Visual regression tests" bun run test:visual
run_step "Rust formatting" cargo fmt --manifest-path src-tauri/Cargo.toml --check
run_step "Rust check" cargo check --manifest-path src-tauri/Cargo.toml --all-targets
run_step "Rust tests" cargo test --manifest-path src-tauri/Cargo.toml
run_step "Rust clippy" cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
run_step "Tauri bundle" bun run tauri:build
run_step "Ad-hoc sign preflight app" sign_preflight_app
run_step "Packaged app smoke" env ULT_SKIP_LAUNCH="$SKIP_LAUNCH" scripts/release/smoke-macos.sh "$APP_PATH"

print_display_snapshot

if [[ ! -d "$APP_PATH" ]]; then
  fail "app bundle missing after build: $APP_PATH"
fi

if [[ "$STATUS" != "0" ]]; then
  exit "$STATUS"
fi

cat <<'EOF'

## Manual Gate Still Required

Automated preflight passed. A human still must run the release-blocking rows in
docs/ALPHA_DOGFOODING.md on the target macOS display setup before publishing an
alpha build.

Recommended next command:

```bash
bun run release:alpha:mac
```
EOF
