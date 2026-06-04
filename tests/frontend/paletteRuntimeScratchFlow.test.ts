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

describe("palette runtime launcher scratch behavior", () => {
  test("scratch mode opens an ephemeral prompt surface", () => {
    const palette = runtime();
    const surface = fakeElement();

    setPromptPaletteOverlayMode(surface, palette, "launcher", "scratch");
    setPromptPaletteActiveState(surface, palette, true);
    setPromptPaletteScratchText(palette, "One-off intervention");

    expect(palette.surfaceMode).toBe("scratch");
    expect(palette.overlayMode).toBe("launcher");
    expect(palette.launcherMode).toBe("scratch");
    expect(surface.classNames.has("is-launcher-mode")).toBe(true);
    expect(surface.classNames.has("is-scratch-mode")).toBe(true);
    expect(surface.classNames.has("is-palette-mode")).toBe(false);
    expect(palette.scratchText).toBe("One-off intervention");

    setPromptPaletteActiveState(surface, palette, false);

    expect(palette.scratchText).toBe("");
  });

  test("scratch meta confirmation persists but pending state resets on edits", () => {
    const palette = runtime();

    setPromptPaletteScratchText(palette, "Refined intervention");
    setPromptPaletteScratchMetaConfirmation(palette, true);
    palette.scratchMetaConfirmPending = true;

    setPromptPaletteScratchText(palette, "Refined intervention with edits");

    expect(palette.scratchMetaConfirmRequired).toBe(true);
    expect(palette.scratchMetaConfirmPending).toBe(false);
  });

  test("scratch refinement compares result and can restore the source", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "scratch";
    palette.launcherMode = "scratch";

    setPromptPaletteScratchText(palette, "rough instruction");
    const generation = startPromptPaletteScratchRefinement(palette, palette.scratchText);
    expect(palette.launcherMode).toBe("refine");
    expect(finishPromptPaletteScratchRefinement(
      palette,
      "polished instruction",
      true,
      generation,
      "rough instruction",
    )).toBe(true);

    expect(palette.scratchText).toBe("rough instruction");
    expect(palette.scratchRefineSourceText).toBe("rough instruction");
    expect(palette.scratchRefineResultText).toBe("polished instruction");
    expect(palette.launcherMode).toBe("scratch");

    expect(acceptPromptPaletteScratchRefinement(palette)).toBe(true);
    expect(palette.scratchText).toBe("polished instruction");
    expect(palette.scratchMetaConfirmRequired).toBe(true);
    expect(palette.scratchRefineApplied).toBe(true);
    expect(palette.launcherMode).toBe("scratch");

    expect(restorePromptPaletteScratchRefinementSource(palette)).toBe(true);
    expect(palette.scratchText).toBe("rough instruction");
    expect(palette.scratchMetaConfirmRequired).toBe(false);
    expect(palette.scratchRefineSourceText).toBeNull();
    expect(palette.launcherMode).toBe("scratch");
  });

  test("scratch Enter saves an ephemeral prompt before loading it", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "scratch";
    palette.surfaceMode = "scratch";
    palette.scratchText = "Fix tests before more changes.";
    const saved = {
      ...prompt(1),
      id: "75ac6db",
      title: "Fix tests before more changes.",
      scope: "ephemeral" as const,
      pinned: false,
      description: "Saved scratch prompt.",
      prompt: "Fix tests before more changes.",
      source: "scratch" as const,
    };
    const originalSaveScratchPrompt = native.saveScratchPrompt;
    const calls: Array<{ text: string; confirm: boolean }> = [];
    let rerenders = 0;
    let pointerSyncs = 0;

    native.saveScratchPrompt = async (text, confirm) => {
      calls.push({ text, confirm });
      return {
        artifacts: [saved],
        entries: [],
        config_path: "/tmp/ult",
        registry_path: "/tmp/ult/registry.json",
        editable_artifact_ids: ["75ac6db"],
        errors: [],
        warnings: [],
      };
    };

    try {
      await prepareScratchInput(
        surface,
        palette,
        () => {
          rerenders += 1;
        },
        () => {
          pointerSyncs += 1;
        },
      );
    } finally {
      native.saveScratchPrompt = originalSaveScratchPrompt;
    }

    expect(calls).toEqual([{
      text: "Fix tests before more changes.",
      confirm: false,
    }]);
    expect(palette.surfaceMode).toBe("loaded");
    expect(palette.overlayMode).toBe("palette");
    expect(palette.preparedExecution?.promptId).toBe("75ac6db");
    expect(palette.preparedExecution?.artifactHandle).toBe("#75ac6db");
    expect(palette.preparedExecution?.text).toBe("Fix tests before more changes.");
    expect(palette.deliveryInFlight).toBe(false);
    expect(pointerSyncs).toBe(1);
    expect(rerenders).toBeGreaterThanOrEqual(2);
  });

  test("scratch refinement preserves source confirmation when re-refining", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "scratch";

    setPromptPaletteScratchText(palette, "dangerous refined instruction");
    setPromptPaletteScratchMetaConfirmation(palette, true);
    const generation = startPromptPaletteScratchRefinement(palette, palette.scratchText);

    expect(palette.scratchMetaConfirmRequired).toBe(true);
    expect(palette.scratchRefineSourceRequiresConfirmation).toBe(true);

    expect(finishPromptPaletteScratchRefinement(
      palette,
      "safer instruction",
      false,
      generation,
      "dangerous refined instruction",
    )).toBe(true);
    expect(restorePromptPaletteScratchRefinementSource(palette)).toBe(true);

    expect(palette.scratchText).toBe("dangerous refined instruction");
    expect(palette.scratchMetaConfirmRequired).toBe(true);
    expect(palette.scratchRefineSourceText).toBeNull();
  });

  test("failed scratch refinement clears transient metadata but preserves confirmation", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "scratch";

    setPromptPaletteScratchText(palette, "dangerous refined instruction");
    setPromptPaletteScratchMetaConfirmation(palette, true);
    const generation = startPromptPaletteScratchRefinement(palette, palette.scratchText);
    expect(failPromptPaletteScratchRefinement(
      palette,
      "OpenAI response was incomplete.",
      generation,
      "dangerous refined instruction",
    )).toBe(true);

    expect(palette.scratchRefining).toBe(false);
    expect(palette.scratchRefineSourceText).toBeNull();
    expect(palette.scratchRefineResultText).toBeNull();
    expect(palette.scratchMetaConfirmRequired).toBe(true);
    expect(palette.scratchRefineError).toBe("OpenAI response was incomplete.");
  });

  test("scratch edits clear stale refinement comparisons", () => {
    const palette = runtime();

    setPromptPaletteScratchText(palette, "rough instruction");
    startPromptPaletteScratchRefinement(palette, palette.scratchText);
    finishPromptPaletteScratchRefinement(palette, "polished instruction", false);

    setPromptPaletteScratchText(palette, "manual edit");

    expect(palette.scratchRefineSourceText).toBeNull();
    expect(palette.scratchRefineResultText).toBeNull();
    expect(palette.scratchRefineApplied).toBe(false);
  });

  test("scratch refinement ignores success after Scratch closes", () => {
    const surface = fakeElement();
    const palette = runtime();
    setPromptPaletteOverlayMode(surface, palette, "launcher", "scratch");
    setPromptPaletteActiveState(surface, palette, true);
    setPromptPaletteScratchText(palette, "rough instruction");
    const generation = startPromptPaletteScratchRefinement(palette, palette.scratchText);

    setPromptPaletteActiveState(surface, palette, false);

    expect(isPromptPaletteScratchRefinementCurrent(
      palette,
      generation,
      "rough instruction",
    )).toBe(false);
    expect(finishPromptPaletteScratchRefinement(
      palette,
      "late result",
      false,
      generation,
      "rough instruction",
    )).toBe(false);
    expect(palette.scratchRefineResultText).toBeNull();
  });

  test("scratch refinement ignores failure after surface mode changes", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "scratch";
    setPromptPaletteScratchText(palette, "rough instruction");
    const generation = startPromptPaletteScratchRefinement(palette, palette.scratchText);

    palette.surfaceMode = "search";

    expect(failPromptPaletteScratchRefinement(
      palette,
      "late failure",
      generation,
      "rough instruction",
    )).toBe(false);
    expect(palette.scratchRefineError).toBeNull();
  });

  test("scratch refinement ignores older provider responses after a newer refine starts", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "scratch";
    setPromptPaletteScratchText(palette, "first instruction");
    const firstGeneration = startPromptPaletteScratchRefinement(palette, palette.scratchText);

    setPromptPaletteScratchText(palette, "second instruction");
    const secondGeneration = startPromptPaletteScratchRefinement(palette, palette.scratchText);

    expect(finishPromptPaletteScratchRefinement(
      palette,
      "late first result",
      false,
      firstGeneration,
      "first instruction",
    )).toBe(false);
    expect(palette.scratchRefineResultText).toBeNull();

    expect(finishPromptPaletteScratchRefinement(
      palette,
      "second result",
      false,
      secondGeneration,
      "second instruction",
    )).toBe(true);
    expect(palette.scratchRefineResultText).toBe("second result");
  });
});
