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

describe("palette runtime launcher context stack behavior", () => {
  test("explicit clipboard captures stack as ephemeral contexts shown first in at search", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.searchQuery = "@";
    palette.prompts = [
      context(1),
      prompt(2),
    ];

    addEphemeralContextCapture(palette, {
      artifact: clipContext(1, "First copied selection"),
      preview: "First copied selection",
      timestamp_ms: 1000,
      pointer: { x: 40, y: 50 },
    });
    addEphemeralContextCapture(palette, {
      artifact: clipContext(2, "Second copied selection"),
      preview: "Second copied selection",
      timestamp_ms: 1100,
      pointer: { x: 44, y: 54 },
    });

    expect(palette.ephemeralContextCount).toBe(2);
    expect(palette.clipFeedback).toEqual({
      handle: "@89abcde",
      preview: "Second copied selection",
      count: 2,
    });
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual([
      "89abcde",
      "75ac6db",
      "context-1",
    ]);
  });

  test("clip stack indicator remains after overlay closes while clips are cataloged", () => {
    const surface = fakeElement("main");
    const palette = runtime(0);
    addEphemeralContextCapture(palette, {
      artifact: clipContext(1, "Copied selection"),
      preview: "Copied selection",
      timestamp_ms: 1000,
      pointer: { x: 40, y: 50 },
    });

    palette.active = true;
    palette.surfaceMode = "search";
    setPromptPaletteActiveState(surface, palette, false);

    expect(palette.surfaceMode).toBe("clip-feedback");
    expect(palette.clipFeedback?.count).toBe(1);
    expect(surface.classNames.has("is-clip-feedback-mode")).toBe(true);
  });

  test("ephemeral clips remain catalog-backed until expiry or deletion", () => {
    const palette = runtime(0);
    addEphemeralContextCapture(palette, {
      artifact: clipContext(1, "First copied selection"),
      preview: "First copied selection",
      timestamp_ms: 1000,
      pointer: { x: 40, y: 50 },
    });
    addEphemeralContextCapture(palette, {
      artifact: clipContext(2, "Second copied selection"),
      preview: "Second copied selection",
      timestamp_ms: 1100,
      pointer: { x: 44, y: 54 },
    });

    expect(palette.ephemeralContextCount).toBe(2);
    expect(palette.clipFeedback).toMatchObject({
      handle: "@89abcde",
      count: 2,
    });
    expect(ephemeralContextPickerEntries(palette).map((entry) => entry.id)).toEqual([
      "89abcde",
      "75ac6db",
    ]);
  });

  test("Clipboard Stack excludes saved contexts and non-clipboard ephemeral contexts", () => {
    const palette = runtime(0);
    palette.prompts = [
      context(1),
      {
        ...context(2),
        scope: "ephemeral",
        source: "scratch",
        created_at: 1_100,
        expires_at: Date.now() + 60_000,
      },
      clipContext(1, "Copied selection"),
    ];

    expect(ephemeralContextPickerEntries(palette).map((entry) => entry.id))
      .toEqual(["75ac6db"]);
  });

  test("Clipboard Stack opens as Launcher stack mode and lists copied contexts newest first", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.prompts = [
      clipContext(1, "Older copied selection"),
      prompt(1),
      clipContext(3, "Newest copied selection"),
      clipContext(2, "Middle copied selection"),
    ];

    setPromptPaletteOverlayMode(surface, palette, "launcher", "stack");
    setPromptPaletteActiveState(surface, palette, true);
    setPromptPalettePointer(palette, 360, 240);
    positionPromptPalette(palette);

    expect(palette.surfaceMode).toBe("context-picker");
    expect(palette.overlayMode).toBe("launcher");
    expect(palette.launcherMode).toBe("stack");
    expect(surface.classNames.has("is-launcher-mode")).toBe(true);
    expect(surface.classNames.has("is-context-picker-mode")).toBe(true);
    expect(shouldTrackNativePointer(palette)).toBe(false);
    expect(palette.container.style.transform).toBe("translate3d(0, 0, 0)");
    expect(ephemeralContextPickerEntries(palette).map((entry) => entry.id)).toEqual([
      "c001234",
      "89abcde",
      "75ac6db",
    ]);
  });

  test("context picker keyboard selects clips and pastes with Enter", () => {
    const palette = runtime(0);
    palette.surfaceMode = "context-picker";
    palette.prompts = [
      clipContext(1, "Older copied selection"),
      clipContext(2, "Newer copied selection"),
    ];
    const deltas: number[] = [];
    let pasted = 0;
    let unloaded = 0;

    const down = keyboard("ArrowDown");
    expect(handlePromptPaletteKeyboard(down, palette, {
      loadSelected: () => undefined,
      applyLoaded: () => undefined,
      applyContextPicker: () => {
        pasted += 1;
      },
      selectDelta: () => undefined,
      selectContextPickerDelta: (delta) => {
        deltas.push(delta);
      },
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => {
        unloaded += 1;
      },
    })).toBe(true);
    expect(down.prevented).toBe(true);
    expect(deltas).toEqual([1]);

    const enter = keyboard("Enter");
    expect(handlePromptPaletteKeyboard(enter, palette, {
      loadSelected: () => undefined,
      applyLoaded: () => undefined,
      applyContextPicker: () => {
        pasted += 1;
      },
      selectDelta: () => undefined,
      selectContextPickerDelta: () => undefined,
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => {
        unloaded += 1;
      },
    })).toBe(true);
    expect(enter.prevented).toBe(true);
    expect(pasted).toBe(1);

    const escape = keyboard("Escape");
    expect(handlePromptPaletteKeyboard(escape, palette, {
      loadSelected: () => undefined,
      applyLoaded: () => undefined,
      applyContextPicker: () => undefined,
      selectDelta: () => undefined,
      selectContextPickerDelta: () => undefined,
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => {
        unloaded += 1;
      },
    })).toBe(true);
    expect(unloaded).toBe(1);
  });
});
