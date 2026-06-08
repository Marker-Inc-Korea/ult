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
import { createArtifactPanelController } from "../../src/overlay/launcher/artifactPanelController";
import {
  launcherCommandsForSearch,
  type LauncherCommand,
} from "../../src/overlay/launcher/launcherCommands";
import { createProjectWriteController } from "../../src/overlay/launcher/projectWriteController";
import { createRecoveryPanelController } from "../../src/overlay/launcher/recoveryPanelController";
import { runLauncherCommand } from "../../src/overlay/launcher/searchController";
import { prepareScratchInput } from "../../src/overlay/launcher/scratchController";
import { createWorkflowInputController } from "../../src/overlay/launcher/workflowInputController";
import { WORKFLOW_BUILDER_CONTRACT } from "../../src/overlay/launcher/workflowBuilderContract";
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
import type {
  ProjectArtifactWriteKind,
  ProjectArtifactWritePreview,
  ProjectSetupPreview,
  ProjectSetupResult,
  ProjectSetupWriteTarget,
  PromptDefinition,
} from "../../src/types";
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

describe("palette runtime launcher command flow behavior", () => {
  test("artifact actions copy handle and body through an explicit clipboard action", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.prompts = [prompt(1)];
    const copied: string[] = [];
    let renderCount = 0;
    const restoreClipboard = installClipboardWriter(async (text) => {
      copied.push(text);
    });
    const controller = createArtifactPanelController({
      surface,
      palette,
      rerender: () => {
        renderCount += 1;
      },
      preparePrompt: () => undefined,
      openProjectArtifactWrite: () => undefined,
      applyLibraryResult: () => undefined,
    });

    try {
      controller.runArtifactAction("copy-handle", "prompt-1");
      await Promise.resolve();
      controller.runArtifactAction("copy-body", "prompt-1");
      await Promise.resolve();
    } finally {
      restoreClipboard();
    }

    expect(copied).toEqual(["#prompt-1", "Run prompt 1"]);
    expect(palette.launcherArtifactPanel).toBeNull();
    expect(palette.launcherFeedback).toEqual({
      message: "Copied body for #prompt-1.",
      tone: "neutral",
    });
    expect(renderCount).toBe(2);
  });

  test("artifact actions pin prompts and duplicate deliverable artifacts as scratch", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.active = true;
    palette.prompts = [{
      ...prompt(1),
      pinned: false,
    }];
    const updated: PromptDefinition[] = [];
    const applied: Array<{ selectedArtifactId: string | null; pinned: boolean }> = [];
    const originalUpdate = native.updateInterventionArtifact;
    let renderCount = 0;
    const controller = createArtifactPanelController({
      surface,
      palette,
      rerender: () => {
        renderCount += 1;
      },
      preparePrompt: () => undefined,
      openProjectArtifactWrite: () => undefined,
      applyLibraryResult: (result, selectedArtifactId) => {
        applied.push({
          selectedArtifactId,
          pinned: result.entries?.[0]?.prompt.pinned ?? false,
        });
        palette.prompts = result.entries?.map((entry) => entry.prompt) ?? palette.prompts;
      },
    });

    native.updateInterventionArtifact = async (_originalId, draft) => {
      updated.push(draft);
      return {
        artifacts: [],
        entries: [{
          prompt: draft,
          source: "local-file",
          source_path: null,
          editable: true,
          template_variables: [],
          diagnostics: [],
        }],
        config_path: "/Users/taeha/.ult/config.toml",
        editable_artifact_ids: [draft.id],
        errors: [],
        warnings: [],
      };
    };

    try {
      controller.runArtifactAction("toggle-pin", "prompt-1");
      await Promise.resolve();
      controller.runArtifactAction("duplicate-scratch", "prompt-1");
    } finally {
      native.updateInterventionArtifact = originalUpdate;
    }

    expect(updated.map((entry) => ({ id: entry.id, pinned: entry.pinned }))).toEqual([
      { id: "prompt-1", pinned: true },
    ]);
    expect(applied).toEqual([{ selectedArtifactId: "prompt-1", pinned: true }]);
    expect(palette.surfaceMode).toBe("scratch");
    expect(palette.launcherMode).toBe("scratch");
    expect(palette.scratchText).toBe("Run prompt 1");
    expect(palette.scratchNotice).toBe("Duplicated #prompt-1 as scratch.");
    expect(renderCount).toBe(2);
  });

  test("capture clipboard command stores a clip and opens Launcher stack mode", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    setPromptPaletteActiveState(surface, palette, true);
    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");
    const originalCapture = native.captureEphemeralContext;
    let renderCount = 0;

    native.captureEphemeralContext = async () => ({
      artifact: clipContext(3, "Captured clipboard text"),
      preview: "Captured clipboard text",
      timestamp_ms: 9_000_000_000_003,
      pointer: { x: 40, y: 50 },
    });

    try {
      runLauncherCommand(
        surface,
        palette,
        {
          id: "capture-clipboard",
          label: "Capture Clipboard",
          description: "Save current clipboard as temporary context.",
        },
        () => {
          renderCount += 1;
        },
        () => undefined,
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(palette.launcherMode).toBe("stack");
      expect(palette.surfaceMode).toBe("context-picker");
      expect(ephemeralContextPickerEntries(palette).map((entry) => entry.id)).toEqual([
        "c001234",
      ]);
      expect(palette.launcherFeedback).toBeNull();
      expect(renderCount).toBe(2);
    } finally {
      native.captureEphemeralContext = originalCapture;
    }
  });

  test("capture clipboard command reports failures inline without mutating stack", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    setPromptPaletteActiveState(surface, palette, true);
    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");
    const originalCapture = native.captureEphemeralContext;
    let renderCount = 0;

    native.captureEphemeralContext = async () => {
      throw new Error("clipboard does not contain text to capture");
    };

    try {
      runLauncherCommand(
        surface,
        palette,
        {
          id: "capture-clipboard",
          label: "Capture Clipboard",
          description: "Save current clipboard as temporary context.",
        },
        () => {
          renderCount += 1;
        },
        () => undefined,
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(palette.launcherMode).toBe("search");
      expect(palette.surfaceMode).toBe("search");
      expect(palette.launcherFeedback).toEqual({
        message: "clipboard does not contain text to capture",
        tone: "warning",
      });
      expect(ephemeralContextPickerEntries(palette)).toHaveLength(0);
      expect(renderCount).toBe(2);
    } finally {
      native.captureEphemeralContext = originalCapture;
    }
  });

  test("empty Launcher artifact command loads the selected prompt without a separate picker", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    const prepared: Array<{ prompt: PromptDefinition; contextIds: string[] }> = [];
    palette.prompts = [
      prompt(1),
      context(2),
    ];

    runLauncherCommand(
      surface,
      palette,
      {
        id: "load-artifact",
        label: "#prompt-1",
        description: "Prompt 1",
        artifactId: "prompt-1",
        artifactType: "prompt",
      },
      () => undefined,
      (prompt, contextIds) => {
        prepared.push({ prompt, contextIds });
      },
    );

    expect(prepared).toEqual([{
      prompt: palette.prompts[0],
      contextIds: [],
    }]);
  });

  test("Run Last Prompt uses usage metadata to prepare the latest available artifact", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.prompts = [
      prompt(1),
      prompt(2),
    ];
    palette.usageHistory = [
      {
        timestamp_ms: 1_700_000_000_000,
        prompt_id: "prompt-1",
        delivery_mode: "send",
        result: "delivered",
      },
      {
        timestamp_ms: 1_700_000_030_000,
        prompt_id: "missing-prompt",
        delivery_mode: "send",
        result: "delivered",
      },
      {
        timestamp_ms: 1_700_000_020_000,
        prompt_id: "prompt-2",
        delivery_mode: "paste",
        result: "failed",
      },
    ];
    const prepared: Array<{ prompt: PromptDefinition; contextIds: string[] }> = [];

    runLauncherCommand(
      surface,
      palette,
      {
        id: "run-last-prompt",
        label: "Run Last Prompt",
        description: "Prepare the most recent deliverable artifact from usage history.",
      },
      () => undefined,
      (prompt, contextIds) => {
        prepared.push({ prompt, contextIds });
      },
    );

    expect(prepared).toEqual([{
      prompt: palette.prompts[1],
      contextIds: [],
    }]);
  });

  test("Open Clipboard Stack opens only when non-expired copied clipboard contexts exist", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    setPromptPaletteActiveState(surface, palette, true);
    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");
    palette.prompts = [
      clipContext(1, "Fresh clipboard text"),
      expiredClipContext(2, "Expired clipboard text"),
    ];
    let renderCount = 0;

    runLauncherCommand(
      surface,
      palette,
      {
        id: "open-recent-context-stack",
        label: "Open Clipboard Stack",
        description: "Open explicitly captured clipboard contexts.",
      },
      () => {
        renderCount += 1;
      },
      () => undefined,
    );

    expect(palette.launcherMode).toBe("stack");
    expect(palette.surfaceMode).toBe("context-picker");
    expect(renderCount).toBe(1);

    const emptyPalette = runtime(0);
    setPromptPaletteActiveState(surface, emptyPalette, true);
    setPromptPaletteOverlayMode(surface, emptyPalette, "launcher", "search");
    emptyPalette.prompts = [
      context(1),
      {
        ...context(2),
        scope: "ephemeral",
        source: "scratch",
        created_at: 1000,
        expires_at: Date.now() + 1000,
      },
    ];
    runLauncherCommand(
      surface,
      emptyPalette,
      {
        id: "open-recent-context-stack",
        label: "Open Clipboard Stack",
        description: "Open explicitly captured clipboard contexts.",
      },
      () => undefined,
      () => undefined,
    );

    expect(emptyPalette.launcherMode).toBe("search");
    expect(emptyPalette.launcherFeedback).toEqual({
      message: "No clipboard stack is available.",
      tone: "warning",
    });
  });

  test("Clear Expired Contexts reloads the local library and reports metadata only", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    const fresh = clipContext(2, "Fresh clipboard text");
    palette.prompts = [
      expiredClipContext(1, "Expired private clipboard text"),
      fresh,
    ];
    const originalReload = native.reloadInterventionLibrary;
    let renderCount = 0;

    native.reloadInterventionLibrary = async () => ({
      artifacts: [],
      entries: [{
        prompt: fresh,
        source: "local-file",
        source_path: "/Users/taeha/.ult/personal-library/ephemeral/contexts/89abcde/CONTEXT.md",
        editable: true,
        template_variables: [],
        diagnostics: [],
      }],
      commands: [],
      config_path: "/Users/taeha/.ult/config.toml",
      registry_path: "/Users/taeha/.ult/personal-library",
      editable_artifact_ids: [fresh.id],
      errors: [],
      warnings: [],
    });

    try {
      runLauncherCommand(
        surface,
        palette,
        {
          id: "clear-expired-contexts",
          label: "Clear Expired Contexts",
          description: "Prune expired temporary context files and reload the local library.",
        },
        () => {
          renderCount += 1;
        },
        () => undefined,
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(palette.prompts.map((entry) => entry.id)).toEqual([fresh.id]);
      expect(palette.launcherFeedback).toEqual({
        message: "Cleared 1 expired context.",
        tone: "neutral",
      });
      expect(palette.launcherFeedback?.message).not.toContain("Expired private clipboard text");
      expect(renderCount).toBe(2);
    } finally {
      native.reloadInterventionLibrary = originalReload;
    }
  });

  test("Reveal Last Failed Delivery opens a metadata-only recovery panel", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.prompts = [{
      ...prompt(1),
      prompt: "PRIVATE PROMPT BODY",
    }];
    palette.usageHistory = [{
      timestamp_ms: 1_700_000_000_000,
      prompt_id: "prompt-1",
      delivery_mode: "send",
      result: "failed",
      diagnostic_code: "focus-timeout",
      target_application: {
        name: "Terminal",
        bundle_id: "com.apple.Terminal",
      },
    }];

    runLauncherCommand(
      surface,
      palette,
      {
        id: "reveal-last-failed-delivery",
        label: "Reveal Last Failed Delivery",
        description: "Show the latest failed delivery metadata without private content.",
      },
      () => undefined,
      () => undefined,
    );

    expect(palette.searchQuery).toBe("");
    expect(palette.launcherFeedback).toBeNull();
    expect(palette.launcherArtifactPanel).toEqual({
      mode: "recovery",
      status: "ready",
      entry: palette.usageHistory[0],
      error: null,
      message: null,
      exportPath: null,
    });
    expect(JSON.stringify(palette.launcherArtifactPanel)).not.toContain("PRIVATE PROMPT BODY");
  });

  test("Recovery panel actions stay explicit and metadata-only", async () => {
    const palette = runtime(0);
    const failedPrompt = {
      ...prompt(1),
      title: "Recoverable Prompt",
      prompt: "PRIVATE PROMPT BODY",
    };
    palette.prompts = [failedPrompt];
    palette.launcherArtifactPanel = {
      mode: "recovery",
      status: "ready",
      entry: {
        timestamp_ms: 1_700_000_000_000,
        prompt_id: "prompt-1",
        delivery_mode: "send",
        result: "failed",
        diagnostic_code: "accessibility-required",
        target_application: {
          name: "Terminal",
          bundle_id: "com.apple.Terminal",
        },
      },
      error: null,
      message: null,
      exportPath: null,
    };
    const originalReveal = native.revealInterventionSource;
    const originalExport = native.exportAppDiagnostics;
    const originalOpenPreferences = native.openPreferences;
    const prepared: Array<{ prompt: PromptDefinition; contextIds: string[] }> = [];
    const revealed: string[] = [];
    let diagnosticsExports = 0;
    let openedPreferences = 0;
    let renderCount = 0;
    const controller = createRecoveryPanelController({
      palette,
      rerender: () => {
        renderCount += 1;
      },
      preparePrompt: (preparedPrompt, contextIds) => {
        prepared.push({ prompt: preparedPrompt, contextIds });
        palette.surfaceMode = "loaded";
        palette.preparedExecution = {
          promptId: preparedPrompt.id,
          promptKind: "local",
          label: preparedPrompt.title,
          artifactHandle: "#prompt-1",
          deliveryMode: "paste",
          text: preparedPrompt.prompt,
          contextTitles: [],
          contextHandles: [],
          unresolvedVariables: [],
          templateValueLabels: [],
        };
      },
    });

    native.revealInterventionSource = async (artifactId) => {
      revealed.push(artifactId);
    };
    native.exportAppDiagnostics = async () => {
      diagnosticsExports += 1;
      return {
        file_path: "/tmp/ult-diagnostics.json",
        failure_count: 1,
      };
    };
    native.openPreferences = async () => {
      openedPreferences += 1;
    };

    try {
      controller.runRecoveryAction("prepare-again");
      expect(prepared).toEqual([{ prompt: failedPrompt, contextIds: [] }]);
      expect(palette.launcherArtifactPanel).toBeNull();

      palette.launcherArtifactPanel = {
        mode: "recovery",
        status: "ready",
        entry: {
          timestamp_ms: 1_700_000_000_000,
          prompt_id: "prompt-1",
          delivery_mode: "send",
          result: "failed",
          diagnostic_code: "accessibility-required",
          target_application: {
            name: "Terminal",
            bundle_id: "com.apple.Terminal",
          },
        },
        error: null,
        message: null,
        exportPath: null,
      };
      palette.surfaceMode = "search";
      controller.runRecoveryAction("retry-copy");
      expect(prepared).toHaveLength(2);
      expect(palette.preparedExecution?.deliveryMode).toBe("copy");

      palette.launcherArtifactPanel = {
        mode: "recovery",
        status: "ready",
        entry: {
          timestamp_ms: 1_700_000_000_000,
          prompt_id: "prompt-1",
          delivery_mode: "send",
          result: "failed",
          diagnostic_code: "accessibility-required",
          target_application: {
            name: "Terminal",
            bundle_id: "com.apple.Terminal",
          },
        },
        error: null,
        message: null,
        exportPath: null,
      };
      controller.runRecoveryAction("reveal-source");
      await Promise.resolve();
      expect(revealed).toEqual(["prompt-1"]);
      expect(JSON.stringify(palette.launcherArtifactPanel)).not.toContain("PRIVATE PROMPT BODY");

      controller.runRecoveryAction("open-accessibility");
      await Promise.resolve();
      expect(openedPreferences).toBe(1);

      controller.runRecoveryAction("export-diagnostics");
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "recovery",
        status: "exporting",
      });
      await Promise.resolve();
      expect(diagnosticsExports).toBe(1);
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "recovery",
        status: "ready",
        exportPath: "/tmp/ult-diagnostics.json",
      });
      expect(JSON.stringify(palette.launcherArtifactPanel)).not.toContain("PRIVATE PROMPT BODY");
      expect(renderCount).toBeGreaterThan(3);
    } finally {
      native.revealInterventionSource = originalReveal;
      native.exportAppDiagnostics = originalExport;
      native.openPreferences = originalOpenPreferences;
    }
  });

  test("GitHub import command opens Launcher import flow without Preferences", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    let opened = 0;

    runLauncherCommand(
      surface,
      palette,
      {
        id: "import-github",
        label: "Import from GitHub",
        description: "Preview a repository pack before writing local packages.",
      },
      () => undefined,
      () => undefined,
      undefined,
      () => {
        opened += 1;
      },
    );

    expect(opened).toBe(1);
    expect(palette.launcherFeedback).toBeNull();
  });

  test("Browse Packs command opens local starter pack discovery before import", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    let opened = 0;

    runLauncherCommand(
      surface,
      palette,
      {
        id: "browse-packs",
        label: "Browse Packs",
        description: "Discover starter packs before previewing a GitHub import.",
      },
      () => undefined,
      () => undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      () => {
        opened += 1;
      },
    );

    expect(opened).toBe(1);
    expect(palette.launcherFeedback).toBeNull();
  });

  test("external skill discovery commands open a gated panel without preparing delivery", () => {
    const cases = [
      ["discover-skills", "discover"],
      ["find-agent-skills", "find"],
      ["install-agent-skill", "install"],
    ] as const;

    for (const [commandId, intent] of cases) {
      const surface = fakeElement();
      const palette = runtime(0);
      let renderCount = 0;
      let prepared = false;

      runLauncherCommand(
        surface,
        palette,
        {
          id: commandId,
          label: commandId,
          description: "External skill discovery.",
        },
        () => {
          renderCount += 1;
        },
        () => {
          prepared = true;
        },
      );

      expect(palette.launcherArtifactPanel).toEqual({
        mode: "skill-discovery",
        intent,
      });
      expect(prepared).toBe(false);
      expect(renderCount).toBe(1);
      expect(palette.launcherFeedback).toBeNull();
    }
  });

  test("New Skill opens a source scaffold instead of Advanced Editor or delivery", () => {
    const cases = [
      ["new skill", "add-skill", null],
      ["$diagnose", "create-skill", "diagnose"],
    ] as const;

    for (const [query, commandId, initialId] of cases) {
      const surface = fakeElement();
      const palette = runtime(0);
      let renderCount = 0;
      let prepared = false;
      let composerOpened = false;
      const command = commandById(launcherCommandsForSearch({
        ...palette,
        searchQuery: query,
      }, false), commandId);

      runLauncherCommand(
        surface,
        palette,
        command,
        () => {
          renderCount += 1;
        },
        () => {
          prepared = true;
        },
        () => {
          composerOpened = true;
        },
      );

      expect(palette.launcherArtifactPanel).toEqual({
        mode: "skill-scaffold",
        initialId,
      });
      expect(prepared).toBe(false);
      expect(composerOpened).toBe(false);
      expect(renderCount).toBe(1);
      expect(palette.launcherFeedback).toBeNull();
    }
  });

  test("Library browse commands open Launcher Library mode with explicit filters", () => {
    const cases = [
      ["library", "browse-library", "all"],
      ["browse library", "browse-library", "all"],
      ["browse prompts", "browse-prompts", "prompts"],
      ["browse contexts", "browse-contexts", "contexts"],
      ["browse skills", "browse-skills", "skills"],
      ["browse commands", "browse-commands", "commands"],
    ] as const;

    for (const [query, commandId, expectedFilter] of cases) {
      const surface = fakeElement();
      const palette = runtime(0);
      setPromptPaletteActiveState(surface, palette, true);
      setPromptPaletteOverlayMode(surface, palette, "launcher", "search");
      let renderCount = 0;
      palette.searchQuery = query;
      const command = launcherCommandsForSearch(palette, false)
        .find((entry) => entry.id === commandId);
      palette.searchQuery = "stale search";

      expect(command).toBeDefined();
      runLauncherCommand(
        surface,
        palette,
        command!,
        () => {
          renderCount += 1;
        },
        () => undefined,
      );

      expect(palette.overlayMode).toBe("launcher");
      expect(palette.launcherMode).toBe("library");
      expect(palette.surfaceMode).toBe("library");
      expect(palette.searchQuery).toBe("");
      expect(palette.launcherLibraryFilter).toBe(expectedFilter);
      expect(renderCount).toBe(1);
    }
  });

  test("Review Installed Skills opens the local Skills Library from typed search", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    setPromptPaletteActiveState(surface, palette, true);
    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");
    palette.searchQuery = "review installed skills";
    const command = launcherCommandsForSearch(palette, false)
      .find((entry) => entry.id === "review-installed-skills");
    let renderCount = 0;

    expect(command).toBeDefined();
    runLauncherCommand(
      surface,
      palette,
      command!,
      () => {
        renderCount += 1;
      },
      () => undefined,
    );

    expect(palette.overlayMode).toBe("launcher");
    expect(palette.launcherMode).toBe("library");
    expect(palette.surfaceMode).toBe("library");
    expect(palette.searchQuery).toBe("");
    expect(palette.launcherLibraryFilter).toBe("skills");
    expect(renderCount).toBe(1);
  });

  test("typed command search stays a command palette instead of becoming inventory browsing", () => {
    const palette = runtime(0);
    palette.searchQuery = "commands";

    const commands = launcherCommandsForSearch(palette, false);

    expect(commands.map((command) => command.id)).toEqual([
      "browse-commands",
    ]);
    expect(commands.map((command) => command.id)).not.toContain("browse-prompts");
    expect(commands.map((command) => command.id)).not.toContain("compose-scratch");
  });

  test("agent workflow commands with inputs open an explicit workflow panel", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.launcherMode = "search";
    palette.searchQuery = "fix failing tests @context-1";
    palette.prompts = [
      context(1),
      {
        ...prompt(7),
        id: "workflow-fix-failing-tests",
        title: "Fix Failing Tests",
        description: "Editable local workflow prompt.",
        prompt: "LOCAL editable workflow prompt.",
      },
    ];
    const prepared: Array<{ prompt: PromptDefinition; contextIds: string[] }> = [];
    const projectWrites: Array<{ writeKind: string; artifactId?: string | null }> = [];
    let githubImports = 0;
    let renderCount = 0;

    const command = commandById(
      launcherCommandsForSearch(palette, true),
      "workflow-fix-failing-tests",
    );
    runLauncherCommand(
      surface,
      palette,
      command,
      () => {
        renderCount += 1;
      },
      (prompt, contextIds) => {
        prepared.push({ prompt, contextIds });
      },
      undefined,
      () => {
        githubImports += 1;
      },
      (writeKind, artifactId) => {
        projectWrites.push({ writeKind, artifactId });
      },
    );

    expect(palette.launcherArtifactPanel).toEqual({
      mode: "workflow-input",
      status: "form",
      commandId: "workflow-fix-failing-tests",
      inputText: "",
      contextHandleText: "@context-1",
      error: null,
    });
    expect(prepared).toEqual([]);
    expect(projectWrites).toEqual([]);
    expect(githubImports).toBe(0);
    expect(renderCount).toBe(1);
  });

  test("editable local workflow commands replace built-in workflow fallbacks and keep input panels", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.launcherMode = "search";
    palette.searchQuery = "fix failing tests @context-1";
    palette.prompts = [
      context(1),
      {
        ...prompt(7),
        id: "workflow-fix-failing-tests",
        title: "Fix Failing Tests",
        description: "Editable local workflow prompt.",
        prompt: "LOCAL editable workflow prompt.",
      },
    ];
    palette.userCommands = [{
      id: "workflow-fix-failing-tests",
      title: "Fix Failing Tests",
      description: "Editable local workflow command.",
      prompt_id: "workflow-fix-failing-tests",
      contexts: [],
      variable_values: {},
      keywords: ["fix", "failing", "tests"],
      aliases: ["red tests"],
      actions: ["prepare"],
      home: false,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/workflow-fix-failing-tests/COMMAND.md",
    }];
    const prepared: Array<{ prompt: PromptDefinition; contextIds: string[] }> = [];
    let renderCount = 0;

    const commands = launcherCommandsForSearch(palette, true);
    expect(commands.filter((command) =>
      command.id === "workflow-fix-failing-tests"
      || command.userCommand?.id === "workflow-fix-failing-tests"
    )).toHaveLength(1);
    const command = commands.find((entry) =>
      entry.userCommand?.id === "workflow-fix-failing-tests"
    );
    expect(command?.id).toBe("user-command");
    expect(command?.category).toBe("Workflow");

    runLauncherCommand(
      surface,
      palette,
      command!,
      () => {
        renderCount += 1;
      },
      (workflowPrompt, contextIds) => {
        prepared.push({ prompt: workflowPrompt, contextIds });
      },
    );

    expect(palette.launcherArtifactPanel).toEqual({
      mode: "workflow-input",
      status: "form",
      commandId: "workflow-fix-failing-tests",
      inputText: "",
      contextHandleText: "@context-1",
      error: null,
    });
    expect(prepared).toEqual([]);
    expect(renderCount).toBe(1);
  });

  test("stale editable workflow commands do not hide recoverable built-in fallbacks", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.launcherMode = "search";
    palette.searchQuery = "fix failing tests";
    palette.prompts = [];
    palette.userCommands = [{
      id: "workflow-fix-failing-tests",
      title: "Fix Failing Tests",
      description: "Stale editable workflow command.",
      prompt_id: "workflow-fix-failing-tests",
      contexts: [],
      variable_values: {},
      keywords: ["fix", "failing", "tests"],
      aliases: ["red tests"],
      actions: ["prepare"],
      home: false,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/workflow-fix-failing-tests/COMMAND.md",
    }];

    const commands = launcherCommandsForSearch(palette, true);
    const matching = commands.filter((command) =>
      command.id === "workflow-fix-failing-tests"
      || command.userCommand?.id === "workflow-fix-failing-tests"
    );

    expect(matching).toHaveLength(1);
    expect(matching[0].id).toBe("workflow-fix-failing-tests");
    expect(matching[0].userCommand).toBeUndefined();
    expect(matching[0].category).toBe("Workflow");
  });

  test("workflow input saves pasted text as local context only on continue", async () => {
    expect(WORKFLOW_BUILDER_CONTRACT.savedInputStorage).toBe("ephemeral-context-on-continue");
    expect(WORKFLOW_BUILDER_CONTRACT.copiedPrivateBodiesToHistoryOrSearch).toBe(false);
    expect(WORKFLOW_BUILDER_CONTRACT.implicitPromptDelivery).toBe(false);

    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.launcherMode = "search";
    palette.searchQuery = "fix failing tests @context-1";
    palette.prompts = [
      context(1),
      {
        ...prompt(7),
        id: "workflow-fix-failing-tests",
        title: "Fix Failing Tests",
        description: "Editable local workflow prompt.",
        prompt: "LOCAL editable workflow prompt.",
      },
    ];
    palette.usageHistory = [{
      timestamp_ms: 1,
      prompt_id: "prompt-1",
      delivery_mode: "send",
      result: "delivered",
    }];
    const originalSave = native.saveWorkflowInputContext;
    const originalExportDiagnostics = native.exportAppDiagnostics;
    const savedTexts: Array<{ text: string; workflowTitle: string }> = [];
    const prepared: Array<{ prompt: PromptDefinition; contextIds: string[] }> = [];
    let diagnosticsExports = 0;
    let renderCount = 0;
    const controller = createWorkflowInputController({
      palette,
      rerender: () => {
        renderCount += 1;
      },
      applyLibraryResult: (result, selectedArtifactId) => {
        palette.prompts = result.artifacts;
        palette.selectedIndex = selectedArtifactId
          ? palette.prompts.findIndex((entry) => entry.id === selectedArtifactId)
          : palette.selectedIndex;
      },
      preparePrompt: (prompt, contextIds) => {
        prepared.push({ prompt, contextIds });
      },
    });

    native.saveWorkflowInputContext = async (text, workflowTitle) => {
      savedTexts.push({ text, workflowTitle });
      const workflowContext: PromptDefinition = {
        ...context(2),
        id: "75ac6db",
        title: "Fix Failing Tests Input",
        description: "Explicit input for Fix Failing Tests.",
        prompt: text,
        scope: "ephemeral",
        source: "user",
        created_at: 1_700_000_000_000,
        expires_at: 1_700_604_800_000,
      };
      return {
        artifact: workflowContext,
        library: {
          artifacts: [context(1), palette.prompts[1], workflowContext],
          entries: [],
          commands: [],
          config_path: "/Users/taeha/.ult/config.toml",
          registry_path: "/Users/taeha/.ult/personal-library",
          editable_artifact_ids: ["context-1", "75ac6db"],
          errors: [],
          warnings: [],
        },
      };
    };
    native.exportAppDiagnostics = async () => {
      diagnosticsExports += 1;
      return {
        file_path: "/tmp/ult-diagnostics.json",
        failure_count: 0,
      };
    };

    try {
      await controller.submitWorkflowInput(
        "workflow-fix-failing-tests",
        "PRIVATE failing output",
        "@context-1",
      );

      expect(savedTexts).toEqual([{
        text: "PRIVATE failing output",
        workflowTitle: "Fix Failing Tests",
      }]);
      expect(prepared).toHaveLength(1);
      expect(prepared[0].prompt.id).toBe("workflow-fix-failing-tests");
      expect(prepared[0].prompt.prompt).toBe("LOCAL editable workflow prompt.");
      expect(prepared[0].contextIds).toEqual(["context-1", "75ac6db"]);
      expect(palette.usageHistory).toEqual([{
        timestamp_ms: 1,
        prompt_id: "prompt-1",
        delivery_mode: "send",
        result: "delivered",
      }]);
      expect(palette.launcherFeedback?.message ?? "").not.toContain("PRIVATE failing output");
      expect(diagnosticsExports).toBe(0);
      expect(renderCount).toBe(1);
    } finally {
      native.saveWorkflowInputContext = originalSave;
      native.exportAppDiagnostics = originalExportDiagnostics;
    }
  });

  test("workflow input can prepare explicit context handles without saving empty text", async () => {
    const palette = runtime(0);
    palette.prompts = [
      context(1),
      {
        ...prompt(7),
        id: "workflow-fix-failing-tests",
        title: "Fix Failing Tests",
        description: "Editable local workflow prompt.",
        prompt: "LOCAL editable workflow prompt.",
      },
    ];
    const originalSave = native.saveWorkflowInputContext;
    const prepared: Array<{ prompt: PromptDefinition; contextIds: string[] }> = [];
    let saveAttempts = 0;
    let renderCount = 0;
    const controller = createWorkflowInputController({
      palette,
      rerender: () => {
        renderCount += 1;
      },
      applyLibraryResult: () => {
        throw new Error("empty workflow input should not write a context");
      },
      preparePrompt: (workflowPrompt, contextIds) => {
        prepared.push({ prompt: workflowPrompt, contextIds });
      },
    });

    native.saveWorkflowInputContext = async () => {
      saveAttempts += 1;
      throw new Error("empty workflow input should not be saved");
    };

    try {
      await controller.submitWorkflowInput(
        "workflow-fix-failing-tests",
        "   ",
        "@context-1",
      );

      expect(saveAttempts).toBe(0);
      expect(prepared).toEqual([{
        prompt: palette.prompts[1],
        contextIds: ["context-1"],
      }]);
      expect(palette.launcherArtifactPanel).toBeNull();
      expect(renderCount).toBe(0);
    } finally {
      native.saveWorkflowInputContext = originalSave;
    }
  });

  test("Project Setup command opens the Launcher-owned setup wizard without writing", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    const skill = {
      ...prompt(3),
      id: "diagnose",
      title: "Diagnose",
      artifact_type: "skill" as const,
      prompt: "# Diagnose\n\nInspect logs.",
    };
    palette.prompts = [prompt(1), context(2), skill];
    let renderCount = 0;
    let prepared = 0;
    const controller = createProjectWriteController({
      palette,
      rerender: () => {
        renderCount += 1;
      },
    });

    runLauncherCommand(
      surface,
      palette,
      {
        id: "project-setup",
        label: "Project Setup",
        description: "Choose explicit project export/install commands.",
      },
      () => {
        throw new Error("project setup should render through the controller");
      },
      () => {
        prepared += 1;
      },
      undefined,
      undefined,
      undefined,
      controller.openProjectSetup,
    );

    expect(palette.launcherArtifactPanel).toMatchObject({
      mode: "project-setup",
      status: "form",
      presetId: "agent-control",
      selectedArtifactIds: ["prompt-1", "context-2", "diagnose"],
      includeAgentsSnippet: true,
      agentsSnippetArtifactId: "prompt-1",
    });
    expect(palette.launcherFeedback).toBeNull();
    expect(renderCount).toBe(1);
    expect(prepared).toBe(0);
  });

  test("Project Write ignores stale previews and blocks writes before preview confirmation", async () => {
    const palette = runtime(0);
    palette.prompts = [prompt(1)];
    const originalPreview = native.previewProjectArtifactWrite;
    const originalWrite = native.writeProjectArtifact;
    const firstPreview = deferred<void>();
    const secondPreview = deferred<void>();
    const previewCalls: string[] = [];
    const writeCalls: Array<{
      artifactId: string;
      writeKind: string;
      targetDirectory: string;
      overwrite: boolean;
    }> = [];
    const controller = createProjectWriteController({
      palette,
      rerender: () => undefined,
    });

    native.previewProjectArtifactWrite = async (
      artifactId,
      writeKind,
      targetDirectory,
      overwrite,
    ) => {
      previewCalls.push(targetDirectory);
      const preview = targetDirectory.endsWith("one") ? firstPreview : secondPreview;
      return preview.promise.then(() =>
        projectArtifactPreview(artifactId, writeKind, targetDirectory, overwrite),
      );
    };
    native.writeProjectArtifact = async (
      artifactId,
      writeKind,
      targetDirectory,
      overwrite,
    ) => {
      writeCalls.push({ artifactId, writeKind, targetDirectory, overwrite });
      return {
        artifact_id: artifactId,
        write_kind: writeKind,
        target_directory: targetDirectory,
        written_files: [`${targetDirectory}/.ult/prompts/${artifactId}/PROMPT.md`],
      };
    };

    try {
      controller.openProjectArtifactWrite("prompt", "prompt-1");
      const stale = controller.previewProjectArtifactWrite(
        "prompt-1",
        "prompt",
        "/tmp/project-one",
        false,
      );
      const latest = controller.previewProjectArtifactWrite(
        "prompt-1",
        "prompt",
        "/tmp/project-two",
        false,
      );

      secondPreview.resolve(undefined);
      await latest;
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-write",
        status: "preview",
        targetDirectory: "/tmp/project-two",
        preview: { target_directory: "/tmp/project-two" },
      });

      firstPreview.resolve(undefined);
      await stale;
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-write",
        status: "preview",
        targetDirectory: "/tmp/project-two",
        preview: { target_directory: "/tmp/project-two" },
      });
      expect(previewCalls).toEqual(["/tmp/project-one", "/tmp/project-two"]);

      palette.launcherArtifactPanel = {
        mode: "project-write",
        status: "form",
        artifactId: "prompt-1",
        writeKind: "prompt",
        targetDirectory: "/tmp/project-two",
        overwrite: false,
        preview: null,
        error: null,
        result: null,
      };
      await controller.writeProjectArtifact(
        "prompt-1",
        "prompt",
        "/tmp/project-two",
        false,
      );
      expect(writeCalls).toEqual([]);
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-write",
        status: "form",
        error: "Preview project files before writing.",
      });

      palette.launcherArtifactPanel = {
        mode: "project-write",
        status: "preview",
        artifactId: "prompt-1",
        writeKind: "prompt",
        targetDirectory: "/tmp/project-two",
        overwrite: false,
        preview: projectArtifactPreview(
          "prompt-1",
          "prompt",
          "/tmp/project-two",
          false,
          { blocked: true },
        ),
        error: null,
        result: null,
      };
      await controller.writeProjectArtifact(
        "prompt-1",
        "prompt",
        "/tmp/changed-after-preview",
        false,
      );
      expect(writeCalls).toEqual([]);
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-write",
        status: "preview",
        targetDirectory: "/tmp/project-two",
        error: "Confirm overwrite before writing existing project files.",
      });

      await controller.writeProjectArtifact(
        "prompt-1",
        "prompt",
        "/tmp/changed-after-preview",
        true,
      );
      expect(writeCalls).toEqual([{
        artifactId: "prompt-1",
        writeKind: "prompt",
        targetDirectory: "/tmp/project-two",
        overwrite: true,
      }]);
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-write",
        status: "result",
        targetDirectory: "/tmp/project-two",
      });
    } finally {
      native.previewProjectArtifactWrite = originalPreview;
      native.writeProjectArtifact = originalWrite;
    }
  });

  test("Project Setup wizard previews before writing and preserves overwrite confirmation", async () => {
    const palette = runtime(0);
    const skill = {
      ...prompt(3),
      id: "diagnose",
      title: "Diagnose",
      artifact_type: "skill" as const,
      prompt: "# Diagnose\n\nInspect logs.",
    };
    palette.prompts = [prompt(1), context(2), skill];
    const originalPreview = native.previewProjectSetup;
    const originalWrite = native.writeProjectSetup;
    const previewCalls: Array<{
      targets: Array<{ artifact_id: string; write_kind: string }>;
      targetDirectory: string;
      overwrite: boolean;
    }> = [];
    const writeCalls: Array<{
      targets: Array<{ artifact_id: string; write_kind: string }>;
      targetDirectory: string;
      overwrite: boolean;
      planHash: string;
    }> = [];
    let renderCount = 0;
    const controller = createProjectWriteController({
      palette,
      rerender: () => {
        renderCount += 1;
      },
    });

    native.previewProjectSetup = async (
      targets,
      targetDirectory,
      overwrite,
    ) => {
      previewCalls.push({ targets, targetDirectory, overwrite });
      const entries = targets.map((target) => {
        const blocked = target.write_kind === "prompt" && !overwrite;
        return {
          artifact_id: target.artifact_id,
          write_kind: target.write_kind,
          error: null,
          preview: {
            artifact_id: target.artifact_id,
            artifact_type: target.write_kind === "context"
              ? "context" as const
              : target.write_kind === "skill"
              ? "skill" as const
              : "prompt" as const,
            write_kind: target.write_kind,
            target_directory: targetDirectory,
            files: [{
              relative_path: `${target.write_kind}/${target.artifact_id}.md`,
              path: `${targetDirectory}/${target.write_kind}/${target.artifact_id}.md`,
              exists: blocked,
              action: blocked ? "blocked" as const : overwrite ? "overwrite" as const : "create" as const,
            }],
            requires_overwrite_confirmation: blocked,
            ready_to_write: !blocked,
          },
        };
      });
      return {
        target_directory: targetDirectory,
        entries,
        requires_overwrite_confirmation: entries.some((entry) =>
          entry.preview.requires_overwrite_confirmation
        ),
        ready_to_write: entries.every((entry) => entry.preview.ready_to_write),
        plan_hash: "setup-plan-1",
      };
    };
    native.writeProjectSetup = async (
      targets,
      targetDirectory,
      overwrite,
      planHash,
    ) => {
      writeCalls.push({ targets, targetDirectory, overwrite, planHash });
      const entries = targets.map((target) => ({
        artifact_id: target.artifact_id,
        write_kind: target.write_kind,
        error: null,
        files: [{
          relative_path: `${target.write_kind}/${target.artifact_id}.md`,
          path: `${targetDirectory}/${target.write_kind}/${target.artifact_id}.md`,
          exists: target.write_kind === "prompt",
          action: overwrite ? "overwrite" as const : "create" as const,
        }],
        result: {
          artifact_id: target.artifact_id,
          write_kind: target.write_kind,
          target_directory: targetDirectory,
          written_files: [`${targetDirectory}/${target.write_kind}/${target.artifact_id}.md`],
        },
      }));
      return {
        target_directory: targetDirectory,
        plan_hash: planHash,
        entries,
        written_files: entries.flatMap((entry) => entry.result.written_files),
        failed_files: [],
        ok: true,
      };
    };

    try {
      controller.openProjectSetup();
      await controller.previewProjectSetup(
        "/Users/taeha/Workspace/project",
        ["prompt-1", "context-2", "diagnose"],
        true,
        "prompt-1",
        false,
      );

      expect(previewCalls).toEqual([{
        targetDirectory: "/Users/taeha/Workspace/project",
        overwrite: false,
        targets: [
          { artifact_id: "prompt-1", write_kind: "prompt" },
          { artifact_id: "context-2", write_kind: "context" },
          { artifact_id: "diagnose", write_kind: "skill" },
          { artifact_id: "prompt-1", write_kind: "agents-snippet" },
        ],
      }]);
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "preview",
        presetId: "agent-control",
        preview: {
          requiresOverwriteConfirmation: true,
          readyToWrite: false,
        },
      });

      await controller.writeProjectSetup(
        "/Users/taeha/Workspace/project",
        ["prompt-1", "context-2", "diagnose"],
        true,
        "prompt-1",
        false,
      );
      expect(writeCalls).toEqual([]);
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "preview",
        error: "Confirm overwrite before writing existing project files.",
      });

      await controller.writeProjectSetup(
        "/tmp/not-previewed",
        [],
        false,
        null,
        true,
      );
      expect(writeCalls).toEqual([{
        targetDirectory: "/Users/taeha/Workspace/project",
        overwrite: true,
        planHash: "setup-plan-1",
        targets: [
          { artifact_id: "prompt-1", write_kind: "prompt" },
          { artifact_id: "context-2", write_kind: "context" },
          { artifact_id: "diagnose", write_kind: "skill" },
          { artifact_id: "prompt-1", write_kind: "agents-snippet" },
        ],
      }]);
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "result",
        result: {
          targetDirectory: "/Users/taeha/Workspace/project",
          writtenFiles: [
            "/Users/taeha/Workspace/project/prompt/prompt-1.md",
            "/Users/taeha/Workspace/project/context/context-2.md",
            "/Users/taeha/Workspace/project/skill/diagnose.md",
            "/Users/taeha/Workspace/project/agents-snippet/prompt-1.md",
          ],
          failedFiles: [],
          ok: true,
        },
      });
      expect(renderCount).toBeGreaterThan(3);
    } finally {
      native.previewProjectSetup = originalPreview;
      native.writeProjectSetup = originalWrite;
    }
  });

  test("Project Setup reports stale native previews and partial write failures", async () => {
    const palette = runtime(0);
    palette.prompts = [prompt(1), context(2)];
    palette.launcherArtifactPanel = {
      mode: "project-setup",
      status: "preview",
      targetDirectory: "/Users/taeha/Workspace/project",
      selectedArtifactIds: ["prompt-1", "context-2"],
      includeAgentsSnippet: false,
      agentsSnippetArtifactId: null,
      overwrite: false,
      preview: {
        targetDirectory: "/Users/taeha/Workspace/project",
        requiresOverwriteConfirmation: false,
        readyToWrite: true,
        planHash: "stale-plan",
        entries: [{
          artifactId: "prompt-1",
          writeKind: "prompt",
          error: null,
          preview: null,
        }, {
          artifactId: "context-2",
          writeKind: "context",
          error: null,
          preview: null,
        }],
      },
      error: null,
      result: null,
    };
    const originalWrite = native.writeProjectSetup;
    let renderCount = 0;
    const controller = createProjectWriteController({
      palette,
      rerender: () => {
        renderCount += 1;
      },
    });

    native.writeProjectSetup = async () => {
      throw new Error("project setup preview is stale; preview project files again");
    };

    try {
      await controller.writeProjectSetup(
        "/Users/taeha/Workspace/project",
        ["prompt-1", "context-2"],
        false,
        null,
        false,
      );
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "preview",
        error: "project setup preview is stale; preview project files again",
      });

      native.writeProjectSetup = async (
        targets,
        targetDirectory,
        overwrite,
        planHash,
      ) => ({
        target_directory: targetDirectory,
        plan_hash: planHash,
        ok: false,
        written_files: [`${targetDirectory}/.ult/prompts/prompt-1/PROMPT.md`],
        failed_files: [`${targetDirectory}/.ult/contexts/context-2/CONTEXT.md`],
        entries: targets.map((target) => ({
          artifact_id: target.artifact_id,
          write_kind: target.write_kind,
          files: [{
            relative_path: target.write_kind === "prompt"
              ? ".ult/prompts/prompt-1/PROMPT.md"
              : ".ult/contexts/context-2/CONTEXT.md",
            path: target.write_kind === "prompt"
              ? `${targetDirectory}/.ult/prompts/prompt-1/PROMPT.md`
              : `${targetDirectory}/.ult/contexts/context-2/CONTEXT.md`,
            exists: false,
            action: overwrite ? "overwrite" as const : "create" as const,
          }],
          result: target.write_kind === "prompt"
            ? {
              artifact_id: target.artifact_id,
              write_kind: target.write_kind,
              target_directory: targetDirectory,
              written_files: [`${targetDirectory}/.ult/prompts/prompt-1/PROMPT.md`],
            }
            : null,
          error: target.write_kind === "context" ? "failed to create parent directory" : null,
        })),
      });
      await controller.writeProjectSetup(
        "/Users/taeha/Workspace/project",
        ["prompt-1", "context-2"],
        false,
        null,
        false,
      );
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "result",
        error: "Some project files could not be written.",
        result: {
          ok: false,
          writtenFiles: ["/Users/taeha/Workspace/project/.ult/prompts/prompt-1/PROMPT.md"],
          failedFiles: ["/Users/taeha/Workspace/project/.ult/contexts/context-2/CONTEXT.md"],
        },
      });
      expect(renderCount).toBeGreaterThan(2);
    } finally {
      native.writeProjectSetup = originalWrite;
    }
  });

  test("Project Setup ignores stale preview and write results against the visible plan", async () => {
    const palette = runtime(0);
    palette.prompts = [prompt(1), context(2)];
    const originalPreview = native.previewProjectSetup;
    const originalWrite = native.writeProjectSetup;
    const firstPreview = deferred<void>();
    const secondPreview = deferred<void>();
    const thirdPreview = deferred<void>();
    const staleWrite = deferred<void>();
    const previewCalls: Array<{
      targetDirectory: string;
      planHash: string;
    }> = [];
    const writeCalls: Array<{
      targetDirectory: string;
      planHash: string;
      targets: ProjectSetupWriteTarget[];
    }> = [];
    const controller = createProjectWriteController({
      palette,
      rerender: () => undefined,
    });

    native.previewProjectSetup = async (targets, targetDirectory) => {
      const planHash = targetDirectory.endsWith("one")
        ? "setup-plan-one"
        : targetDirectory.endsWith("two")
        ? "setup-plan-two"
        : "setup-plan-three";
      previewCalls.push({ targetDirectory, planHash });
      const preview = projectSetupPreview(targets, targetDirectory, planHash);
      const deferredPreview = planHash === "setup-plan-one"
        ? firstPreview
        : planHash === "setup-plan-two"
        ? secondPreview
        : thirdPreview;
      return deferredPreview.promise.then(() => preview);
    };
    native.writeProjectSetup = async (
      targets,
      targetDirectory,
      _overwrite,
      planHash,
    ) => {
      writeCalls.push({ targets, targetDirectory, planHash });
      return staleWrite.promise.then(() =>
        projectSetupResult(targets, targetDirectory, planHash),
      );
    };

    try {
      controller.openProjectSetup();
      const stalePreviewRun = controller.previewProjectSetup(
        "/tmp/project-one",
        ["prompt-1", "context-2"],
        false,
        null,
        false,
        "custom",
      );
      const latestPreviewRun = controller.previewProjectSetup(
        "/tmp/project-two",
        ["prompt-1", "context-2"],
        false,
        null,
        false,
        "custom",
      );

      secondPreview.resolve(undefined);
      await latestPreviewRun;
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "preview",
        targetDirectory: "/tmp/project-two",
        preview: { planHash: "setup-plan-two" },
      });

      firstPreview.resolve(undefined);
      await stalePreviewRun;
      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "preview",
        targetDirectory: "/tmp/project-two",
        preview: { planHash: "setup-plan-two" },
      });

      const staleWriteRun = controller.writeProjectSetup(
        "/tmp/changed-after-preview",
        [],
        false,
        null,
        false,
      );
      expect(writeCalls).toEqual([{
        targetDirectory: "/tmp/project-two",
        planHash: "setup-plan-two",
        targets: [
          { artifact_id: "prompt-1", write_kind: "prompt" },
          { artifact_id: "context-2", write_kind: "context" },
        ],
      }]);

      const replacementPreviewRun = controller.previewProjectSetup(
        "/tmp/project-three",
        ["prompt-1"],
        false,
        null,
        false,
        "custom",
      );
      thirdPreview.resolve(undefined);
      await replacementPreviewRun;
      staleWrite.resolve(undefined);
      await staleWriteRun;

      expect(palette.launcherArtifactPanel).toMatchObject({
        mode: "project-setup",
        status: "preview",
        targetDirectory: "/tmp/project-three",
        preview: { planHash: "setup-plan-three" },
        result: null,
      });
      expect(previewCalls).toEqual([
        { targetDirectory: "/tmp/project-one", planHash: "setup-plan-one" },
        { targetDirectory: "/tmp/project-two", planHash: "setup-plan-two" },
        { targetDirectory: "/tmp/project-three", planHash: "setup-plan-three" },
      ]);
    } finally {
      native.previewProjectSetup = originalPreview;
      native.writeProjectSetup = originalWrite;
    }
  });

  test("user-defined Launcher commands prepare referenced prompts with contexts and presets", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    const templatePrompt = {
      ...prompt(1),
      title: "Review Change",
      prompt: "Review {{branch}} with {{policy}}.",
      template_variables: ["branch", "policy"],
    };
    palette.prompts = [
      templatePrompt,
      context(2),
    ];
    palette.userCommands = [{
      id: "review-repo",
      title: "Review Repo",
      description: "Review with repo policy.",
      prompt_id: "prompt-1",
      contexts: ["context-2"],
      variable_values: {
        branch: "main",
        policy: "@context-2",
      },
      keywords: ["review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
    }];
    palette.searchQuery = "rr @context-2";
    const prepared: Array<{
      prompt: PromptDefinition;
      contextIds: string[];
      templateValues: Record<string, string> | undefined;
    }> = [];

    const command = commandById(
      launcherCommandsForSearch(palette, false),
      "user-command",
    );
    runLauncherCommand(
      surface,
      palette,
      command,
      () => undefined,
      (prompt, contextIds, options) => {
        prepared.push({
          prompt,
          contextIds,
          templateValues: options?.templateValues,
        });
      },
    );

    expect(prepared).toEqual([{
      prompt: templatePrompt,
      contextIds: ["context-2"],
      templateValues: {
        branch: "main",
        policy: "@context-2",
      },
    }]);
  });

  test("typed project write commands do not scan unrelated library artifacts", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.searchQuery = "export prompt";
    palette.prompts = [
      context(1),
      prompt(2),
    ];
    palette.selectedIndex = 0;
    const opened: Array<{ writeKind: string; artifactId: string | null | undefined }> = [];

    runLauncherCommand(
      surface,
      palette,
      {
        id: "export-prompt-project",
        label: "Export Prompt to Project...",
        description: "Preview exact project files before writing.",
      },
      () => undefined,
      () => undefined,
      undefined,
      undefined,
      (writeKind, artifactId) => {
        opened.push({ writeKind, artifactId });
      },
    );

    expect(opened).toEqual([]);
    expect(palette.launcherFeedback).toEqual({
      message: "Select a prompt before exporting it to a project.",
      tone: "warning",
    });
  });

  test("project write commands use the selected visible artifact", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.searchQuery = "#";
    palette.prompts = [
      prompt(1),
      context(2),
    ];
    palette.selectedIndex = 0;
    const opened: Array<{ writeKind: string; artifactId: string | null | undefined }> = [];

    runLauncherCommand(
      surface,
      palette,
      {
        id: "export-prompt-project",
        label: "Export Prompt to Project...",
        description: "Preview exact project files before writing.",
      },
      () => undefined,
      () => undefined,
      undefined,
      undefined,
      (writeKind, artifactId) => {
        opened.push({ writeKind, artifactId });
      },
    );

    expect(opened).toEqual([{
      writeKind: "prompt",
      artifactId: "prompt-1",
    }]);
    expect(palette.launcherFeedback).toBeNull();
  });

  test("load artifact commands cannot accidentally prepare skills for delivery", () => {
    const surface = fakeElement();
    const palette = runtime(0);
    palette.prompts = [{
      ...prompt(1),
      id: "diagnose",
      title: "diagnose",
      artifact_type: "skill",
      prompt: "---\nname: diagnose\n---\n\nInspect logs.",
    }];
    let prepared = false;
    let renderCount = 0;

    runLauncherCommand(
      surface,
      palette,
      {
        id: "load-artifact",
        label: "$diagnose",
        description: "diagnose",
        artifactId: "diagnose",
        artifactType: "skill",
      },
      () => {
        renderCount += 1;
      },
      () => {
        prepared = true;
      },
    );

    expect(prepared).toBe(false);
    expect(renderCount).toBe(1);
    expect(palette.launcherFeedback).toEqual({
      message: "Skills open their SKILL.md source and cannot be loaded for delivery.",
      tone: "warning",
    });
  });

  test("skill launcher commands reveal the skill source instead of preparing delivery", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    const originalReveal = native.revealInterventionSource;
    const originalUnload = native.unloadOverlay;
    const revealed: string[] = [];
    let unloaded = 0;
    let prepared = false;

    native.revealInterventionSource = async (artifactId) => {
      revealed.push(artifactId);
    };
    native.unloadOverlay = async () => {
      unloaded += 1;
    };

    try {
      runLauncherCommand(
        surface,
        palette,
        {
          id: "open-skill",
          label: "$diagnose",
          description: "diagnose",
          artifactId: "diagnose",
          artifactType: "skill",
        },
        () => undefined,
        () => {
          prepared = true;
        },
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(revealed).toEqual(["diagnose"]);
      expect(unloaded).toBe(1);
      expect(prepared).toBe(false);
      expect(palette.launcherFeedback).toBeNull();
    } finally {
      native.revealInterventionSource = originalReveal;
      native.unloadOverlay = originalUnload;
    }
  });

  test("skill launcher commands keep Launcher open and report reveal failures inline", async () => {
    const surface = fakeElement();
    const palette = runtime(0);
    const originalReveal = native.revealInterventionSource;
    const originalUnload = native.unloadOverlay;
    let unloaded = 0;
    let prepared = false;
    let renderCount = 0;

    native.revealInterventionSource = async () => {
      throw new Error("SKILL.md could not be revealed");
    };
    native.unloadOverlay = async () => {
      unloaded += 1;
    };

    try {
      runLauncherCommand(
        surface,
        palette,
        {
          id: "open-skill",
          label: "$diagnose",
          description: "diagnose",
          artifactId: "diagnose",
          artifactType: "skill",
        },
        () => {
          renderCount += 1;
        },
        () => {
          prepared = true;
        },
      );
      await Promise.resolve();
      await Promise.resolve();

      expect(unloaded).toBe(0);
      expect(prepared).toBe(false);
      expect(renderCount).toBe(1);
      expect(palette.launcherFeedback).toEqual({
        message: "SKILL.md could not be revealed",
        tone: "warning",
      });
    } finally {
      native.revealInterventionSource = originalReveal;
      native.unloadOverlay = originalUnload;
    }
  });
});

