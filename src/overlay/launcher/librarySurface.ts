import { createElement } from "../../dom";
import type {
  PromptPaletteRuntime,
} from "../../paletteRuntime";
import {
  artifactHandle,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  stopPaletteChromePointerDown,
} from "../shared/renderShared";
import type { LauncherCommand } from "./launcherCommandTypes";
import {
  commandHandle,
  commandKindLabel,
  commandPrimaryAction,
  commandTitle,
} from "./searchCommandPresentation";
import {
  launcherArtifactRowText,
  launcherCommandRowText,
} from "./launcherRowPresentation";
import { scrollRowIntoRail } from "./launcherScroll";
import {
  LIBRARY_FILTERS,
  LIBRARY_SORTS,
  libraryCounts,
  libraryRowsForPalette,
  type LibraryArtifactRow,
  type LibraryCommandRow,
  type LibraryIssueRow,
  type LibraryRow,
} from "./libraryRows";
import {
  copyLibraryRowHandle,
  libraryProjectWriteActionLabel,
  openLibraryRowActions,
  openLibraryRowProjectWrite,
  openLibraryRowReader,
  runLibraryRowPrimary,
} from "./libraryRowActions";
import { renderArtifactPanel } from "./artifactPanelSurface";
import {
  createLauncherBody,
  createLauncherShell,
} from "./launcherShell";
import { sourcePathLabel } from "./artifactPanelShared";

export function renderLibrarySurface(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  if (palette.launcherArtifactPanel) {
    renderArtifactPanel(palette, actions);
    return;
  }

  const rows = libraryRowsForPalette(palette);
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-library-panel",
    ariaLabel: "Launcher library",
    onEscape: actions.unload,
  });
  shell.tabIndex = -1;
  shell.addEventListener("keydown", (event) => {
    if (handleLibraryFilterShortcut(event, actions)) return;
    if (handleLibrarySortShortcut(event, actions)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      actions.selectLauncherCommandDelta(1, rows.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      actions.selectLauncherCommandDelta(-1, rows.length);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      actions.selectLauncherCommandDelta(rows.length - 1, rows.length);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      actions.selectLauncherCommandDelta(1 - rows.length, rows.length);
      return;
    }
    if (isCommandOnly(event) && event.key.toLowerCase() === "o") {
      const row = rows[palette.launcherCommandIndex] ?? rows[0];
      if (openLibraryRowReader(row, actions)) {
        event.preventDefault();
      }
      return;
    }
    if (isCommandOnly(event) && event.key.toLowerCase() === "c") {
      const row = rows[palette.launcherCommandIndex] ?? rows[0];
      if (copyLibraryRowHandle(row, actions)) {
        event.preventDefault();
      }
      return;
    }
    if (isCommandOnly(event) && event.key.toLowerCase() === "e") {
      const row = rows[palette.launcherCommandIndex] ?? rows[0];
      if (openLibraryRowProjectWrite(row, actions)) {
        event.preventDefault();
      }
      return;
    }
    if (isCommandOnly(event) && event.key === ".") {
      const row = rows[palette.launcherCommandIndex] ?? rows[0];
      if (openLibraryRowActions(row, actions)) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const row = rows[palette.launcherCommandIndex] ?? rows[0];
      if (row) runLibraryRowPrimary(row, actions);
    }
  });

  const body = createLauncherBody("palette-library-body");
  body.append(libraryToolbar(palette, actions));
  body.append(libraryTabs(palette, actions));

  const rail = createElement("div", "panel-rail palette-library-results");
  rail.addEventListener("pointerdown", stopPaletteChromePointerDown);
  for (const [index, row] of rows.entries()) {
    rail.append(libraryRowButton(row, index, palette.launcherCommandIndex, actions));
  }
  if (rows.length === 0) {
    rail.append(createElement("div", "palette-empty palette-library-empty", "No items"));
  }
  body.append(rail);
  shell.append(body);
  window.setTimeout(() => focusSelectedLibraryControl(shell, rail), 0);
}

