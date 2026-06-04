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
import {
  applyLoadedPrompt,
  submitTemplateValues,
} from "../../src/overlay/loaded/deliveryController";
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

describe("palette runtime delivery and positioning behavior", () => {
  test("sync generation rejects stale async responses", () => {
    const palette = runtime();
    const first = nextPromptPaletteSyncGeneration(palette);
    const second = nextPromptPaletteSyncGeneration(palette);

    expect(isPromptPaletteSyncGenerationCurrent(palette, first)).toBe(false);
    expect(isPromptPaletteSyncGenerationCurrent(palette, second)).toBe(true);
  });

  test("keyboard number keys select and load visible prompt", () => {
    const palette = runtime(12);
    palette.active = true;
    palette.surfaceMode = "palette";
    palette.selectedIndex = 4;
    palette.visibleStart = 4;
    const calls: number[] = [];
    const event = keyboard("3");

    handlePromptPaletteKeyboard(event, palette, {
      loadSelected: () => undefined,
      applyLoaded: () => undefined,
      selectDelta: () => undefined,
      selectAndLoad: (index) => calls.push(index),
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => undefined,
    });

    expect(event.prevented).toBe(true);
    expect(calls).toEqual([6]);
  });

  test("Escape closes palette and loaded states through the global keyboard handler", () => {
    for (const surfaceMode of ["palette", "loaded"] as const) {
      const palette = runtime();
      palette.active = true;
      palette.surfaceMode = surfaceMode;
      if (surfaceMode === "loaded") {
        palette.preparedExecution = {
          promptId: "prompt-1",
          promptKind: "bundled",
          label: "Prompt 1",
          artifactHandle: "#prompt-1",
          deliveryMode: "paste",
          text: "Run prompt 1",
          contextTitles: [],
          contextHandles: [],
          unresolvedVariables: [],
        };
      }
      let unloadCount = 0;
      const event = keyboard("Escape");

      handlePromptPaletteKeyboard(event, palette, {
        loadSelected: () => undefined,
        applyLoaded: () => undefined,
        selectDelta: () => undefined,
        selectAndLoad: () => undefined,
        selectPageDelta: () => undefined,
        updateLoadedDeliveryMode: () => undefined,
        unload: () => {
          unloadCount += 1;
        },
      });

      expect(event.prevented).toBe(true);
      expect(unloadCount).toBe(1);
    }
  });

  test("loaded mode ignores selection keys, cycles delivery with Shift+Tab, and waits for target click", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "loaded";
    palette.preparedExecution = {
      promptId: "prompt-1",
      promptKind: "bundled",
      label: "Prompt 1",
      artifactHandle: "#prompt-1",
      deliveryMode: "paste",
      text: "Run prompt 1",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };
    let applyCount = 0;
    let deltaCount = 0;
    let mode: string | null = null;

    handlePromptPaletteKeyboard(keyboard("ArrowDown"), palette, {
      loadSelected: () => undefined,
      applyLoaded: () => {
        applyCount += 1;
      },
      selectDelta: () => {
        deltaCount += 1;
      },
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: (nextMode) => {
        mode = nextMode;
      },
      unload: () => undefined,
    });
    handlePromptPaletteKeyboard(keyboard("Tab", true), palette, {
      loadSelected: () => undefined,
      applyLoaded: () => {
        applyCount += 1;
      },
      selectDelta: () => {
        deltaCount += 1;
      },
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: (nextMode) => {
        mode = nextMode;
      },
      unload: () => undefined,
    });
    const enter = keyboard("Enter");
    handlePromptPaletteKeyboard(enter, palette, {
      loadSelected: () => undefined,
      applyLoaded: () => {
        applyCount += 1;
      },
      selectDelta: () => {
        deltaCount += 1;
      },
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: (nextMode) => {
        mode = nextMode;
      },
      unload: () => undefined,
    });

    expect(deltaCount).toBe(0);
    expect(enter.prevented).toBe(true);
    expect(applyCount).toBe(0);
    expect(mode).toBe("send");
  });

  test("loaded mode executes from target pointerdown", () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "loaded";
    palette.preparedExecution = {
      promptId: "prompt-1",
      promptKind: "bundled",
      label: "Prompt 1",
      artifactHandle: "#prompt-1",
      deliveryMode: "paste",
      text: "Run prompt 1",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };
    let applyCount = 0;
    let loadCount = 0;
    let prevented = false;

    const unbind = bindPaletteInput(surface, palette, {
      loadSelected: () => {
        loadCount += 1;
      },
      applyLoaded: () => {
        applyCount += 1;
      },
      selectDelta: () => undefined,
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => undefined,
    });

    surface.dispatch("pointerdown", {
      button: 0,
      target: null,
      preventDefault: () => {
        prevented = true;
      },
    });
    unbind();

    expect(prevented).toBe(true);
    expect(applyCount).toBe(1);
    expect(loadCount).toBe(0);
  });

  test("accessibility permission blocks keep the macOS prompt handoff alive", async () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "loaded";
    palette.preparedExecution = {
      promptId: "prompt-1",
      promptKind: "bundled",
      label: "Prompt 1",
      artifactHandle: "#prompt-1",
      deliveryMode: "paste",
      text: "Run prompt 1",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };
    const originalDeliver = native.deliverPromptAtPointer;
    const originalUnload = native.unloadOverlay;
    let unloadCount = 0;

    native.deliverPromptAtPointer = async () => ({
      delivery_id: 1,
      status: "blocked",
      message: "Accessibility permission required",
      diagnostic_code: "accessibility-required",
    });
    native.unloadOverlay = async () => {
      unloadCount += 1;
    };

    try {
      await applyLoadedPrompt(surface, palette);
      expect(unloadCount).toBe(0);
    } finally {
      native.deliverPromptAtPointer = originalDeliver;
      native.unloadOverlay = originalUnload;
    }
  });

  test("non-permission delivery blocks still unload the overlay", async () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "loaded";
    palette.preparedExecution = {
      promptId: "prompt-1",
      promptKind: "bundled",
      label: "Prompt 1",
      artifactHandle: "#prompt-1",
      deliveryMode: "paste",
      text: "Run prompt 1",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };
    const originalDeliver = native.deliverPromptAtPointer;
    const originalUnload = native.unloadOverlay;
    let unloadCount = 0;

    native.deliverPromptAtPointer = async () => ({
      delivery_id: 1,
      status: "blocked",
      message: "Native Delivery unavailable",
      diagnostic_code: "native-unavailable",
    });
    native.unloadOverlay = async () => {
      unloadCount += 1;
    };

    try {
      await applyLoadedPrompt(surface, palette);
      expect(unloadCount).toBe(1);
    } finally {
      native.deliverPromptAtPointer = originalDeliver;
      native.unloadOverlay = originalUnload;
    }
  });

  test("search mode closes on outside pointerdown instead of loading selection", () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    let loadCount = 0;
    let unloadCount = 0;
    let prevented = false;

    const unbind = bindPaletteInput(surface, palette, {
      loadSelected: () => {
        loadCount += 1;
      },
      applyLoaded: () => undefined,
      selectDelta: () => undefined,
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => {
        unloadCount += 1;
      },
    });

    surface.dispatch("pointerdown", {
      button: 0,
      target: null,
      preventDefault: () => {
        prevented = true;
      },
    });
    unbind();

    expect(prevented).toBe(true);
    expect(unloadCount).toBe(1);
    expect(loadCount).toBe(0);
  });

  test("Launcher mode unloads on window blur while loaded target state stays active", () => {
    const surface = fakeElement();
    const listeners = new Map<string, Array<() => void>>();
    (globalThis as unknown as { window: unknown }).window = {
      innerWidth: 800,
      innerHeight: 600,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
      clearTimeout: () => undefined,
      setTimeout: () => 1,
      addEventListener: (type: string, listener: () => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), listener]);
      },
      removeEventListener: (type: string, listener: () => void) => {
        listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
      },
    };

    const palette = runtime();
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    let unloadCount = 0;

    const unbind = bindPaletteInput(surface, palette, {
      loadSelected: () => undefined,
      applyLoaded: () => undefined,
      selectDelta: () => undefined,
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => {
        unloadCount += 1;
      },
    });

    for (const listener of listeners.get("blur") ?? []) listener();
    expect(unloadCount).toBe(1);

    palette.overlayMode = "palette";
    palette.launcherMode = null;
    palette.surfaceMode = "loaded";
    for (const listener of listeners.get("blur") ?? []) listener();
    unbind();

    expect(unloadCount).toBe(1);
    expect(listeners.get("blur")).toEqual([]);
  });

  test("loaded mode keeps the prompt surface on cursor coordinates", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "loaded";
    palette.x = 240;
    palette.y = 180;
    palette.preparedExecution = {
      promptId: "prompt-1",
      promptKind: "bundled",
      label: "Prompt 1",
      artifactHandle: "#prompt-1",
      deliveryMode: "paste",
      text: "Run prompt 1",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };

    positionPromptPalette(palette);

    expect(palette.container.style.transform).toBe("translate3d(240px, 180px, 0)");
  });

  test("loaded state stays cursor-adjacent after Shift+Tab delivery cycling", () => {
    const surface = fakeElement();
    const palette = runtime();
    setPromptPalettePointer(palette, 280, 190);
    setPromptPaletteLoadedState(surface, palette, {
      promptId: "prompt-1",
      promptKind: "bundled",
      label: "Prompt 1",
      artifactHandle: "#prompt-1",
      deliveryMode: "paste",
      text: "Run prompt 1",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    });
    positionPromptPalette(palette);

    const beforeTransform = palette.container.style.transform;
    const event = keyboard("Tab", true);
    handlePromptPaletteKeyboard(event, palette, {
      loadSelected: () => undefined,
      applyLoaded: () => undefined,
      selectDelta: () => undefined,
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: (mode) => {
        setPromptPaletteLoadedDeliveryMode(palette, mode);
        positionPromptPalette(palette);
      },
      unload: () => undefined,
    });

    expect(event.prevented).toBe(true);
    expect(palette.preparedExecution?.deliveryMode).toBe("send");
    expect(surface.classNames.has("is-loaded-mode")).toBe(true);
    expect(palette.container.style.transform).toBe(beforeTransform);
    expect(palette.container.style.transform).toBe("translate3d(280px, 190px, 0)");
  });

  test("Palette, Launcher, and loaded surfaces keep separate pointer contracts", () => {
    const surface = fakeElement();
    const palette = runtime();

    setPromptPalettePointer(palette, 220, 130);
    setPromptPaletteOverlayMode(surface, palette, "palette");
    setPromptPaletteActiveState(surface, palette, true);
    positionPromptPalette(palette);

    expect(palette.surfaceMode).toBe("palette");
    expect(surface.classNames.has("is-palette-mode")).toBe(true);
    expect(surface.classNames.has("is-launcher-mode")).toBe(false);
    expect(shouldTrackNativePointer(palette)).toBe(true);
    expect(palette.container.style.transform).toBe("translate3d(220px, 130px, 0)");

    for (const [launcherMode, expectedSurface] of [
      ["search", "search"],
      ["scratch", "scratch"],
      ["variables", "template"],
      ["stack", "context-picker"],
    ] as const) {
      setPromptPalettePointer(palette, 320, 210);
      setPromptPaletteOverlayMode(surface, palette, "launcher", launcherMode);
      setPromptPaletteActiveState(surface, palette, true);
      positionPromptPalette(palette);

      expect(palette.launcherMode).toBe(launcherMode);
      expect(palette.surfaceMode).toBe(expectedSurface);
      expect(surface.classNames.has("is-launcher-mode")).toBe(true);
      expect(shouldTrackNativePointer(palette)).toBe(false);
      expect(palette.container.style.transform).toBe("translate3d(0, 0, 0)");
    }

    setPromptPalettePointer(palette, 340, 230);
    setPromptPaletteLoadedState(surface, palette, {
      promptId: "prompt-1",
      promptKind: "bundled",
      label: "Prompt 1",
      artifactHandle: "#prompt-1",
      deliveryMode: "paste",
      text: "Run prompt 1",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    });
    positionPromptPalette(palette);

    expect(palette.overlayMode).toBe("palette");
    expect(palette.launcherMode).toBeNull();
    expect(palette.surfaceMode).toBe("loaded");
    expect(surface.classNames.has("is-loaded-mode")).toBe(true);
    expect(surface.classNames.has("is-launcher-mode")).toBe(false);
    expect(shouldTrackNativePointer(palette)).toBe(true);
    expect(palette.container.style.transform).toBe("translate3d(340px, 230px, 0)");

    setPromptPalettePointer(palette, 360, 250);
    positionPromptPalette(palette);

    expect(palette.container.style.transform).toBe("translate3d(360px, 250px, 0)");
  });

  test("scratch runtime positioning resets cursor transform for top-centered CSS layout", () => {
    const surface = fakeElement();
    const palette = runtime();
    setPromptPalettePointer(palette, 360, 260);
    setPromptPaletteOverlayMode(surface, palette, "launcher", "scratch");
    setPromptPaletteActiveState(surface, palette, true);
    positionPromptPalette(palette);

    expect(palette.surfaceMode).toBe("scratch");
    expect(surface.classNames.has("is-launcher-mode")).toBe(true);
    expect(surface.classNames.has("is-scratch-mode")).toBe(true);
    expect(palette.container.style.transform).toBe("translate3d(0, 0, 0)");
  });

  test("shift tab navigates selection before an intervention is loaded", () => {
    const palette = runtime();
    palette.active = true;
    palette.surfaceMode = "palette";
    let loadCount = 0;
    let delta = 0;
    const event = keyboard("Tab", true);

    handlePromptPaletteKeyboard(event, palette, {
      loadSelected: () => {
        loadCount += 1;
      },
      applyLoaded: () => undefined,
      selectDelta: (nextDelta) => {
        delta = nextDelta;
      },
      selectAndLoad: () => undefined,
      selectPageDelta: () => undefined,
      updateLoadedDeliveryMode: () => undefined,
      unload: () => undefined,
    });

    expect(event.prevented).toBe(true);
    expect(loadCount).toBe(0);
    expect(delta).toBe(-1);
  });

  test("search mode does not use Tab or Shift+Tab for browsing or delivery", () => {
    const palette = runtime();
    palette.active = true;
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    let loadCount = 0;
    let deltaCount = 0;
    let modeCount = 0;

    for (const event of [keyboard("Tab"), keyboard("Tab", true)]) {
      handlePromptPaletteKeyboard(event, palette, {
        loadSelected: () => {
          loadCount += 1;
        },
        applyLoaded: () => undefined,
        selectDelta: () => {
          deltaCount += 1;
        },
        selectAndLoad: () => undefined,
        selectPageDelta: () => undefined,
        updateLoadedDeliveryMode: () => {
          modeCount += 1;
        },
        unload: () => undefined,
      });

      expect(event.prevented).toBe(true);
    }

    expect(loadCount).toBe(0);
    expect(deltaCount).toBe(0);
    expect(modeCount).toBe(0);
  });

  test("Escape closes non-editable Palette, Launcher, context stack, and loaded surfaces", () => {
    for (const surfaceMode of ["palette", "search", "context-picker", "loaded"] as const) {
      const palette = runtime();
      palette.active = true;
      palette.surfaceMode = surfaceMode;
      palette.overlayMode = surfaceMode === "search" || surfaceMode === "context-picker"
        ? "launcher"
        : "palette";
      palette.launcherMode = surfaceMode === "search"
        ? "search"
        : surfaceMode === "context-picker"
          ? "stack"
          : null;
      let unloadCount = 0;
      const event = keyboard("Escape");

      handlePromptPaletteKeyboard(event, palette, {
        loadSelected: () => undefined,
        applyLoaded: () => undefined,
        selectDelta: () => undefined,
        selectAndLoad: () => undefined,
        selectPageDelta: () => undefined,
        updateLoadedDeliveryMode: () => undefined,
        unload: () => {
          unloadCount += 1;
        },
      });

      expect(event.prevented).toBe(true);
      expect(unloadCount).toBe(1);
    }
  });

  test("settings update preserves prompt selection", () => {
    const palette = runtime();
    palette.selectedIndex = 5;

    setPromptPaletteAppSettings(palette, {
      ...settings(),
      palette_visible_count: 7,
    });

    expect(palette.appSettings.palette_visible_count).toBe(7);
    expect(palette.selectedIndex).toBe(5);
  });

  test("delta selection wraps around prompt list", () => {
    const palette = runtime(3);
    expect(selectInterventionArtifactInPalette(palette, -1)).toBe(true);
    expect(palette.selectedIndex).toBe(2);
  });
});
