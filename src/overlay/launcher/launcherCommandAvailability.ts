import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { ephemeralContextPickerEntries } from "./ephemeralContextState";
import { mostRecentRunnableHistoryArtifact } from "./historyCommands";

export function recentPromptCommandAvailable(palette: PromptPaletteRuntime) {
  return Boolean(mostRecentRunnableHistoryArtifact(palette));
}

export function recentContextStackCommandAvailable(palette: PromptPaletteRuntime) {
  return ephemeralContextPickerEntries(palette).length > 0;
}