function libraryTabs(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const counts = libraryCounts(palette);
  const tabs = createElement("div", "palette-library-tabs");
  tabs.setAttribute("role", "tablist");
  for (const filter of LIBRARY_FILTERS) {
    const selected = filter.id === palette.launcherLibraryFilter;
    const button = createElement(
      "button",
      `palette-library-tab${selected ? " is-selected" : ""}`,
    ) as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.title = `Cmd+${LIBRARY_FILTERS.indexOf(filter) + 1}`;
    button.append(
      createElement("span", undefined, filter.label),
      createElement("small", undefined, String(counts[filter.id])),
    );
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.setLibraryFilter(filter.id);
    });
    tabs.append(button);
  }
  return tabs;
}

function libraryToolbar(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const toolbar = createElement("div", "palette-library-toolbar");
  const input = createElement("input", "palette-library-search") as HTMLInputElement;
  input.type = "text";
  input.value = palette.launcherLibraryQuery;
  input.placeholder = "Filter Library metadata";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("aria-label", "Filter Library inventory metadata");
  input.addEventListener("input", () => {
    actions.updateLibraryQuery(input.value);
  });
  toolbar.append(input, librarySortControls(palette, actions));
  return toolbar;
}

function librarySortControls(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const controls = createElement("div", "palette-library-sort");
  controls.setAttribute("role", "tablist");
  controls.setAttribute("aria-label", "Library sort");
  for (const sort of LIBRARY_SORTS) {
    const selected = sort.id === palette.launcherLibrarySort;
    const button = createElement(
      "button",
      `palette-library-sort-button${selected ? " is-selected" : ""}`,
    ) as HTMLButtonElement;
    button.type = "button";
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.title = `Cmd+Shift+${LIBRARY_SORTS.indexOf(sort) + 1}`;
    button.append(createElement("span", undefined, sort.label));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.setLibrarySort(sort.id);
    });
    controls.append(button);
  }
  return controls;
}

function libraryRowButton(
  row: LibraryRow,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
) {
  if (row.kind === "issue") {
    return libraryIssueButton(row, index, selectedIndex, actions);
  }
  if (row.kind === "command") {
    return libraryCommandButton(row, index, selectedIndex, actions);
  }
  return libraryArtifactButton(row, index, selectedIndex, actions);
}

function libraryArtifactButton(
  row: LibraryArtifactRow,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
) {
  const selected = index === selectedIndex;
  const button = createElement(
    "button",
    [
      "panel-intervention",
      "palette-search-intervention",
      "palette-library-intervention",
      "palette-prompt-control",
      "is-artifact-row",
      `is-${promptArtifactType(row.prompt)}-row`,
      selected ? "is-selected" : "",
    ].filter(Boolean).join(" "),
  ) as HTMLButtonElement;
  button.type = "button";
  button.tabIndex = selected ? 0 : -1;
  button.dataset.promptIndex = String(row.promptIndex);
  button.dataset.launcherRowIndex = String(index);
  button.dataset.rowKind = "artifact";
  button.title = `${artifactHandle(row.prompt)} ${row.prompt.title}`;
  button.setAttribute("role", "menuitem");
  button.append(
    launcherArtifactRowText(row.prompt),
    libraryArtifactMeta(
      row,
      selected ? libraryArtifactActions(row.prompt) : null,
    ),
  );
  button.setAttribute("aria-label", `${libraryArtifactKind(row.prompt)} ${button.title}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    runLibraryRowPrimary(row, actions);
  });
  return button;
}

function libraryCommandButton(
  row: LibraryCommandRow,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
) {
  const selected = index === selectedIndex;
  const button = createElement(
    "button",
    [
      "panel-intervention",
      "palette-search-intervention",
      "palette-library-intervention",
      "palette-search-command",
      "is-command-row",
      selected ? "is-selected" : "",
    ].filter(Boolean).join(" "),
  ) as HTMLButtonElement;
  button.type = "button";
  button.tabIndex = selected ? 0 : -1;
  button.dataset.commandIndex = String(index);
  button.dataset.launcherRowIndex = String(index);
  button.dataset.rowKind = "command";
  button.title = `${commandHandle(row.command)} ${commandTitle(row.command)}`;
  button.append(
    launcherCommandRowText(row.command),
    libraryRowMeta(
      libraryDependencyMeta(row.dependencies, row.issueCount),
      selected ? libraryCommandActions(row.command) : null,
    ),
  );
  button.setAttribute("aria-label", `${commandKindLabel(row.command)} ${button.title}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.runLauncherCommand(row.command);
  });
  return button;
}

