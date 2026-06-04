#!/usr/bin/env bash
set -eo pipefail

repo="${ULT_GITHUB_REPO:-not-agent/ult}"
branch="$(git branch --show-current 2>/dev/null || true)"

if [ -z "$branch" ]; then
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  exit 0
fi

if ! gh auth status >/dev/null 2>&1; then
  exit 0
fi

prs="$(
  gh pr list \
    --repo "$repo" \
    --head "$branch" \
    --state open \
    --json number \
    --jq '.[].number' 2>/dev/null || true
)"

printf '%s\n' "$prs" | while IFS= read -r pr_number; do
  if [ -z "$pr_number" ]; then
    continue
  fi

  gh pr close "$pr_number" \
    --repo "$repo" \
    --comment "Closing because the Linear issue for branch ${branch} entered a terminal state without merge."
done
