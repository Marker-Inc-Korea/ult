#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PRODUCT_NAME="Ult"
BUNDLE_ID="engineer.ultra.ult"
VERSION="$(sed -nE 's/.*"version": "([^"]+)".*/\1/p' package.json | head -n 1)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || printf 'unknown')"
ARCH="$(uname -m)"
DATE_UTC="$(date -u +%Y%m%dT%H%M%SZ)"
DEFAULT_REPORT="private/alpha-reports/ult-alpha-${VERSION}-${DATE_UTC}.md"
DEFAULT_APP_PATH="src-tauri/target/release/bundle/macos/${PRODUCT_NAME}.app"
DEFAULT_DMG_PATH="src-tauri/target/release/bundle/dmg/${PRODUCT_NAME}_${VERSION}_${ARCH}.dmg"

usage() {
  cat <<'EOF'
Usage:
  scripts/release/alpha-report.sh create [report-path]
  scripts/release/alpha-report.sh verify <report-path>

The report is intentionally local-first. The default output path is under
private/alpha-reports, which is ignored by git.
EOF
}

require_report() {
  local report="$1"
  if [[ -z "$report" || ! -f "$report" ]]; then
    printf 'FAIL: alpha report not found: %s\n' "${report:-<empty>}" >&2
    exit 1
  fi
}

display_snapshot() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    printf 'Display snapshot unavailable outside macOS.\n'
    return
  fi
  if ! command -v system_profiler >/dev/null 2>&1; then
    printf 'system_profiler unavailable.\n'
    return
  fi
  system_profiler SPDisplaysDataType 2>/dev/null \
    | awk '
        /Displays:/ { print; next }
        /Resolution:/ { print; next }
        /Main Display:/ { print; next }
        /Mirror:/ { print; next }
        /Online:/ { print; next }
        /Rotation:/ { print; next }
      '
}

signing_summary() {
  local app_path="$1"
  if [[ "$(uname -s)" != "Darwin" || ! -d "$app_path" ]]; then
    printf 'unknown\n'
    return
  fi
  if ! command -v codesign >/dev/null 2>&1; then
    printf 'unknown\n'
    return
  fi
  codesign -dv --verbose=4 "$app_path" 2>&1 \
    | awk -F= '/^(Authority|TeamIdentifier|Signature)=/ { print }' \
    | paste -sd '; ' -
}

create_report() {
  local report="${1:-$DEFAULT_REPORT}"
  mkdir -p "$(dirname "$report")"
  cat > "$report" <<EOF
# Ult Alpha Manual Report

This report is the human release gate. Replace every \`TODO\` result with
\`PASS\` or \`FAIL\`. Do not publish an alpha while any required gate is
\`TODO\` or \`FAIL\`.

## Build Under Test

| Field | Value |
| --- | --- |
| Product | ${PRODUCT_NAME} |
| Version | ${VERSION} |
| Commit | ${COMMIT} |
| Created UTC | ${DATE_UTC} |
| App bundle | \`${DEFAULT_APP_PATH}\` |
| DMG | \`${DEFAULT_DMG_PATH}\` |
| Signing summary | $(signing_summary "$DEFAULT_APP_PATH") |
| macOS version | $(sw_vers -productVersion 2>/dev/null || printf 'unknown') |
| Hardware | ${ARCH} |
| Tester |  |

## Required Gate Results

| Gate | Required Result | Result |
| --- | --- | --- |
| Automated preflight | \`bun run release:alpha:preflight\` completed successfully. | TODO |
| Artifact check | \`bun run release:mac\` and \`bun run release:alpha:check\` completed successfully. | TODO |
| Tray menu | Menu-bar left and right click open the native menu; outside click closes it; only Open Launcher, Preferences, version, and Quit appear as product actions. | TODO |
| Multi-monitor | Palette and loaded target state align near the cursor; Launcher Search, Scratch, variables, and stack picker stay top-centered on the active display without flicker or duplicate overlays. | TODO |
| Permission gate | Accessibility denied delivery fails clearly, opens only the macOS native Accessibility prompt or Privacy & Security pane, and never opens a setup/test/fix window. | TODO |
| Native delivery | Accessibility granted path delivers to the explicitly clicked target app and closes the loaded surface after execution. | TODO |
| Explicit Copy | Copy mode is explicit; failed native delivery does not silently switch to Copy. | TODO |
| Palette | Palette shows pinned persistent prompts only, stays cursor-adjacent, and has no execution buttons. | TODO |
| Launcher Search | Search opens in the shared top-centered Launcher shell, \`/\` lists persistent prompts only, \`@\` lists context files plus non-expired ephemeral contexts, and \`\$skill\` rows open local skill packages. | TODO |
| Artifact actions | Launcher can read, add, edit, duplicate, delete, and reveal local prompts and contexts, and reveal local skill package sources without opening Preferences. | TODO |
| Project writes | Launcher project write actions require a target directory, preview exact files, stay out of default delivery, and require explicit overwrite confirmation before replacing project files. | TODO |
| Template execution | Variable values are collected in Launcher variables mode, support \`@context\` insertion, final \`Enter\` loads once, and values are not saved to usage history. | TODO |
| Scratch execution | Scratch opens in the shared top-centered Launcher shell, prepares once, and saves prepared scratch prompts as 7-day ephemeral prompts. | TODO |
| Fresh install | App launches quietly into the menu bar, Preferences opens intentionally, starter prompts live under \`~/.ult/personal-library\`, and relaunch preserves settings plus the library. | TODO |
| Personal Library boundary | Fresh installs create \`~/.ult/personal-library/persistent/prompts/<handle>/PROMPT.md\`; files outside \`~/.ult/personal-library\` are ignored; loose files under \`persistent/skills\` are ignored; no \`ephemeral/skills\` folder is created. | TODO |
| Skill source reveal | \`\$skill\` rows reveal the local \`SKILL.md\` source, keep Launcher open on reveal failure, and never load skills for prompt delivery. | TODO |
| Signed update identity | A Developer ID signed update preserves Accessibility identity after relaunch. | TODO |
| Privacy boundary | Diagnostics and usage history contain only timestamp, prompt handle, artifact kind, delivery mode, result, diagnostic code, target metadata, optional project basename/path hash when enabled, and config/library paths. | TODO |
| Diagnostics export | Exported diagnostics include app identity, permission state, config/library paths, and recent metadata-only failures, but no prompt/context/skill body, terminal contents, clipboard contents, shell history, or agent output. | TODO |
| Change boundary | \`git status --short\` has a clear review boundary; only documented local artifacts remain uncommitted. | TODO |

## Display Snapshot

\`\`\`text
$(display_snapshot)
\`\`\`

## Failures

Record every failure as an actionable TODO before release:

\`\`\`markdown
  - [ ] Fix alpha failure: <short title>
    - Gate:
    - Setup:
    - Expected:
    - Actual:
    - Diagnostics:
\`\`\`
EOF

  printf '%s\n' "$report"
}

verify_report() {
  local report="$1"
  require_report "$report"

  local required_gates=(
    "Automated preflight"
    "Artifact check"
    "Tray menu"
    "Multi-monitor"
    "Permission gate"
    "Native delivery"
    "Explicit Copy"
    "Palette"
    "Launcher Search"
    "Artifact actions"
    "Project writes"
    "Template execution"
    "Scratch execution"
    "Fresh install"
    "Personal Library boundary"
    "Skill source reveal"
    "Signed update identity"
    "Privacy boundary"
    "Diagnostics export"
    "Change boundary"
  )
  local status=0

  for gate in "${required_gates[@]}"; do
    if grep -Eq "^\\| ${gate//|/\\|} \\|.*\\| PASS \\|" "$report"; then
      printf 'OK: %s\n' "$gate"
    elif grep -Eq "^\\| ${gate//|/\\|} \\|.*\\| FAIL \\|" "$report"; then
      printf 'FAIL: %s is marked FAIL\n' "$gate" >&2
      status=1
    elif grep -Eq "^\\| ${gate//|/\\|} \\|" "$report"; then
      printf 'FAIL: %s is not marked PASS\n' "$gate" >&2
      status=1
    else
      printf 'FAIL: %s row missing from report\n' "$gate" >&2
      status=1
    fi
  done

  if grep -Eq '^-[[:space:]]+\[[[:space:]]\][[:space:]]+Fix alpha failure:' "$report"; then
    printf 'FAIL: unresolved alpha failure TODO remains in report\n' >&2
    status=1
  fi

  exit "$status"
}

command="${1:-create}"
case "$command" in
  create)
    create_report "${2:-}"
    ;;
  verify)
    verify_report "${2:-}"
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac
