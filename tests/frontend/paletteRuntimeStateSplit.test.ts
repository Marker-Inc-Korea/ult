import { beforeEach, describe, expect, test } from "bun:test";

import {
  setPromptPaletteAccessibilityStatus,
  setPromptPaletteArtifactPanel,
  setPromptPaletteLauncherFeedback,
  setPromptPaletteLoadedState,
  setPromptPaletteOverlayMode,
  setPromptPaletteSearchQuery,
  setPromptPaletteScratchText,
  setPromptPaletteTemplateState,
  startPromptPaletteScratchRefinement,
} from "../../src/paletteRuntime";
import { pasteSelectedEphemeralContext } from "../../src/overlay/loaded/deliveryController";
import { selectLauncherPanelActionDelta } from "../../src/overlay/launcher/launcherCommands";
import { native } from "../../src/native";
import type { PreparedPromptExecution } from "../../src/promptExecutor";

import {
  clipContext,
  fakeElement,
  installPaletteRuntimeDom,
  runtime,
} from "./support/paletteRuntimeHarness";

beforeEach(() => {
  installPaletteRuntimeDom();
});

describe("palette runtime state split behavior", () => {
  function preparedPrompt(
    promptId: string,
    label = "Prompt",
  ): PreparedPromptExecution {
    return {
      promptId,
      promptKind: "registry",
      label,
      artifactHandle: `#${promptId}`,
      deliveryMode: "send",
      text: `Run ${promptId}`,
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };
  }

  test("keeps Launcher search row selection separate from panel action selection", () => {
    const palette = runtime(4);
    palette.surfaceMode = "search";
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.launcherCommandIndex = 2;

    expect(setPromptPaletteArtifactPanel(palette, {
      mode: "actions",
      artifactId: "prompt-1",
    })).toBe(true);

    expect(palette.launcherCommandIndex).toBe(2);
    expect(palette.launcherPanelActionIndex).toBe(0);

    expect(selectLauncherPanelActionDelta(palette, 2, 5)).toBe(true);
    expect(palette.launcherCommandIndex).toBe(2);
    expect(palette.launcherPanelActionIndex).toBe(2);

    expect(setPromptPaletteArtifactPanel(palette, null)).toBe(true);
    expect(palette.launcherArtifactPanel).toBeNull();
    expect(palette.launcherCommandIndex).toBe(2);
    expect(palette.launcherPanelActionIndex).toBe(0);
  });

  test("Search -> Library -> Search resets only the scoped sessions that changed", () => {
    const surface = fakeElement();
    const palette = runtime(4);
    palette.active = true;
    palette.surfaceMode = "search";
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.searchQuery = "/review";
    palette.launcherCommandIndex = 3;

    setPromptPaletteOverlayMode(surface, palette, "launcher", "library");

    expect(palette.launcherMode).toBe("library");
    expect(palette.surfaceMode).toBe("library");
    expect(palette.searchQuery).toBe("");
    expect(palette.launcherCommandIndex).toBe(0);
    expect(palette.launcherArtifactPanel).toBeNull();
    expect(surface.classNames.has("is-library-mode")).toBe(true);

    palette.launcherLibraryFilter = "skills";
    palette.launcherLibraryQuery = "diagnose";
    palette.launcherLibrarySort = "issues";
    palette.launcherCommandIndex = 2;

    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");

    expect(palette.launcherMode).toBe("search");
    expect(palette.surfaceMode).toBe("search");
    expect(palette.launcherLibraryFilter).toBe("all");
    expect(palette.launcherLibraryQuery).toBe("diagnose");
    expect(palette.launcherLibrarySort).toBe("issues");
    expect(palette.launcherCommandIndex).toBe(0);
    expect(surface.classNames.has("is-search-mode")).toBe(true);
    expect(surface.classNames.has("is-library-mode")).toBe(false);
  });

  test("search query changes reset search rows without clearing unrelated panel state", () => {
    const palette = runtime(4);
    palette.surfaceMode = "search";
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.launcherCommandIndex = 3;
    palette.launcherPanelActionIndex = 2;
    palette.launcherArtifactPanel = {
      mode: "reader",
      artifactId: "prompt-1",
    };
    setPromptPaletteLauncherFeedback(palette, "Copied #prompt-1.");

    expect(setPromptPaletteSearchQuery(palette, "/prompt")).toBe(true);

    expect(palette.searchQuery).toBe("/prompt");
    expect(palette.launcherCommandIndex).toBe(0);
    expect(palette.launcherFeedback).toBeNull();
    expect(palette.launcherArtifactPanel).toEqual({
      mode: "reader",
      artifactId: "prompt-1",
    });
    expect(palette.launcherPanelActionIndex).toBe(2);

    expect(setPromptPaletteSearchQuery(palette, "/prompt-2", { clearPanel: true })).toBe(true);
    expect(palette.launcherArtifactPanel).toBeNull();
    expect(palette.launcherPanelActionIndex).toBe(0);
  });

  test("Launcher mode transitions clear Launcher product state without resetting native sync state", () => {
    const surface = fakeElement();
    const palette = runtime(4);
    palette.surfaceMode = "search";
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.searchQuery = "/prompt";
    palette.launcherCommandIndex = 2;
    palette.launcherPanelActionIndex = 1;
    palette.launcherArtifactPanel = {
      mode: "actions",
      artifactId: "prompt-1",
    };
    palette.nativeOverlayGeneration = 8;
    palette.syncGeneration = 3;
    palette.x = 320;
    palette.y = 240;

    setPromptPaletteOverlayMode(surface, palette, "launcher", "scratch");

    expect(palette.launcherMode).toBe("scratch");
    expect(palette.searchQuery).toBe("");
    expect(palette.launcherCommandIndex).toBe(0);
    expect(palette.launcherArtifactPanel).toBeNull();
    expect(palette.launcherPanelActionIndex).toBe(0);
    expect(palette.nativeOverlayGeneration).toBe(8);
    expect(palette.syncGeneration).toBe(3);
    expect({ x: palette.x, y: palette.y }).toEqual({ x: 320, y: 240 });
  });

  test("loaded delivery state exits Launcher panels while preserving selected prompt state", () => {
    const surface = fakeElement();
    const palette = runtime(4);
    palette.surfaceMode = "search";
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.searchQuery = "/prompt";
    palette.launcherCommandIndex = 2;
    palette.selectedIndex = 3;
    palette.launcherArtifactPanel = {
      mode: "actions",
      artifactId: "prompt-1",
    };

    setPromptPaletteLoadedState(surface, palette, preparedPrompt("prompt-3", "Prompt 3"));

    expect(palette.surfaceMode).toBe("loaded");
    expect(palette.launcherMode).toBeNull();
    expect(palette.searchQuery).toBe("");
    expect(palette.launcherArtifactPanel).toBeNull();
    expect(palette.selectedIndex).toBe(3);
    expect(palette.preparedExecution?.promptId).toBe("prompt-3");
  });

  test("Loaded -> Accessibility blocked handoff preserves the loaded delivery session", () => {
    const surface = fakeElement();
    const palette = runtime(4);
    setPromptPaletteLoadedState(surface, palette, preparedPrompt("prompt-1", "Prompt 1"));

    setPromptPaletteAccessibilityStatus(surface, palette, {
      platform: "macos",
      trusted: false,
      required_for_native_delivery: true,
    });

    expect(palette.surfaceMode).toBe("loaded");
    expect(palette.executionState).toBe("loaded");
    expect(palette.preparedExecution?.promptId).toBe("prompt-1");
    expect(surface.classNames.has("is-loaded-mode")).toBe(true);
  });

  test("Scratch/refine -> Search clears scratch composition without touching native sync", () => {
    const surface = fakeElement();
    const palette = runtime(4);
    palette.nativeOverlayGeneration = 5;
    palette.syncGeneration = 7;
    setPromptPaletteOverlayMode(surface, palette, "launcher", "scratch");
    palette.active = true;
    setPromptPaletteScratchText(palette, "Draft prompt");

    const generation = startPromptPaletteScratchRefinement(palette, "Draft prompt");
    expect(generation).toBe(1);
    expect(palette.launcherMode).toBe("refine");
    expect(palette.scratchRefining).toBe(true);

    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");

    expect(palette.launcherMode).toBe("search");
    expect(palette.surfaceMode).toBe("search");
    expect(palette.scratchText).toBe("");
    expect(palette.scratchRefining).toBe(false);
    expect(palette.scratchRefineSourceText).toBeNull();
    expect(palette.nativeOverlayGeneration).toBe(5);
    expect(palette.syncGeneration).toBe(7);
  });

  test("Variables -> Loaded clears template session before delivery", () => {
    const surface = fakeElement();
    const palette = runtime(4);
    palette.surfaceMode = "search";
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";

    setPromptPaletteTemplateState(surface, palette, "prompt-1", ["context-1"], {
      branch: "main",
    });
    expect(palette.surfaceMode).toBe("template");

    setPromptPaletteLoadedState(surface, palette, preparedPrompt("prompt-1", "Prompt 1"));

    expect(palette.surfaceMode).toBe("loaded");
    expect(palette.launcherMode).toBeNull();
    expect(palette.templatePromptId).toBeNull();
    expect(palette.templateValues).toEqual({});
    expect(palette.templateContextIds).toEqual([]);
    expect(palette.preparedExecution?.promptId).toBe("prompt-1");
  });

  test("Clipboard Stack -> context paste exits stack through the applying transition", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.prompts = [
      clipContext(1, "Older copied selection"),
      clipContext(2, "Newer copied selection"),
    ];
    const originalDeliver = native.deliverPromptAtPointer;
    const deliveries: Array<{
      text: string;
      mode: string;
      promptId: string;
      promptKind: string;
    }> = [];
    native.deliverPromptAtPointer = async (text, mode, promptId, promptKind) => {
      deliveries.push({ text, mode, promptId, promptKind });
      return {
        delivery_id: 1,
        status: "started",
        message: "started",
      };
    };

    try {
      palette.active = true;
      setPromptPaletteOverlayMode(surface, palette, "launcher", "stack");
      setPromptPaletteAccessibilityStatus(surface, palette, {
        platform: "macos",
        trusted: true,
        required_for_native_delivery: true,
      });
      palette.contextPickerSelectedIndex = 1;

      await pasteSelectedEphemeralContext(surface, palette);

      expect(deliveries).toEqual([{
        text: "Older copied selection",
        mode: "paste",
        promptId: "75ac6db",
        promptKind: "context",
      }]);
      expect(palette.surfaceMode).toBe("idle");
      expect(palette.overlayMode).toBe("palette");
      expect(palette.launcherMode).toBeNull();
      expect(palette.deliveryInFlight).toBe(true);
      expect(surface.classNames.has("is-context-picker-mode")).toBe(false);
      expect(surface.classNames.has("is-idle-mode")).toBe(true);
    } finally {
      native.deliverPromptAtPointer = originalDeliver;
    }
  });
});
