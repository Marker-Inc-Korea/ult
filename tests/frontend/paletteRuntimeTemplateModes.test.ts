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

describe("palette runtime launcher template behavior", () => {
  test("variable prompts always route through Launcher variables mode", () => {
    const surface = fakeElement();
    const palette = runtime(1);
    palette.active = true;
    palette.overlayMode = "palette";
    palette.surfaceMode = "palette";

    setPromptPaletteTemplateState(surface, palette, "prompt-0");

    expect(palette.active).toBe(true);
    expect(palette.overlayMode).toBe("launcher");
    expect(palette.launcherMode).toBe("variables");
    expect(palette.surfaceMode).toBe("template");
    expect(palette.templateReturnLauncherMode).toBeNull();
    expect(surface.classNames.has("is-launcher-mode")).toBe(true);
    expect(surface.classNames.has("is-template-mode")).toBe(true);
  });

  test("template cancel returns to the previous Launcher mode when one exists", () => {
    const surface = fakeElement();
    const palette = runtime(1);
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";

    setPromptPaletteTemplateState(surface, palette, "prompt-0");
    clearPromptPaletteTemplateState(surface, palette);

    expect(palette.active).toBe(true);
    expect(palette.overlayMode).toBe("launcher");
    expect(palette.launcherMode).toBe("search");
    expect(palette.surfaceMode).toBe("search");
    expect(surface.classNames.has("is-search-mode")).toBe(true);
  });

  test("active Launcher mode changes do not leave variables surface stale", () => {
    const surface = fakeElement();
    const palette = runtime(1);
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "variables";
    palette.surfaceMode = "template";

    setPromptPaletteOverlayMode(surface, palette, "launcher", "stack");

    expect(palette.overlayMode).toBe("launcher");
    expect(palette.launcherMode).toBe("stack");
    expect(palette.surfaceMode).toBe("context-picker");
    expect(surface.classNames.has("is-context-picker-mode")).toBe(true);
    expect(surface.classNames.has("is-template-mode")).toBe(false);

    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");

    expect(palette.launcherMode).toBe("search");
    expect(palette.surfaceMode).toBe("search");
    expect(surface.classNames.has("is-search-mode")).toBe(true);
    expect(surface.classNames.has("is-context-picker-mode")).toBe(false);
  });

  test("template submit blocks loading until required variables are filled", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "variables";
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-template";
    palette.prompts = [{
      ...prompt(1),
      id: "prompt-template",
      prompt: "Review {{scope}} with {{risk}}",
      template_variables: ["scope", "risk"],
    }];
    let renderCount = 0;
    let pointerSyncCount = 0;

    submitTemplateValues(
      surface,
      palette,
      { scope: "current diff", risk: "" },
      () => {
        renderCount += 1;
      },
      () => {
        pointerSyncCount += 1;
      },
    );

    expect(palette.surfaceMode).toBe("template");
    expect(palette.preparedExecution).toBeNull();
    expect(palette.templateValidationErrors).toEqual({ risk: "Required" });
    expect(pointerSyncCount).toBe(0);

    submitTemplateValues(
      surface,
      palette,
      { scope: "current diff", risk: "@repo-policy" },
      () => {
        renderCount += 1;
      },
      () => {
        pointerSyncCount += 1;
      },
    );

    expect(renderCount).toBe(2);
    expect(pointerSyncCount).toBe(1);
    expect(palette.surfaceMode).toBe("loaded");
    expect(palette.overlayMode).toBe("palette");
    expect(palette.preparedExecution?.artifactHandle).toBe("#prompt-template");
    expect(palette.preparedExecution?.templateValueLabels).toEqual(["scope", "risk"]);
  });
});
