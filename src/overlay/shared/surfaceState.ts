import { stateForDeliveryResult } from "../../promptExecutor";
import type { OverlaySurfaceMode, PromptExecutionState } from "../../types";
import type { PromptPaletteRuntime } from "../../paletteRuntime";

export function updateSurfaceModeClasses(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  surface.classList.toggle("is-palette-mode", palette.active && palette.surfaceMode === "palette");
  surface.classList.toggle(
    "is-launcher-mode",
    palette.active && palette.overlayMode === "launcher",
  );
  surface.classList.toggle("is-search-mode", palette.active && palette.surfaceMode === "search");
  surface.classList.toggle("is-library-mode", palette.active && palette.surfaceMode === "library");
  surface.classList.toggle("is-loaded-mode", palette.active && palette.surfaceMode === "loaded");
  surface.classList.toggle("is-template-mode", palette.active && palette.surfaceMode === "template");
  surface.classList.toggle("is-scratch-mode", palette.active && palette.surfaceMode === "scratch");
  surface.classList.toggle(
    "is-context-picker-mode",
    palette.active && palette.surfaceMode === "context-picker",
  );
  surface.classList.toggle("is-clip-feedback-mode", palette.surfaceMode === "clip-feedback");
  surface.classList.toggle("is-idle-mode", palette.surfaceMode === "idle");
}

export function derivedOverlaySurfaceMode(palette: PromptPaletteRuntime): OverlaySurfaceMode {
  if (palette.overlayMode === "launcher") {
    if (palette.launcherMode === "scratch" || palette.launcherMode === "refine") {
      return "scratch";
    }
    if (palette.launcherMode === "library") return "library";
    if (palette.launcherMode === "variables") return "template";
    if (palette.launcherMode === "stack") return "context-picker";
    return "search";
  }
  return "palette";
}

export function syncOverlaySurfaceState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  mode?: OverlaySurfaceMode,
) {
  palette.surfaceMode = mode ?? derivedOverlaySurfaceMode(palette);
  palette.executionState = executionStateForSurface(palette);
  updateSurfaceModeClasses(surface, palette);
}

export function executionStateForSurface(palette: PromptPaletteRuntime): PromptExecutionState {
  if (palette.deliveryInFlight) return "applying";
  if (palette.surfaceMode === "template") return "collecting-template-values";
  if (palette.surfaceMode === "loaded") return "loaded";
  if (palette.lastDeliveryResult) return stateForDeliveryResult(palette.lastDeliveryResult);
  return "selecting";
}