function commandById(commands: LauncherCommand[], id: LauncherCommand["id"]) {
  const command = commands.find((entry) => entry.id === id);
  expect(command).toBeDefined();
  return command!;
}

function projectArtifactPreview(
  artifactId: string,
  writeKind: ProjectArtifactWriteKind,
  targetDirectory: string,
  overwrite: boolean,
  options: { blocked?: boolean } = {},
): ProjectArtifactWritePreview {
  const blocked = options.blocked ?? false;
  return {
    artifact_id: artifactId,
    artifact_type: writeKind === "context"
      ? "context"
      : writeKind === "skill"
      ? "skill"
      : "prompt",
    write_kind: writeKind,
    target_directory: targetDirectory,
    files: [{
      relative_path: `.ult/${writeKind}s/${artifactId}/PROMPT.md`,
      path: `${targetDirectory}/.ult/${writeKind}s/${artifactId}/PROMPT.md`,
      exists: blocked,
      action: blocked ? "blocked" : overwrite ? "overwrite" : "create",
    }],
    requires_overwrite_confirmation: blocked,
    ready_to_write: !blocked,
  };
}

function projectSetupPreview(
  targets: ProjectSetupWriteTarget[],
  targetDirectory: string,
  planHash: string,
): ProjectSetupPreview {
  return {
    target_directory: targetDirectory,
    plan_hash: planHash,
    requires_overwrite_confirmation: false,
    ready_to_write: true,
    entries: targets.map((target) => ({
      ...target,
      error: null,
      preview: projectArtifactPreview(
        target.artifact_id,
        target.write_kind,
        targetDirectory,
        false,
      ),
    })),
  };
}

function projectSetupResult(
  targets: ProjectSetupWriteTarget[],
  targetDirectory: string,
  planHash: string,
): ProjectSetupResult {
  const entries = targets.map((target) => {
    const file = {
      relative_path: `.ult/${target.write_kind}s/${target.artifact_id}/PROMPT.md`,
      path: `${targetDirectory}/.ult/${target.write_kind}s/${target.artifact_id}/PROMPT.md`,
      exists: false,
      action: "create" as const,
    };
    return {
      ...target,
      files: [file],
      error: null,
      result: {
        artifact_id: target.artifact_id,
        write_kind: target.write_kind,
        target_directory: targetDirectory,
        written_files: [file.path],
      },
    };
  });
  return {
    target_directory: targetDirectory,
    plan_hash: planHash,
    entries,
    written_files: entries.flatMap((entry) => entry.result.written_files),
    failed_files: [],
    ok: true,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function installClipboardWriter(writeText: (text: string) => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText } },
  });
  return () => {
    if (previous) {
      Object.defineProperty(globalThis, "navigator", previous);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  };
}
