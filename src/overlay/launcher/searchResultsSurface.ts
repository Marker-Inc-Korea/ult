import { createElement } from "../../dom";
import {
  artifactHandleMatches,
  promptArtifactType,
} from "../../promptUtils";
import {
  parseSearchComposerQuery,
} from "../../searchComposer";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  stopPaletteChromePointerDown,
} from "../shared/renderShared";
import type { LauncherCommand } from "./launcherCommands";
import type { LauncherArtifactRow, LauncherRow } from "./launcherRows";
import {
  commandHandle,
  commandPrimaryAction,
  commandTitle,
} from "./searchCommandPresentation";
import {
  launcherArtifactRowText,
  launcherCommandRowText,
} from "./launcherRowPresentation";
import { scrollSelectedRowIntoRail } from "./launcherScroll";
import { searchRowsForPalette } from "./searchSelection";
import type { PromptPaletteRuntime } from "../../paletteRuntime";

export function renderSearchBody(
  body: HTMLElement,
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  body.replaceChildren();
  const composer = parseSearchComposerQuery(palette.searchQuery);
  const composerTokens = composer.tokens.filter((token) =>
    palette.prompts.some((prompt) => artifactHandleMatches(prompt, token.handle)),
  );
  const { rows } = searchRowsForPalette(palette);
  const inline = createElement("div", "palette-search-inline");
  if (composerTokens.length > 0) {
    inline.append(searchComposerTokens(composerTokens, actions));
  }
  if (palette.launcherFeedback) {
    inline.append(searchFeedback(palette.launcherFeedback));
  }
  if (inline.children.length > 0) {
    body.append(inline);
  }

  const home = palette.searchQuery.trim() === "";
  const sparse = isSparseSearchResults(palette, rows.length);
  body.classList.toggle("is-sparse-results", sparse);
  const rail = createElement(
    "div",
    [
      "panel-rail",
      "palette-search-results",
      home ? "is-home-results" : "",
      sparse ? "is-sparse-results" : "",
    ].filter(Boolean).join(" "),
  );
  rail.addEventListener("pointerdown", stopPaletteChromePointerDown);

  let previousSection = "";
  for (const [index, row] of rows.entries()) {
    const section = row.section;
    if (section !== previousSection) {
      rail.append(searchSectionHeader(section));
      previousSection = section;
    }
    rail.append(searchRowButton(row, index, palette.launcherCommandIndex, actions, home));
  }

  if (rows.length === 0) {
    const empty = createElement("div", "palette-empty palette-search-empty");
    empty.append(createElement("span", undefined, "No matches"));
    rail.append(empty);
  }

  body.append(rail);
}

function searchSectionHeader(label: string) {
  const header = createElement("div", "palette-search-section", label);
  header.setAttribute("role", "presentation");
  return header;
}

function searchFeedback(feedback: NonNullable<PromptPaletteRuntime["launcherFeedback"]>) {
  const status = createElement(
    "div",
    `palette-search-feedback is-${feedback.tone}`,
  );
  status.setAttribute("role", "status");
  status.append(createElement("span", undefined, feedback.message));
  return status;
}

function searchComposerTokens(
  tokens: ReturnType<typeof parseSearchComposerQuery>["tokens"],
  actions: PaletteRenderActions,
) {
  const bar = createElement("div", "palette-search-composer");
  for (const token of tokens) {
    const button = createElement(
      "button",
      `palette-search-token is-${token.kind}`,
    );
    button.type = "button";
    button.title = `Remove ${token.handle}`;
    button.append(
      createElement("span", undefined, token.handle),
      createElement("span", "palette-search-token-remove", "x"),
    );
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.removeSearchHandle(token.handle);
    });
    bar.append(button);
  }
  return bar;
}

function searchResultKind(prompt: PromptDefinition) {
  const artifactType = promptArtifactType(prompt);
  return artifactType === "context"
    ? "Context"
    : artifactType === "skill"
    ? "Skill"
    : "Prompt";
}

function searchRowButton(
  row: LauncherRow,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
  home = false,
) {
  if (row.kind === "artifact") {
    return searchArtifactButton(row, index, selectedIndex, actions, home);
  }
  return searchCommandButton(row.command, index, selectedIndex, actions, home);
}

