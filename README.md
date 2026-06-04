# Ult

[한국어](README.ko.md)

Ult is a local-first macOS menu-bar app for steering agents with explicit,
reusable local prompts.

It is not an autonomous agent. Ult does not watch agent output, inspect source
files, or decide what to send. You choose a prompt, context, skill, or command,
then choose the target app.

## Why

Agents often need short operator interventions:

- stay inside the requested scope
- inspect the current diff before editing more
- run the relevant tests
- avoid broad refactors
- summarize progress and remaining risk
- stop and follow the latest instruction

Those prompts are repetitive, but they should not become permanent project
context. Ult keeps them local, reusable, and outside the agent until you
explicitly deliver one.

## Quick Start

Build and open the local app:

```bash
make setup
bun run tauri:build
open "src-tauri/target/release/bundle/macos/Ult.app"
```

For development:

```bash
make setup
bun run tauri:dev
```

Ult opens as a menu-bar app. The menu exposes Launcher, Preferences, version,
and Quit. Artifact management lives in Launcher, not Preferences.

## Core Workflow

1. Start an agent session.
2. Press `Option+Space` to open Launcher, or `Cmd+U` for the quick Palette.
3. Pick or compose an intervention such as `#review-change @repo-policy`.
4. Press `Enter` to load it.
5. Use `Shift+Tab` to choose Paste, Paste + Enter, Interrupt + Enter, or Copy.
6. Click the target app to apply the loaded intervention.

Native paste/send modes require macOS Accessibility permission. Ult does not
show a first-run permission wizard; macOS prompts only when a native delivery
action needs permission. Copy mode remains explicit and does not require native
input synthesis.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd+U` | Open quick Palette |
| `Option+Space` | Open Launcher |
| `Ctrl+Option+Cmd+S` | Open Launcher Scratch |
| `Shift+Tab` | Cycle loaded delivery mode |
| Launcher `Ctrl+V` | Open Clipboard Stack |
| Launcher `Esc` | Close active Launcher mode |

Shortcuts can be changed in `Preferences > Shortcuts`. `Cmd+Option+Space` is
not the default Launcher shortcut because macOS commonly reserves it.

## Surfaces

### Palette

Palette is cursor-adjacent and optimized for frequent pinned prompts. It shows
persistent pinned prompts only, using their canonical `#handle`. It does not
show contexts, skills, scratch prompts, or broad search results.

### Launcher

Launcher is the main command surface. It is top-centered and uses one stable
shell for search, library browsing, scratch composition, variable filling,
workflow input panels, clipboard stack, artifact readers, and project setup.

Launcher handles use fixed namespaces:

| Prefix | Meaning |
| --- | --- |
| `#` | Prompt |
| `@` | Context |
| `$` | Skill |
| `/` | Launcher command |

Examples:

```text
#scope-lock
@repo-policy
$diagnose
/review-current-change
```

Search matches handles, titles, command aliases, and command intent metadata.
It does not full-text search prompt bodies, context bodies, skill sources, or
agent output.

### Library

`Browse Library` opens the local inventory for prompts, contexts, skills, and
commands. Library rows are metadata-first and use the same handle grammar as
Launcher search. Secondary actions let you read, edit, duplicate, delete, pin,
copy, reveal, import, export, or install artifacts where those actions apply.

Skills are source-oriented packages. A `$skill` result opens or reveals the
local `SKILL.md`; skills are not loaded as prompt delivery text by default.

### Loaded State

After `Enter`, Ult shows a compact loaded card near the cursor. It displays the
loaded handle, target-click state, and delivery mode. Pressing `Enter` does not
deliver from loaded state; delivery requires the explicit target click or Copy
action.

## Personal Library

Ult stores user-managed artifacts under:

```text
~/.ult/
  personal-library/
    persistent/
      prompts/<handle>/PROMPT.md
      contexts/<handle>/CONTEXT.md
      skills/<handle>/SKILL.md
      commands/<handle>/COMMAND.md
    ephemeral/
      prompts/<opaque-id>/PROMPT.md
      contexts/<opaque-id>/CONTEXT.md
```

The directory determines artifact type and scope. For example:

- `persistent/prompts/review-change/PROMPT.md` becomes `#review-change`
- `persistent/contexts/repo-policy/CONTEXT.md` becomes `@repo-policy`
- `persistent/skills/diagnose/SKILL.md` becomes `$diagnose`
- `persistent/commands/review-repo/COMMAND.md` becomes `/review-repo`

Scratch prompts and captured clipboard contexts are saved as ephemeral local
artifacts with 7-day expiry. They use opaque handles and are ignored after
expiry.

`COMMAND.md` files bind local prompts and contexts into reusable Launcher
commands. Example:

```markdown
---
title = "Review Repo"
description = "Review the current change with repo policy."
prompt = "review-change"
contexts = ["repo-policy"]
keywords = ["review", "diff"]
aliases = ["rr"]
actions = ["prepare"]
home = true

[variables]
policy = "@repo-policy"
---
```

## Clipboard Contexts

Clipboard capture is explicit. Run `Capture Clipboard` from Launcher to read
the current clipboard once and save it as a local 7-day ephemeral context.

Ult does not install a global keyboard event tap, Input Monitoring listener, or
startup pasteboard monitor for clipboard capture. It does not intercept
`Cmd+V`.

## Project Writes And Imports

Project writes are explicit Launcher actions, separate from prompt delivery.
Exporting prompts/contexts, installing skills, creating AGENTS snippets, and
Project Setup all require a target directory, preview exact files first, and
refuse overwrites unless explicitly confirmed.

GitHub imports and starter packs also use explicit preview flows. Imported
packages become local Personal Library files. Ult does not store GitHub tokens,
auto-pull packs, auto-update packs, or run external install commands from
discovery gates.

## Meta Prompting

Meta Prompting is off by default. Configure it in
`Preferences > Meta Prompting`.

When enabled, `Cmd+R` in Launcher Scratch sends only the current scratch text
to the configured provider. Ult does not attach agent output, terminal
contents, shell history, source files, or context bodies. The generated prompt
is shown for review and is not delivered until you explicitly load it and click
a target.

## Privacy Model

Ult is local-first by default.

Ult does not read agent output, terminal contents, shell history, source files,
editor buffers, window titles, clipboard history, or agent responses by
default.

Default usage history stores only compact metadata:

- artifact id and kind
- timestamp
- delivery mode
- success or failure state
- retryable diagnostic code when available
- target application metadata when available

Prompt text, context text, scratch text, agent output, terminal output, source
files, and agent responses are not written to usage history or diagnostics by
default.

Project metadata collection is reserved for a future privacy-safe resolver and
is not exposed as a working Preferences control today.

## Development

This repo uses Bun, Vite, Playwright, Rust stable, and Tauri v2.

```bash
make setup
make all
```

`make all` is the main local and CI gate. It runs dependency setup, Playwright
WebKit setup, TypeScript checks, frontend build, frontend tests, visual
regression tests, Rust format/check/clippy/test, and Tauri build.

Focused checks:

```bash
make check
make test-frontend
make test-visual
make rust-test
make rust-clippy
make tauri-build
```

Update visual baselines only when the changed layout is intentional:

```bash
bun run test:visual:update
```

## Docs

This README is the public product and development guide. Detailed product
planning, workflow notes, manual QA checklists, and agent-local instructions are
kept as local-only project notes.

## License

Ult is licensed under the [MIT License](LICENSE).
