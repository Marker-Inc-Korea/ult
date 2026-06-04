import { listenPaletteEvents, native } from "../../native";
import {
  acceptPromptPaletteNativeOverlayEvent,
  isPromptPaletteSyncGenerationCurrent,
  nextPromptPaletteSyncGeneration,
  setPromptPaletteAccessibilityStatus,
  setPromptPaletteAppSettings,
  setPromptPaletteClipFeedbackState,
  setPromptPaletteDeliveryResult,
  setPromptPaletteOverlayMode,
  setPromptPaletteSelectedIndex,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import { applyAppearance } from "../../theme";
import type {
  EphemeralContextCaptureEvent,
  PaletteActiveEvent,
  PointerPosition,
} from "../../types";
import { addEphemeralContextCapture } from "../launcher/ephemeralContextState";
import {
  applyNativePointerEvent,
  shouldTrackNativePointer,
  startNativePointerPolling,
  stopNativePointerPolling,
  syncPromptPalettePointerFromNative,
} from "./pointerTracking";

export type OverlayNativeSyncActions = {
  surface: HTMLElement;
  loadSelected: (target: EventTarget | null) => void;
  rerender: () => void;
  setActive: (active: boolean) => void;
};

export function bindNativePaletteSync(
  palette: PromptPaletteRuntime,
  actions: OverlayNativeSyncActions,
) {
  void listenPaletteEvents({
    pointer: ({ x, y }) => {
      handleNativePalettePointerEvent(palette, { x, y });
    },
    active: (payload) => {
      void handleNativePaletteActiveEvent(palette, actions, payload);
    },
    deliveryResult: (result) => {
      setPromptPaletteDeliveryResult(palette, result);
      actions.rerender();
    },
    ephemeralContextCaptured: (capture) => {
      handleEphemeralContextCapture(palette, actions, capture);
    },
  })
    .then((unlisten) => {
      palette.unlistenNativeEvents?.();
      palette.unlistenNativeEvents = unlisten;
    })
    .catch((error) => {
      console.error("Failed to bind Ult palette events", error);
    });
}

export function handleNativePalettePointerEvent(
  palette: PromptPaletteRuntime,
  position: PointerPosition,
) {
  // Native push events provide an immediate cursor correction; polling lives in pointerTracking.
  applyNativePointerEvent(palette, position.x, position.y);
}

export async function handleNativePaletteActiveEvent(
  palette: PromptPaletteRuntime,
  actions: OverlayNativeSyncActions,
  payload: PaletteActiveEvent,
) {
  const { active, mode, launcher_mode: launcherMode, generation: nativeGeneration } = payload;
  if (!acceptPromptPaletteNativeOverlayEvent(palette, nativeGeneration)) return;
  const generation = nextPromptPaletteSyncGeneration(palette);
  if (!active) {
    actions.setActive(false);
    stopNativePointerPolling(palette);
    if (palette.surfaceMode === "clip-feedback") {
      void showClipStackIndicator(palette, actions, generation);
    }
    return;
  }

  setPromptPaletteOverlayMode(actions.surface, palette, mode, launcherMode ?? null);
  const activate = () => {
    if (!isPromptPaletteSyncGenerationCurrent(palette, generation)) return;
    actions.setActive(true);
    stopNativePointerPolling(palette);
    if (shouldTrackNativePointer(palette)) {
      startNativePointerPolling(palette, generation);
    }
    void syncPromptPaletteAccessibilityFromNative(palette, actions, generation);
    void syncPromptPaletteSettingsFromNative(palette, actions, generation);
    void syncPromptPaletteSelectionFromNative(palette, actions, generation);
    if (shouldTrackNativePointer(palette)) {
      void syncPromptPalettePointerFromNative(palette, generation);
      window.setTimeout(() => {
        void syncPromptPalettePointerFromNative(palette, generation);
      }, 80);
    }
  };

  if (shouldTrackNativePointer(palette)) {
    await syncPromptPalettePointerFromNative(palette, generation, { allowInactive: true });
    activate();
  } else {
    activate();
  }
}

export async function syncInterventionShortcutsFromNative(palette: PromptPaletteRuntime) {
  try {
    const result = await native.syncInterventionShortcuts(palette.prompts);
    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.warn("Intervention shortcut diagnostics", result);
    }
  } catch {
    // Shortcut sync is best-effort in the web shell; Tauri builds register it.
  }
}

