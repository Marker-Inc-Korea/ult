import { beforeEach, describe, expect, test } from "bun:test";

import { bindPaletteInput, handlePromptPaletteKeyboard } from "../../src/paletteInput";
import {
  orderPaletteArtifacts,
} from "../../src/paletteOverlay";
import {
  shouldContinueNativePointerPolling,
  shouldTrackNativePointer,
  syncPromptPalettePointerFromNative,
} from "../../src/overlay/shared/pointerTracking";
import {
  handleNativePaletteActiveEvent,
  handleNativePalettePointerEvent,
} from "../../src/overlay/shared/nativeOverlaySync";
import {
  addEphemeralContextCapture,
  ephemeralContextPickerEntries,
} from "../../src/overlay/launcher/ephemeralContextState";
import { runLauncherCommand } from "../../src/overlay/launcher/searchController";
import { prepareScratchInput } from "../../src/overlay/launcher/scratchController";
import {
  PROMPTS_PER_PAGE,
  acceptPromptPaletteScratchRefinement,
  failPromptPaletteScratchRefinement,
  finishPromptPaletteScratchRefinement,
  isPromptPaletteScratchRefinementCurrent,
  restorePromptPaletteScratchRefinementSource,
  isPromptPaletteSyncGenerationCurrent,
  acceptPromptPaletteNativeOverlayEvent,
  nextPromptPaletteSyncGeneration,
  positionPromptPalette,
  selectInterventionArtifactInPalette,
  selectedPrompt,
  setPromptPaletteActiveState,
  setPromptPaletteAccessibilityStatus,
  setPromptPaletteApplyingState,
  setPromptPaletteAppSettings,
  setPromptPaletteLoadedDeliveryMode,
  setPromptPaletteLoadedState,
  setPromptPaletteOverlayMode,
  setPromptPalettePageDelta,
  setPromptPalettePointer,
  setPromptPaletteScratchMetaConfirmation,
  setPromptPaletteScratchText,
  setPromptPaletteSearchQuery,
  setPromptPaletteSelectedIndex,
  setPromptPaletteTemplateState,
  clearPromptPaletteTemplateState,
  startPromptPaletteScratchRefinement,
  visiblePrompts,
  type PromptPaletteRuntime,
} from "../../src/paletteRuntime";
import { submitTemplateValues } from "../../src/overlay/loaded/deliveryController";
import type { PromptDefinition } from "../../src/types";
import { native } from "../../src/native";

import {
  clipContext,
  context,
  expiredClipContext,
  fakeElement,
  flushPromises,
  installPaletteRuntimeDom,
  keyboard,
  prompt,
  runtime,
  settings,
} from "./support/paletteRuntimeHarness";

beforeEach(() => {
  installPaletteRuntimeDom();
});

