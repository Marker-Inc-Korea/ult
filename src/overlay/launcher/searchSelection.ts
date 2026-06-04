import {
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import {
  launcherRowsForPalette,
  selectedLauncherRow,
} from "./launcherRows";

export function searchRowsForPalette(palette: PromptPaletteRuntime) {
  return launcherRowsForPalette(palette);
}

export function selectedSearchArtifactId(palette: PromptPaletteRuntime) {
  const row = selectedLauncherRow(palette);
  return row?.kind === "artifact" ? row.prompt.id : null;
}

export function shouldOpenSelectedArtifactWithSpace(palette: PromptPaletteRuntime) {
  if (!selectedSearchArtifactId(palette)) return false;
  const query = palette.searchQuery.trim();
  return !query
    || query.startsWith("#")
    || query.startsWith("/")
    || query.startsWith("@")
    || query.startsWith("$");
}
