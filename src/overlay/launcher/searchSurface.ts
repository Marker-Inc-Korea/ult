import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  createLauncherBody,
  createLauncherShell,
} from "./launcherShell";
import type { PaletteRenderActions } from "../shared/renderTypes";
import { renderArtifactPanel } from "./artifactPanelSurface";
import { createSearchInputRow } from "./searchInputSurface";
import {
  isSparseSearchResults,
  renderSearchBody,
  scrollSelectedSearchRowIntoView,
} from "./searchResultsSurface";

export function renderSearchSurface(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  if (palette.launcherArtifactPanel) {
    renderArtifactPanel(palette, actions);
    return;
  }

  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-search-panel",
    ariaLabel: "Launcher search",
    onEscape: actions.unload,
  });
  const body = createLauncherBody("palette-search-body");
  const refreshSearchChrome = () => {
    syncSearchResultDensity(shell, body, palette);
    renderSearchBody(body, palette, actions);
  };

  const { inputRow, search } = createSearchInputRow(
    palette,
    actions,
    refreshSearchChrome,
  );
  shell.append(inputRow);

  syncSearchResultDensity(shell, body, palette);
  renderSearchBody(body, palette, actions);
  shell.append(body);
  scrollSelectedSearchRowIntoView(body);

  search.focus();
  search.selectionStart = search.value.length;
  search.selectionEnd = search.value.length;
}

function syncSearchResultDensity(
  shell: HTMLElement,
  body: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  const sparse = isSparseSearchResults(palette);
  shell.classList.toggle("is-sparse-results", sparse);
  body.classList.toggle("is-sparse-results", sparse);
}
