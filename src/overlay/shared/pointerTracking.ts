import {
  isPromptPaletteSyncGenerationCurrent,
  setPromptPalettePointer,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import { native } from "../../native";

export function shouldTrackNativePointer(palette: PromptPaletteRuntime) {
  return palette.surfaceMode === "palette"
    || palette.surfaceMode === "loaded"
    || palette.surfaceMode === "clip-feedback"
    || (!palette.active && palette.overlayMode === "palette");
}

export function shouldContinueNativePointerPolling(
  palette: PromptPaletteRuntime,
  generation: number,
) {
  return (palette.active || palette.surfaceMode === "clip-feedback")
    && shouldTrackNativePointer(palette)
    && isPromptPaletteSyncGenerationCurrent(palette, generation);
}

export function applyNativePointerEvent(
  palette: PromptPaletteRuntime,
  x: number,
  y: number,
) {
  setPromptPalettePointer(palette, x, y);
}

export function startLoadedPointerTracking(
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  if (palette.surfaceMode !== "loaded") return;
  const generation = palette.syncGeneration;
  stopNativePointerPolling(palette);
  void syncLoadedPointerFromNative(palette, rerender).finally(() => {
    if (!shouldContinueNativePointerPolling(palette, generation)) return;
    startNativePointerPolling(palette, generation);
  });
}

export function startNativePointerPolling(
  palette: PromptPaletteRuntime,
  generation: number,
) {
  if (palette.pointerPollTimer !== null) return;
  palette.pointerPollTimer = window.setInterval(() => {
    if (!shouldContinueNativePointerPolling(palette, generation)) {
      stopNativePointerPolling(palette);
      return;
    }
    void syncPromptPalettePointerFromNative(palette, generation, {
      allowInactive: palette.surfaceMode === "clip-feedback",
    });
  }, 33);
}

export function stopNativePointerPolling(palette: PromptPaletteRuntime) {
  if (palette.pointerPollTimer === null) return;
  window.clearInterval(palette.pointerPollTimer);
  palette.pointerPollTimer = null;
}

export async function syncPromptPalettePointerFromNative(
  palette: PromptPaletteRuntime,
  generation: number,
  options: { allowInactive?: boolean } = {},
) {
  if (!shouldTrackNativePointer(palette)) return;
  if (palette.pointerSyncInFlight) return;
  palette.pointerSyncInFlight = true;
  try {
    const pointer = await native.currentPalettePointer();
    if (
      (!palette.active && !options.allowInactive)
      || !isPromptPaletteSyncGenerationCurrent(palette, generation)
    ) {
      return;
    }
    setPromptPalettePointer(palette, pointer.x, pointer.y);
  } catch {
    // Pointer sync is best-effort. The next native poll will correct it.
  } finally {
    palette.pointerSyncInFlight = false;
  }
}

async function syncLoadedPointerFromNative(
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  if (palette.surfaceMode !== "loaded") return;
  try {
    const pointer = await native.currentPalettePointer();
    if (palette.surfaceMode !== "loaded") return;
    setPromptPalettePointer(palette, pointer.x, pointer.y);
    rerender();
  } catch {
    // Loaded state remains usable at the last known pointer if native sync fails.
  }
}
