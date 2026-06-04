import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { artifactHandleMatches } from "../../promptUtils";
import { searchComposerHandleBeforeCursor } from "../../searchComposer";
import type { PaletteRenderActions } from "../shared/renderTypes";
import { stopPaletteChromePointerDown } from "../shared/renderShared";
import { handleLauncherEscape } from "./launcherShell";
import { ephemeralClipContextEntries } from "./ephemeralContextState";
import {
  searchRowsForPalette,
  selectedSearchArtifactId,
  shouldOpenSelectedArtifactWithSpace,
} from "./searchSelection";
import { selectedLauncherSearchAction } from "./searchController";

export function createSearchInputRow(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  refreshSearchChrome: () => void,
) {
  let composing = false;
  let lastSubmittedSearchValue = palette.searchQuery;
  const search = createElement("input", "palette-search") as HTMLInputElement;
  search.type = "text";
  search.placeholder = "Try #review-change @repo-policy, $diagnose, /review-current-change";
  search.autocomplete = "off";
  search.spellcheck = false;
  search.value = palette.searchQuery;
  search.setAttribute("aria-label", "Search with prompt, context, skill, and command namespaces");

  const commitSearchValue = () => {
    if (search.value === lastSubmittedSearchValue) return;
    lastSubmittedSearchValue = search.value;
    actions.updateSearchQuery(search.value, { rerender: false });
    refreshSearchChrome();
  };

  search.addEventListener("compositionstart", () => {
    composing = true;
  });
  search.addEventListener("compositionend", () => {
    composing = false;
    window.setTimeout(commitSearchValue, 0);
  });
  search.addEventListener("input", (event) => {
    if (isTextComposing(event, composing)) return;
    commitSearchValue();
  });
  search.addEventListener("keydown", (event) => {
    if (isTextComposing(event, composing) || event.key === "Process") return;
    if (event.metaKey && event.key.toLowerCase() === "c" && inputSelectionIsCollapsed(search)) {
      const artifactId = selectedSearchArtifactId(palette);
      if (artifactId) {
        event.preventDefault();
        actions.runArtifactAction("copy-handle", artifactId);
        return;
      }
      const selection = selectedLauncherSearchAction(palette);
      if (selection.type === "command") {
        event.preventDefault();
        actions.copyLauncherCommandHandle(selection.command);
        return;
      }
    }
    if (event.metaKey && event.key.toLowerCase() === "o") {
      const artifactId = selectedSearchArtifactId(palette);
      if (artifactId) {
        event.preventDefault();
        actions.openArtifactReader(artifactId);
        return;
      }
    }
    if (isCommandOnly(event) && event.key === ".") {
      const artifactId = selectedSearchArtifactId(palette);
      if (artifactId) {
        event.preventDefault();
        actions.openArtifactActions(artifactId);
        return;
      }
    }
    if (isSpaceKey(event) && shouldOpenSelectedArtifactWithSpace(palette)) {
      const artifactId = selectedSearchArtifactId(palette);
      if (artifactId) {
        event.preventDefault();
        actions.openArtifactReader(artifactId);
        return;
      }
    }
    if (event.metaKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      lastSubmittedSearchValue = "";
      search.value = "";
      actions.updateSearchQuery("", { rerender: false });
      refreshSearchChrome();
      return;
    }
    if (
      event.key === "Backspace"
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
      && search.selectionStart === search.selectionEnd
    ) {
      const handle = searchComposerHandleBeforeCursor(
        search.value,
        search.selectionStart ?? search.value.length,
      );
      const isKnownHandle = handle
        ? palette.prompts.some((prompt) => artifactHandleMatches(prompt, handle))
        : false;
      if (handle && isKnownHandle) {
        event.preventDefault();
        actions.removeSearchHandle(handle);
        return;
      }
    }
    if (handleLauncherEscape(event, actions.unload)) {
      return;
    }
    if (
      event.key === "Tab"
      && event.shiftKey
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
    ) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selection = selectedLauncherSearchAction(palette);
      if (selection.type === "command") {
        actions.runLauncherCommand(selection.command);
        return;
      }
      if (selection.type === "artifact") {
        actions.selectAndLoad(selection.promptIndex, null);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const { rows } = searchRowsForPalette(palette);
      actions.selectLauncherCommandDelta(1, rows.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const { rows } = searchRowsForPalette(palette);
      actions.selectLauncherCommandDelta(-1, rows.length);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      const { rows } = searchRowsForPalette(palette);
      actions.selectLauncherCommandDelta(rows.length - 1, rows.length);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      const { rows } = searchRowsForPalette(palette);
      actions.selectLauncherCommandDelta(1 - rows.length, rows.length);
    }
  });

  const inputRow = createElement("div", "palette-search-input-row");
  inputRow.append(search);
  const stackButton = createStackSummaryButton(palette, actions);
  if (stackButton) inputRow.append(stackButton);

  return { inputRow, search };
}

function createStackSummaryButton(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const stackSummary = contextStackSummary(palette);
  if (stackSummary.count === 0) return null;
  const stackCount = createElement(
    "button",
    "palette-search-stack-count",
  ) as HTMLButtonElement;
  stackCount.type = "button";
  stackCount.append(createElement(
    "span",
    "palette-search-stack-label",
    `@${stackSummary.count}`,
  ));
  if (stackSummary.lifetime) {
    stackCount.append(createElement(
      "span",
      "palette-search-stack-expiry",
      stackSummary.lifetime,
    ));
  }
  stackCount.title = `${stackSummary.count} stacked context${
    stackSummary.count === 1 ? "" : "s"
  }.${
    stackSummary.lifetime ? ` Nearest expires in ${stackSummary.lifetime}.` : ""
  } Press Ctrl+V or click to choose.`;
  stackCount.setAttribute(
    "aria-label",
    `Open ${stackSummary.count} stacked context${
      stackSummary.count === 1 ? "" : "s"
    }${stackSummary.lifetime ? `, nearest expires in ${stackSummary.lifetime}` : ""}`,
  );
  stackCount.addEventListener("pointerdown", stopPaletteChromePointerDown);
  stackCount.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.openContextStack();
  });
  return stackCount;
}

function inputSelectionIsCollapsed(input: HTMLInputElement) {
  return input.selectionStart === input.selectionEnd;
}

function contextStackSummary(palette: PromptPaletteRuntime) {
  const entries = ephemeralClipContextEntries(palette.prompts);
  const expiries = entries
    .map((entry) => entry.expires_at)
    .filter((expiry): expiry is number =>
      typeof expiry === "number" && Number.isFinite(expiry)
    )
    .sort((left, right) => left - right);
  return {
    count: entries.length,
    lifetime: expiries.length > 0
      ? formatCompactLifetime(expiries[0] - Date.now())
      : null,
  };
}

function formatCompactLifetime(durationMs: number) {
  const safeDurationMs = Math.max(0, durationMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (safeDurationMs >= dayMs) {
    return `${Math.ceil(safeDurationMs / dayMs)}d`;
  }
  if (safeDurationMs >= hourMs) {
    return `${Math.ceil(safeDurationMs / hourMs)}h`;
  }
  return `${Math.max(1, Math.ceil(safeDurationMs / minuteMs))}m`;
}

function isTextComposing(event: Event, composing: boolean) {
  return composing || (event as { isComposing?: boolean }).isComposing === true;
}

function isSpaceKey(event: KeyboardEvent) {
  return (
    (event.key === " " || event.code === "Space")
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey
  );
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