function searchArtifactButton(
  row: LauncherArtifactRow,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
  home: boolean,
) {
  const selected = index === selectedIndex;
  const button = createElement(
    "button",
    [
      "panel-intervention",
      "palette-search-intervention",
      "palette-prompt-control",
      "is-artifact-row",
      home ? "is-home-row" : "",
      selected ? "is-selected" : "",
    ].filter(Boolean).join(" "),
  ) as HTMLButtonElement;
  button.type = "button";
  button.dataset.promptIndex = String(row.promptIndex);
  button.dataset.launcherRowIndex = String(index);
  button.dataset.rowKind = "artifact";
  button.title = `${row.promptIndex + 1}. ${row.prompt.title} - ${row.prompt.description}`;
  button.setAttribute("role", "menuitem");
  button.append(
    launcherArtifactRowText(row.prompt),
    searchRowMeta(selected ? searchArtifactActions(row, home) : null),
  );
  button.setAttribute("aria-label", `${searchResultKind(row.prompt)} ${button.title}`);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (row.command) {
      actions.runLauncherCommand(row.command);
      return;
    }
    actions.selectAndLoad(row.promptIndex, button);
  });
  return button;
}

function searchCommandButton(
  command: LauncherCommand,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
  home: boolean,
) {
  const selected = index === selectedIndex;
  const button = createElement(
    "button",
    [
      "panel-intervention",
      "palette-search-intervention",
      "palette-search-command",
      "is-command-row",
      home ? "is-home-row" : "",
      selected ? "is-selected" : "",
    ].filter(Boolean).join(" "),
  ) as HTMLButtonElement;
  button.type = "button";
  button.dataset.commandIndex = String(index);
  button.dataset.launcherRowIndex = String(index);
  button.dataset.rowKind = "command";
  button.title = `${commandHandle(command)} ${commandTitle(command)}`;
  button.append(
    launcherCommandRowText(command),
    searchRowMeta(selected ? searchCommandActions(command) : null),
  );
  button.setAttribute("aria-label", `Command ${button.title}`);
  button.addEventListener("pointerdown", stopPaletteChromePointerDown);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.runLauncherCommand(command);
  });
  return button;
}

function searchRowMeta(actions: HTMLElement | null) {
  const meta = createElement("span", "palette-search-row-meta");
  if (actions) {
    meta.append(actions);
  }
  return meta;
}

export function scrollSelectedSearchRowIntoView(root: HTMLElement) {
  scrollSelectedRowIntoRail(
    root,
    ".palette-search-results",
    ".palette-search-intervention.is-selected",
  );
}

export function isSparseSearchResults(
  palette: PromptPaletteRuntime,
  rowCount = searchRowsForPalette(palette).rows.length,
) {
  return palette.searchQuery.trim() !== "" && rowCount > 0 && rowCount <= 2;
}

function searchArtifactActions(row: LauncherArtifactRow, home: boolean) {
  const primary = row.command
    ? commandPrimaryAction(row.command)
    : artifactPrimaryAction(row.prompt);
  const secondary = home ? [] : [
    { key: "⌘O", title: "Open" },
    { key: "⌘C", title: "Copy Handle" },
    { key: "⌘.", title: "Actions" },
  ];
  return searchRowActions(primary, secondary);
}

function searchCommandActions(command: LauncherCommand) {
  return searchRowActions(commandPrimaryAction(command), [
    { key: "⌘C", title: `Copy ${commandHandle(command)}` },
  ]);
}

function searchRowActions(
  primaryLabel: string,
  secondary: Array<{ key: string; title: string }>,
) {
  const actions = createElement("span", "palette-search-row-actions");
  actions.append(searchPrimaryActionCue(primaryLabel, "↵"));
  for (const action of secondary) {
    actions.append(searchKeyCue(action.key, action.title));
  }
  return actions;
}

function searchPrimaryActionCue(label: string, key: string) {
  const cue = createElement("span", "palette-search-row-action is-primary");
  cue.title = label;
  cue.setAttribute("aria-label", label);
  cue.append(searchKeyCue(key, label));
  return cue;
}

function searchKeyCue(key: string, label: string) {
  const cue = createElement("kbd", "palette-search-row-key", key);
  cue.title = label;
  cue.setAttribute("aria-label", label);
  return cue;
}

function artifactPrimaryAction(prompt: PromptDefinition) {
  const artifactType = promptArtifactType(prompt);
  if (artifactType === "context") return "Load Context";
  if (artifactType === "skill") return "Open Skill";
  return "Load Prompt";
}
