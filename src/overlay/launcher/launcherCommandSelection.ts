import type { PromptPaletteRuntime } from "../../paletteRuntime";
import type { LauncherCommand } from "./launcherCommandTypes";

export function selectLauncherCommandDelta(
  palette: PromptPaletteRuntime,
  delta: number,
  count: number,
) {
  if (count <= 0) {
    palette.launcherCommandIndex = 0;
    return false;
  }
  const current = normalizeLauncherCommandIndex(palette.launcherCommandIndex, count);
  const next = (current + delta + count) % count;
  if (next === palette.launcherCommandIndex) return false;
  palette.launcherCommandIndex = next;
  return true;
}

export function selectLauncherPanelActionDelta(
  palette: PromptPaletteRuntime,
  delta: number,
  count: number,
) {
  if (count <= 0) {
    palette.launcherPanelActionIndex = 0;
    return false;
  }
  const current = normalizeLauncherCommandIndex(palette.launcherPanelActionIndex, count);
  const next = (current + delta + count) % count;
  if (next === palette.launcherPanelActionIndex) return false;
  palette.launcherPanelActionIndex = next;
  return true;
}

export function ensureLauncherCommandIndex(
  palette: PromptPaletteRuntime,
  count: number,
) {
  const next = normalizeLauncherCommandIndex(palette.launcherCommandIndex, count);
  const changed = next !== palette.launcherCommandIndex;
  palette.launcherCommandIndex = next;
  return changed;
}

export function ensureLauncherPanelActionIndex(
  palette: PromptPaletteRuntime,
  count: number,
) {
  const next = normalizeLauncherCommandIndex(palette.launcherPanelActionIndex, count);
  const changed = next !== palette.launcherPanelActionIndex;
  palette.launcherPanelActionIndex = next;
  return changed;
}

export function clampVisibleCommands(
  palette: PromptPaletteRuntime,
  commands: LauncherCommand[],
) {
  ensureLauncherCommandIndex(palette, commands.length);
  return commands;
}

function normalizeLauncherCommandIndex(index: number, count: number) {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(index)));
}
