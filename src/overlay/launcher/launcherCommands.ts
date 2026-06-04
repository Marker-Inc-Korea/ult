import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { launcherSearchForPalette } from "./launcherSearchIndex";

export type { LauncherCommand, LauncherCommandId } from "./launcherCommandTypes";
export {
  ensureLauncherCommandIndex,
  ensureLauncherPanelActionIndex,
  selectLauncherCommandDelta,
  selectLauncherPanelActionDelta,
} from "./launcherCommandSelection";

export function launcherCommandsForSearch(
  palette: PromptPaletteRuntime,
  hasArtifactMatches: boolean,
) {
  return launcherSearchForPalette(palette, { hasArtifactMatches }).commands;
}
