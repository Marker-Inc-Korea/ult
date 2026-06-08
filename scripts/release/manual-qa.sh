#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PRODUCT_NAME="Ult"
BUNDLE_ID="engineer.ultra.ult"
APP_PATH="${1:-src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app}"
SETTINGS_PATH="${ULT_SETTINGS_PATH:-$HOME/Library/Application Support/${BUNDLE_ID}/settings.toml}"
MANUAL_CHECKS_PATH="${ULT_MANUAL_CHECKS_PATH:-docs/MANUAL_CHECKS.md}"
DEFAULT_OPEN_SHORTCUT="Cmd+U"
DEFAULT_SEARCH_SHORTCUT="Option+Space"
DEFAULT_SCRATCH_SHORTCUT="Cmd+Option+Control+S"

read_toml_string() {
  local key="$1"
  local default_value="$2"
  local value=""

  if [[ -f "$SETTINGS_PATH" ]]; then
    value="$(
      awk -F= -v key="$key" '
        $1 ~ "^[[:space:]]*" key "[[:space:]]*$" {
          value = $2
          sub(/^[[:space:]]*/, "", value)
          sub(/[[:space:]]*$/, "", value)
          sub(/^"/, "", value)
          sub(/"$/, "", value)
          print value
          exit
        }
      ' "$SETTINGS_PATH"
    )"
  fi

  if [[ -n "$value" ]]; then
    printf '%s\n' "$value"
  else
    printf '%s\n' "$default_value"
  fi
}

bundle_version() {
  local plist="$APP_PATH/Contents/Info.plist"
  if [[ -f "$plist" && -x /usr/libexec/PlistBuddy ]]; then
    /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$plist" 2>/dev/null || true
  fi
}

OPEN_SHORTCUT="$(read_toml_string open_palette_shortcut "$DEFAULT_OPEN_SHORTCUT")"
SEARCH_SHORTCUT="$(read_toml_string search_shortcut "$DEFAULT_SEARCH_SHORTCUT")"
SCRATCH_SHORTCUT="$(read_toml_string scratch_prompt_shortcut "$DEFAULT_SCRATCH_SHORTCUT")"
VERSION="$(bundle_version)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')"

if [[ ! -f "$MANUAL_CHECKS_PATH" ]]; then
  printf 'FAIL: manual checks file not found: %s\n' "$MANUAL_CHECKS_PATH" >&2
  exit 1
fi

cat <<EOF
# Ult Manual QA Runner

This runner prints the packaged-app manual checklist and the expected local
shortcut values for this machine. It does not automate Accessibility,
multi-monitor, or terminal injection checks.

Record PASS/FAIL results with:

\`\`\`bash
bun run release:alpha:report
\`\`\`

## Build Under Test

| Field | Value |
| --- | --- |
| App bundle | \`${APP_PATH}\` |
| App version | ${VERSION:-not built} |
| Commit | ${COMMIT} |
| Settings file | \`${SETTINGS_PATH}\` |
| Manual checklist | \`${MANUAL_CHECKS_PATH}\` |

## Expected Shortcuts

| Action | Shortcut |
| --- | --- |
| Open Palette | \`${OPEN_SHORTCUT}\` |
| Open Launcher | \`${SEARCH_SHORTCUT}\` |
| Open Launcher in Scratch mode | \`${SCRATCH_SHORTCUT}\` |

Use these shortcut values when the checklist below mentions app-level
shortcut. If the settings file does not exist yet, the defaults above are used.

---

EOF

cat "$MANUAL_CHECKS_PATH"