function libraryIssueButton(
  row: LibraryIssueRow,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
) {
  const selected = index === selectedIndex;
  const button = createElement(
    "button",
    [
      "panel-intervention",
      "palette-search-intervention",
      "palette-library-intervention",
      "palette-library-issue-row",
      `is-${row.severity}`,
      selected ? "is-selected" : "",
    ].filter(Boolean).join(" "),
  ) as HTMLButtonElement;
  button.type = "button";
  button.tabIndex = selected ? 0 : -1;
  button.dataset.launcherRowIndex = String(index);
  button.dataset.rowKind = "issue";
  button.title = `${row.title} - ${row.detail}`;
  button.append(
    libraryIssueText(row),
    libraryRowMeta(
      libraryIssueDetail(row),
      selected ? libraryIssueActions(row) : null,
    ),
  );
  button.setAttribute("aria-label", `${row.severity === "error" ? "Issue" : "Warning"} ${button.title}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (row.actionCommand) actions.runLauncherCommand(row.actionCommand);
  });
  return button;
}

function libraryIssueText(row: LibraryIssueRow) {
  const text = createElement("span", "palette-search-result-text is-title-only");
  text.append(createElement("span", "palette-search-result-name", row.title));
  return text;
}

function libraryArtifactKind(prompt: PromptDefinition) {
  const type = promptArtifactType(prompt);
  if (type === "context") {
    return promptScope(prompt) === "persistent"
      ? "Persistent Context"
      : "Temporary Context";
  }
  if (type === "skill") return "Skill";
  return "Prompt";
}

function libraryArtifactMeta(row: LibraryArtifactRow, actions: HTMLElement | null) {
  const prompt = row.prompt;
  const type = promptArtifactType(prompt);
  if (type !== "skill") {
    return libraryRowMeta(
      libraryDependencyMeta(row.dependencies, row.issueCount),
      actions,
    );
  }
  return libraryRowMeta(
    librarySkillPackageMeta(prompt, row.issueCount),
    actions,
  );
}

function libraryRowMeta(
  packageMeta: HTMLElement | null,
  actions: HTMLElement | null,
) {
  const meta = createElement("span", "palette-search-row-meta");
  if (packageMeta) meta.append(packageMeta);
  if (actions) meta.append(actions);
  return meta;
}

function librarySkillPackageMeta(prompt: PromptDefinition, issueCount: number) {
  const packageMeta = createElement("span", "palette-library-skill-package");
  packageMeta.title = [
    sourcePathLabel(prompt),
    skillEditableLabel(prompt),
    skillInstallStatusLabel(prompt),
  ].join(" · ");
  packageMeta.append(
    createElement("span", "palette-library-skill-path", sourcePathLabel(prompt)),
    createElement("span", "palette-library-skill-chip", skillEditableLabel(prompt)),
    createElement("span", "palette-library-skill-chip", skillInstallStatusLabel(prompt)),
  );
  if (issueCount > 0) {
    packageMeta.append(createElement("span", "palette-library-skill-chip is-warning", `${issueCount} issue`));
  }
  return packageMeta;
}

function libraryDependencyMeta(
  dependencies: string[],
  issueCount: number,
) {
  if (dependencies.length === 0 && issueCount === 0) return null;
  const meta = createElement("span", "palette-library-dependencies");
  meta.title = [
    dependencies.length > 0 ? `Dependencies: ${dependencies.join(", ")}` : "",
    issueCount > 0 ? `${issueCount} recoverable issue${issueCount === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" · ");
  for (const dependency of dependencies.slice(0, 4)) {
    meta.append(createElement("span", "palette-library-dependency-chip", dependency));
  }
  if (dependencies.length > 4) {
    meta.append(createElement("span", "palette-library-dependency-chip", `+${dependencies.length - 4}`));
  }
  if (issueCount > 0) {
    meta.append(createElement("span", "palette-library-dependency-chip is-warning", `${issueCount} issue`));
  }
  return meta;
}

function libraryIssueDetail(row: LibraryIssueRow) {
  const detail = createElement("span", "palette-library-issue-detail");
  if (row.subject) {
    detail.append(createElement("span", "palette-library-issue-subject", row.subject));
  }
  detail.append(createElement("span", "palette-library-issue-message", row.detail));
  return detail;
}

function skillEditableLabel(prompt: PromptDefinition) {
  return prompt.registry_editable === false ? "Read-only" : "Editable";
}

function skillInstallStatusLabel(prompt: PromptDefinition) {
  const sourcePath = prompt.registry_source_path ?? "";
  if (/(^|[/\\])\.codex[/\\]skills[/\\]/.test(sourcePath)) {
    return "Project Skill";
  }
  if (prompt.registry_source === "bundled") return "Bundled Skill";
  if (prompt.registry_source === "local-override") return "Local Override";
  return "Installed Skill";
}

function libraryArtifactActions(prompt: PromptDefinition) {
  const primary = promptArtifactType(prompt) === "skill"
    ? "Read Skill"
    : promptArtifactType(prompt) === "context"
    ? "Load Context"
    : "Load Prompt";
  return libraryRowActions(primary, [
    { key: "⌘O", title: "Open" },
    { key: "⌘E", title: libraryProjectWriteActionLabel(prompt) },
  ]);
}

function libraryCommandActions(command: LauncherCommand) {
  return libraryRowActions(commandPrimaryAction(command), [
    { key: "⌘C", title: `Copy ${commandHandle(command)}` },
  ]);
}

function libraryIssueActions(row: LibraryIssueRow) {
  if (!row.actionCommand) return null;
  return libraryRowActions("Run Recovery", []);
}

function libraryRowActions(
  primaryLabel: string,
  secondary: Array<{ key: string; title: string }>,
) {
  const actions = createElement("span", "palette-search-row-actions");
  actions.append(libraryPrimaryActionCue(primaryLabel, "↵"));
  for (const action of secondary) {
    actions.append(libraryKeyCue(action.key, action.title));
  }
  return actions;
}

function libraryPrimaryActionCue(label: string, key: string) {
  const cue = createElement("span", "palette-search-row-action is-primary");
  cue.title = label;
  cue.setAttribute("aria-label", label);
  cue.append(libraryKeyCue(key, label));
  return cue;
}

function libraryKeyCue(key: string, title: string) {
  const cue = createElement("kbd", "palette-search-row-key", key);
  cue.title = title;
  cue.setAttribute("aria-label", title);
  return cue;
}

function focusSelectedLibraryControl(shell: HTMLElement, rail: HTMLElement) {
  const selected = rail.querySelector<HTMLElement>(".palette-library-intervention.is-selected");
  if (selected) {
    scrollRowIntoRail(rail, selected);
    selected.focus({ preventScroll: true });
    return;
  }
  const selectedTab = shell.querySelector<HTMLElement>(".palette-library-tab.is-selected");
  if (selectedTab) {
    selectedTab.focus();
    return;
  }
  shell.focus();
}

function handleLibraryFilterShortcut(
  event: KeyboardEvent,
  actions: PaletteRenderActions,
) {
  if (!isCommandOnly(event)) return false;
  const index = Number(event.key) - 1;
  const filter = LIBRARY_FILTERS[index]?.id;
  if (!filter) return false;
  event.preventDefault();
  actions.setLibraryFilter(filter);
  return true;
}

function handleLibrarySortShortcut(
  event: KeyboardEvent,
  actions: PaletteRenderActions,
) {
  if (!event.metaKey || !event.shiftKey || event.ctrlKey || event.altKey) return false;
  const index = Number(event.key) - 1;
  const sort = LIBRARY_SORTS[index]?.id;
  if (!sort) return false;
  event.preventDefault();
  actions.setLibrarySort(sort);
  return true;
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
