#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PRODUCT_NAME="Ult"
BUNDLE_ID="engineer.ultra.ult"
VERSION="$(sed -nE 's/.*"version": "([^"]+)".*/\1/p' package.json | head -n 1)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
ARCH="$(uname -m)"
APP_PATH="${1:-src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app}"
DMG_PATH="${2:-src-tauri/target/release/bundle/dmg/${PRODUCT_NAME}_${VERSION}_${ARCH}.dmg}"
SETTINGS_PATH="${ULT_SETTINGS_PATH:-$HOME/Library/Application Support/${BUNDLE_ID}/settings.toml}"
DOGFOODING_PATH="${ULT_ALPHA_DOGFOODING_PATH:-docs/ALPHA_DOGFOODING.md}"
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

OPEN_SHORTCUT="$(read_toml_string open_palette_shortcut "$DEFAULT_OPEN_SHORTCUT")"
SEARCH_SHORTCUT="$(read_toml_string search_shortcut "$DEFAULT_SEARCH_SHORTCUT")"
SCRATCH_SHORTCUT="$(read_toml_string scratch_prompt_shortcut "$DEFAULT_SCRATCH_SHORTCUT")"

if [[ ! -f "$DOGFOODING_PATH" ]]; then
  printf 'FAIL: alpha dogfooding file not found: %s\n' "$DOGFOODING_PATH" >&2
  exit 1
fi

cat <<EOF
# Ult Alpha Release Gate

Block the alpha release unless every release-blocking item in
\`${DOGFOODING_PATH}\` is marked PASS by a human tester.

## Artifact Under Review

| Field | Value |
| --- | --- |
| Version | ${VERSION} |
| Commit | ${COMMIT} |
| App bundle | \`${APP_PATH}\` |
| DMG | \`${DMG_PATH}\` |
| Settings file | \`${SETTINGS_PATH}\` |
| Open Palette shortcut | \`${OPEN_SHORTCUT}\` |
| Open Launcher shortcut | \`${SEARCH_SHORTCUT}\` |
| Open Launcher Scratch shortcut | \`${SCRATCH_SHORTCUT}\` |

## Required Commands Before Manual Gate

\`\`\`bash
bun run release:alpha:preflight
bun run release:mac
bun run release:alpha:check
bun run release:alpha:report
scripts/release/manual-qa.sh
\`\`\`

After completing the generated report, verify it:

\`\`\`bash
ULT_ALPHA_REPORT=private/alpha-reports/<report>.md \\
  ULT_REQUIRE_ALPHA_MANUAL=1 \\
  bun run release:alpha:check
\`\`\`

## Failure Recording Template

When any manual row fails, add a concrete TODO entry instead of a vague note:

\`\`\`markdown
- [ ] Fix alpha failure: <short title>
  - Gate: <Multi-monitor / Palette / Launcher / Native Delivery / ...>
  - Setup: <macOS version, display layout, terminal app>
  - Expected: <what should have happened>
  - Actual: <what happened>
  - Diagnostics: <Coordinates / Last Target / Last Result values>
\`\`\`

---

EOF

cat "$DOGFOODING_PATH"