function handleEphemeralContextCapture(
  palette: PromptPaletteRuntime,
  actions: OverlayNativeSyncActions,
  capture: EphemeralContextCaptureEvent,
) {
  if (!addEphemeralContextCapture(palette, capture)) return;

  if (palette.active && palette.surfaceMode !== "clip-feedback") {
    actions.rerender();
    return;
  }

  setPromptPaletteClipFeedbackState(
    actions.surface,
    palette,
    capture.pointer.x,
    capture.pointer.y,
  );
  actions.rerender();
  startNativePointerPolling(palette, palette.syncGeneration);
}

async function showClipStackIndicator(
  palette: PromptPaletteRuntime,
  actions: OverlayNativeSyncActions,
  generation: number,
) {
  if (!palette.clipFeedback) return;
  try {
    const pointer = await native.showEphemeralContextIndicator();
    if (!isPromptPaletteSyncGenerationCurrent(palette, generation)) return;
    if (palette.surfaceMode !== "clip-feedback") return;
    setPromptPaletteClipFeedbackState(actions.surface, palette, pointer.x, pointer.y);
    actions.rerender();
    startNativePointerPolling(palette, generation);
  } catch {
    // The stack remains available through @ Search even if the passive indicator cannot show.
  }
}

async function syncPromptPaletteSettingsFromNative(
  palette: PromptPaletteRuntime,
  actions: OverlayNativeSyncActions,
  generation: number,
) {
  try {
    const settings = await native.loadAppSettings();
    if (!isPromptPaletteSyncGenerationCurrent(palette, generation)) return;
    applyAppearance(settings.appearance);
    setPromptPaletteAppSettings(palette, settings);
    actions.rerender();
  } catch {
    // Settings sync is best-effort. The current runtime mode remains usable.
  }
}

async function syncPromptPaletteAccessibilityFromNative(
  palette: PromptPaletteRuntime,
  actions: OverlayNativeSyncActions,
  generation: number,
) {
  try {
    const status = await native.accessibilityStatus();
    if (!isPromptPaletteSyncGenerationCurrent(palette, generation)) return;
    setPromptPaletteAccessibilityStatus(actions.surface, palette, status);
    actions.rerender();
    if (status.trusted) {
      void syncPromptPaletteSelectionFromNative(palette, actions, generation);
    }
  } catch {
    if (!isPromptPaletteSyncGenerationCurrent(palette, generation)) return;
    actions.rerender();
  }
}

async function syncPromptPaletteSelectionFromNative(
  palette: PromptPaletteRuntime,
  actions: OverlayNativeSyncActions,
  generation: number,
) {
  if (!isPromptPaletteSyncGenerationCurrent(palette, generation)) return;
  if (!canApplyNativeSelectionSync(palette)) return;
  try {
    const selected = await native.paletteSelectedArtifactId();
    if (!isPromptPaletteSyncGenerationCurrent(palette, generation)) return;
    if (!canApplyNativeSelectionSync(palette)) return;
    const index = palette.prompts.findIndex((prompt) => prompt.id === selected);
    if (index >= 0) {
      setPromptPaletteSelectedIndex(palette, index);
      if (palette.launcherMode === "recent") {
        actions.loadSelected(null);
        return;
      }
      actions.rerender();
    }
  } catch {
    // Selection sync is best-effort.
  }
}

function canApplyNativeSelectionSync(palette: PromptPaletteRuntime) {
  return (
    (palette.surfaceMode === "palette" || palette.surfaceMode === "search")
    && !palette.deliveryInFlight
  );
}