describe("palette runtime native overlay and pointer behavior", () => {
  test("native overlay generations ignore stale close events", () => {
    const palette = runtime();

    expect(acceptPromptPaletteNativeOverlayEvent(palette, 10)).toBe(true);
    expect(palette.nativeOverlayGeneration).toBe(10);
    expect(acceptPromptPaletteNativeOverlayEvent(palette, 9)).toBe(false);
    expect(palette.nativeOverlayGeneration).toBe(10);
    expect(acceptPromptPaletteNativeOverlayEvent(palette, 11)).toBe(true);
    expect(palette.nativeOverlayGeneration).toBe(11);
  });

  test("first palette open uses cursor-adjacent coordinates after native pointer sync", () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.active = false;
    palette.overlayMode = "palette";
    palette.surfaceMode = "idle";

    expect(shouldTrackNativePointer(palette)).toBe(true);

    setPromptPalettePointer(palette, 320, 220);
    setPromptPaletteOverlayMode(surface, palette, "palette");
    setPromptPaletteActiveState(surface, palette, true);
    positionPromptPalette(palette);

    expect(palette.surfaceMode).toBe("palette");
    expect(surface.classNames.has("is-palette-mode")).toBe(true);
    expect(palette.container.style.transform).toBe("translate3d(320px, 220px, 0)");

    const inactiveSearch = runtime();
    inactiveSearch.overlayMode = "launcher";
    inactiveSearch.launcherMode = "search";
    expect(shouldTrackNativePointer(inactiveSearch)).toBe(false);

    const loaded = runtime();
    loaded.active = true;
    loaded.surfaceMode = "loaded";
    expect(shouldTrackNativePointer(loaded)).toBe(true);
  });

  test("loaded prompt tracking starts after search selection switches surfaces", () => {
    const palette = runtime();
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    const generation = palette.syncGeneration;

    expect(shouldContinueNativePointerPolling(palette, generation)).toBe(false);

    palette.surfaceMode = "loaded";

    expect(shouldContinueNativePointerPolling(palette, generation)).toBe(true);

    palette.surfaceMode = "search";

    expect(shouldContinueNativePointerPolling(palette, generation)).toBe(false);
  });

  test("pointer tracking syncs native coordinates without overlay event handling", async () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "palette";
    const originalCurrentPointer = native.currentPalettePointer;
    let pointerReads = 0;
    native.currentPalettePointer = async () => {
      pointerReads += 1;
      return pointerReads === 1
        ? { x: 320, y: 220 }
        : { x: 700, y: 500 };
    };

    try {
      const generation = nextPromptPaletteSyncGeneration(palette);
      await syncPromptPalettePointerFromNative(palette, generation);

      expect(pointerReads).toBe(1);
      expect(palette.x).toBe(320);
      expect(palette.y).toBe(220);

      const staleGeneration = generation;
      nextPromptPaletteSyncGeneration(palette);
      await syncPromptPalettePointerFromNative(palette, staleGeneration);

      expect(pointerReads).toBe(2);
      expect(palette.x).toBe(320);
      expect(palette.y).toBe(220);
    } finally {
      native.currentPalettePointer = originalCurrentPointer;
    }
  });

  test("native overlay sync opens Launcher modes without pointer polling", async () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.active = false;
    palette.overlayMode = "palette";
    palette.surfaceMode = "idle";
    const originalCurrentPointer = native.currentPalettePointer;
    const originalLoadSettings = native.loadAppSettings;
    const originalAccessibility = native.accessibilityStatus;
    const originalSelected = native.paletteSelectedArtifactId;
    let pointerReads = 0;
    let rerenders = 0;
    native.currentPalettePointer = async () => {
      pointerReads += 1;
      return { x: 450, y: 260 };
    };
    native.loadAppSettings = async () => settings();
    native.accessibilityStatus = async () => ({
      platform: "macos",
      trusted: true,
      required_for_native_delivery: true,
    });
    native.paletteSelectedArtifactId = async () => null;

    try {
      await handleNativePaletteActiveEvent(palette, {
        surface: surface as unknown as HTMLElement,
        loadSelected: () => undefined,
        rerender: () => {
          rerenders += 1;
        },
        setActive: (active) => {
          setPromptPaletteActiveState(surface as unknown as HTMLElement, palette, active);
        },
      }, {
        active: true,
        mode: "launcher",
        launcher_mode: "search",
        generation: 11,
      });
      await flushPromises();

      expect(pointerReads).toBe(0);
      expect(palette.active).toBe(true);
      expect(palette.overlayMode).toBe("launcher");
      expect(palette.launcherMode).toBe("search");
      expect(palette.surfaceMode).toBe("search");
      expect(surface.classNames.has("is-launcher-mode")).toBe(true);
      expect(surface.classNames.has("is-search-mode")).toBe(true);
      expect(rerenders).toBeGreaterThan(0);
    } finally {
      native.currentPalettePointer = originalCurrentPointer;
      native.loadAppSettings = originalLoadSettings;
      native.accessibilityStatus = originalAccessibility;
      native.paletteSelectedArtifactId = originalSelected;
    }
  });

  test("native overlay sync delegates pointer movement to pointer tracking", () => {
    const palette = runtime();

    handleNativePalettePointerEvent(palette, { x: 900, y: -10 });

    expect(palette.x).toBe(800);
    expect(palette.y).toBe(0);
  });
});
