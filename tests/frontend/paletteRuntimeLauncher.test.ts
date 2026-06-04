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
import {
  runLauncherCommand,
  selectedLauncherSearchAction,
} from "../../src/overlay/launcher/searchController";
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
import { launcherRowsForPalette } from "../../src/overlay/launcher/launcherRows";
import {
  collectLauncherIndexedItems,
  launcherRankingTrace,
} from "../../src/overlay/launcher/launcherSearchIndex";
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

describe("palette runtime launcher selection and ranking behavior", () => {
  test("keeps selected prompt visible while clamping selection", () => {
    const palette = runtime(12);

    expect(setPromptPaletteSelectedIndex(palette, 10)).toBe(true);
    expect(palette.selectedIndex).toBe(10);
    expect(palette.visibleStart).toBe(6);
    expect(selectedPrompt(palette).id).toBe("prompt-10");

    expect(setPromptPaletteSelectedIndex(palette, 999)).toBe(true);
    expect(palette.selectedIndex).toBe(11);
    expect(palette.visibleStart).toBe(7);
  });

  test("page navigation advances by visible page size", () => {
    const palette = runtime(20);

    expect(setPromptPalettePageDelta(palette, 1)).toBe(true);
    expect(palette.visibleStart).toBe(PROMPTS_PER_PAGE);
    expect(palette.selectedIndex).toBe(PROMPTS_PER_PAGE);

    expect(setPromptPalettePageDelta(palette, -1)).toBe(true);
    expect(palette.visibleStart).toBe(0);
    expect(palette.selectedIndex).toBe(0);
  });

  test("search query filters persistent prompts and context artifacts", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [
      prompt(1),
      context(2),
      clipContext(1, "Temporary copied context"),
      expiredClipContext(9, "Expired copied context"),
      { ...prompt(3), title: "Test Runner" },
      { ...prompt(4), title: "Ephemeral Test", scope: "ephemeral", pinned: false },
      { ...prompt(5), title: "Test Skill", artifact_type: "skill" },
    ];

    expect(setPromptPaletteSearchQuery(palette, "@")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual([
      "75ac6db",
      "context-2",
    ]);

    expect(setPromptPaletteSearchQuery(palette, "#test")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual(["prompt-3"]);

    expect(setPromptPaletteSearchQuery(palette, "test")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual(["prompt-3"]);

    expect(setPromptPaletteSearchQuery(palette, "@missing")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);
    expect(selectedPrompt(palette)).toBeUndefined();
  });

  test("overlay search matches visible handles and titles only", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [
      {
        ...prompt(1),
        title: "Alpha",
        description: "review summary",
        prompt: "private prompt body",
        contexts: ["attached-context"],
      },
      {
        ...context(2),
        id: "repo-policy",
        title: "Repo Policy",
        description: "guardrail summary",
        prompt: "private context body",
      },
      {
        ...prompt(3),
        title: "Hidden Scope",
        scope: "ephemeral",
        pinned: false,
      },
    ];

    expect(setPromptPaletteSearchQuery(palette, "alpha")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual(["prompt-1"]);

    expect(setPromptPaletteSearchQuery(palette, "#prompt-1")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual(["prompt-1"]);

    expect(setPromptPaletteSearchQuery(palette, "@repo")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual(["repo-policy"]);

    expect(setPromptPaletteSearchQuery(palette, "#summary")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);

    expect(setPromptPaletteSearchQuery(palette, "@summary")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);

    expect(setPromptPaletteSearchQuery(palette, "summary")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);

    expect(setPromptPaletteSearchQuery(palette, "#review")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);

    expect(setPromptPaletteSearchQuery(palette, "#alpha")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual(["prompt-1"]);

    for (const query of ["private", "attached-context", "persistent"]) {
      expect(setPromptPaletteSearchQuery(palette, query)).toBe(true);
      expect(visiblePrompts(palette)).toEqual([]);
    }
  });

  test("overlay search ranks exact handle, prefix, pinned, then fuzzy matches", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [
      { ...prompt(1), id: "alpha-fix", title: "Alpha Fix", pinned: true },
      { ...prompt(2), id: "fix-tests", title: "Runner", pinned: false },
      { ...prompt(3), id: "fix", title: "Other", pinned: false },
      { ...prompt(4), id: "fix-build", title: "Build", pinned: true },
      { ...prompt(5), id: "zeta", title: "Fix Later", pinned: false },
    ];

    expect(setPromptPaletteSearchQuery(palette, "#fix")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual([
      "fix",
      "fix-build",
      "fix-tests",
      "zeta",
      "alpha-fix",
    ]);
  });

  test("launcher namespace search keeps slash commands separate from prompt aliases", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [
      { ...prompt(1), id: "review", title: "Review Prompt", pinned: true },
      { ...context(1), id: "review-context", title: "Review Context" },
      { ...prompt(2), id: "review-scope", title: "Scope Review", pinned: true },
      { ...prompt(3), id: "review-skill", title: "Review Skill", artifact_type: "skill" },
    ];
    palette.userCommands = [{
      id: "review",
      title: "Review",
      description: "Review current change.",
      prompt_id: "review",
      contexts: [],
      variable_values: {},
      keywords: ["review"],
      aliases: [],
      actions: ["prepare"],
      home: true,
    }];

    expect(setPromptPaletteSearchQuery(palette, "#review")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual([
      "review",
      "review-scope",
    ]);

    expect(setPromptPaletteSearchQuery(palette, "@review")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual(["review-context"]);

    expect(setPromptPaletteSearchQuery(palette, "$review")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);
    const skillRows = launcherRowsForPalette(palette).rows;
    expect(skillRows[0]?.kind).toBe("artifact");
    expect(skillRows[0]?.kind === "artifact" ? skillRows[0].prompt.id : null).toBe("review-skill");

    expect(setPromptPaletteSearchQuery(palette, "/review")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);
    const rows = launcherRowsForPalette(palette).rows;
    expect(rows[0]?.kind).toBe("command");
    expect(rows[0]?.command?.id).toBe("user-command");
    expect(rows.some((row) =>
      row.kind === "artifact" && row.prompt.id === "review"
    )).toBe(false);

    palette.userCommands = [];
    expect(setPromptPaletteSearchQuery(palette, "/review-scope")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);
    const commandOnlyRows = launcherRowsForPalette(palette).rows;
    expect(commandOnlyRows[0]?.kind).toBe("command");
    expect(commandOnlyRows[0]?.command?.id).toBe("browse-commands");

    expect(setPromptPaletteSearchQuery(palette, "/missing")).toBe(true);
    expect(visiblePrompts(palette)).toEqual([]);
    const recoveryRows = launcherRowsForPalette(palette).rows;
    expect(recoveryRows[0]?.kind).toBe("command");
    expect(recoveryRows[0]?.command?.id).toBe("browse-commands");
  });

  test("launcher ranking trace explains indexed metadata without private bodies", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.searchQuery = "#review";
    palette.prompts = [
      {
        ...prompt(1),
        id: "review",
        title: "Review",
        description: "private description should stay out",
        prompt: "private prompt body should stay out",
      },
      {
        ...context(1),
        id: "repo-policy",
        title: "Repo Policy",
        prompt: "private context body should stay out",
      },
      {
        ...prompt(2),
        id: "diagnose",
        title: "Diagnose",
        artifact_type: "skill",
        registry_source_path: "/Users/taeha/.ult/private/diagnose/SKILL.md",
        prompt: "private skill source should stay out",
      },
    ];
    palette.userCommands = [{
      id: "review-repo",
      title: "Review Repo",
      description: "Review current change.",
      prompt_id: "review",
      contexts: ["repo-policy"],
      variable_values: {},
      keywords: ["diff"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/private/COMMAND.md",
    }];

    const indexed = collectLauncherIndexedItems(palette);
    expect(indexed.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        "prompt-artifact",
        "context-artifact",
        "skill-package",
        "built-in-command",
        "workflow-command",
        "recovery-system-command",
        "user-defined-command",
      ]),
    );

    const trace = launcherRankingTrace(palette);
    expect(trace.intent).toMatchObject({
      namespace: "prompt",
      term: "review",
      home: false,
    });
    expect(trace.indexedItemTypes["prompt-artifact"]).toBe(1);
    expect(trace.indexedItemTypes["context-artifact"]).toBe(1);
    expect(trace.indexedItemTypes["skill-package"]).toBe(1);
    expect(trace.matches[0]).toMatchObject({
      key: "prompt:review",
      type: "prompt-artifact",
      label: "#review",
      reason: "exact handle",
    });
    const traceText = JSON.stringify(trace);
    expect(traceText).not.toContain("private prompt body");
    expect(traceText).not.toContain("private context body");
    expect(traceText).not.toContain("private skill source");
    expect(traceText).not.toContain("COMMAND.md");
    expect(traceText).not.toContain("SKILL.md");
  });

  test("launcher search index shadows bundled workflow commands with editable local packages", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.searchQuery = "fix failing tests";
    palette.prompts = [{
      ...prompt(7),
      id: "workflow-fix-failing-tests",
      title: "Fix Failing Tests",
      description: "Editable local workflow prompt.",
      prompt: "LOCAL editable workflow prompt.",
    }];
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

    const indexedWorkflowCommands = collectLauncherIndexedItems(palette)
      .filter((item) =>
        "command" in item
        && (
          item.command.id === "workflow-fix-failing-tests"
          || item.command.userCommand?.id === "workflow-fix-failing-tests"
        )
      );
    expect(indexedWorkflowCommands).toHaveLength(1);
    expect(indexedWorkflowCommands[0]).toMatchObject({
      type: "user-defined-command",
      handle: "/workflow-fix-failing-tests",
    });

    const workflowRows = launcherRowsForPalette(palette).rows
      .filter((row) =>
        row.kind === "command"
        && (
          row.command.id === "workflow-fix-failing-tests"
          || row.command.userCommand?.id === "workflow-fix-failing-tests"
        )
      );
    expect(workflowRows).toHaveLength(1);
    expect(workflowRows[0].kind === "command" ? workflowRows[0].command.id : null)
      .toBe("user-command");
  });

  test("launcher search ranks scratch first only for explicit drafting intent", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [{
      ...prompt(1),
      id: "review",
      title: "Review",
    }];

    palette.searchQuery = "review";
    expect(launcherRowsForPalette(palette).rows.some((row) =>
      row.kind === "command" && row.command.id === "compose-scratch"
    )).toBe(false);

    palette.searchQuery = "draft a careful migration note.";
    const rows = launcherRowsForPalette(palette).rows;
    expect(rows[0]?.kind).toBe("command");
    expect(rows[0]?.kind === "command" ? rows[0].command.id : null)
      .toBe("compose-scratch");
  });

  test("selected launcher search action routes namespace handles by row capability", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [
      { ...prompt(1), id: "review", title: "Review Prompt", pinned: true },
      { ...context(1), id: "review-context", title: "Review Context" },
      { ...prompt(2), id: "diagnose", title: "Diagnose Skill", artifact_type: "skill" },
    ];
    palette.userCommands = [{
      id: "review",
      title: "Review",
      description: "Review current change.",
      prompt_id: "review",
      contexts: [],
      variable_values: {},
      keywords: ["review"],
      aliases: [],
      actions: ["prepare"],
      home: true,
    }];

    expect(setPromptPaletteSearchQuery(palette, "#review")).toBe(true);
    let selection = selectedLauncherSearchAction(palette);
    expect(selection.type).toBe("artifact");
    expect(selection.type === "artifact" ? selection.prompt.id : null).toBe("review");

    expect(setPromptPaletteSearchQuery(palette, "@review")).toBe(true);
    selection = selectedLauncherSearchAction(palette);
    expect(selection.type).toBe("artifact");
    expect(selection.type === "artifact" ? selection.prompt.id : null).toBe("review-context");

    expect(setPromptPaletteSearchQuery(palette, "$diagnose")).toBe(true);
    selection = selectedLauncherSearchAction(palette);
    expect(selection.type).toBe("command");
    expect(selection.type === "command" ? selection.command.id : null).toBe("open-skill");
    expect(selection.type === "command" ? selection.command.artifactId : null).toBe("diagnose");

    expect(setPromptPaletteSearchQuery(palette, "/review")).toBe(true);
    selection = selectedLauncherSearchAction(palette);
    expect(selection.type).toBe("command");
    expect(selection.type === "command" ? selection.command.id : null).toBe("user-command");

    expect(setPromptPaletteSearchQuery(palette, "/diagnose")).toBe(true);
    selection = selectedLauncherSearchAction(palette);
    expect(selection.type).toBe("command");
    expect(selection.type === "command" ? selection.command.id : null).not.toBe("open-skill");
    expect(selection.type === "command" ? selection.command.artifactId ?? null : null).not.toBe("diagnose");
  });

  test("empty search does not show default palette artifacts", () => {
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [
      prompt(1),
      context(2),
    ];

    expect(visiblePrompts(palette)).toEqual([]);
    expect(selectedPrompt(palette)).toBeUndefined();
  });

  test("palette shows only pinned persistent prompts independent from search query", () => {
    const palette = runtime(0);
    palette.surfaceMode = "palette";
    palette.prompts = [
      prompt(1),
      context(2),
      { ...prompt(3), title: "Test Runner", pinned: false },
      { ...prompt(4), title: "Ephemeral Runner", scope: "ephemeral", pinned: false },
    ];

    expect(setPromptPaletteSearchQuery(palette, "@prompt-1")).toBe(true);
    expect(visiblePrompts(palette).map((entry) => entry.prompt.id)).toEqual([
      "prompt-1",
    ]);
    expect(selectedPrompt(palette)?.id).toBe("prompt-1");
  });

  test("palette ordering keeps pinned artifacts before usage-ranked artifacts and ignores project-only metadata", () => {
    const prompts = [prompt(1), prompt(2), prompt(3)];
    const ordered = orderPaletteArtifacts(prompts, [
      {
        timestamp_ms: 100,
        prompt_id: "prompt-1",
        delivery_mode: "send",
        result: "delivered",
      },
      {
        timestamp_ms: 200,
        prompt_id: "prompt-1",
        delivery_mode: "send",
        result: "delivered",
      },
      {
        timestamp_ms: 300,
        prompt_id: null,
        delivery_mode: "send",
        result: "delivered",
        project: {
          basename: "ult",
          path_hash: "sha256:test",
        },
      },
    ], ["prompt-3"]);

    expect(ordered.map((entry) => entry.id)).toEqual([
      "prompt-3",
      "prompt-1",
      "prompt-2",
    ]);
  });

  test("loaded state preserves loaded prompt while apply/unload reset execution state", () => {
    const surface = fakeElement();
    const palette = runtime();

    setPromptPaletteActiveState(surface, palette, true);
    expect(palette.surfaceMode).toBe("palette");
    expect(surface.classNames.has("is-palette-mode")).toBe(true);

    setPromptPaletteLoadedState(surface, palette, {
      promptId: "prompt-7",
      promptKind: "bundled",
      label: "Prompt 7",
      artifactHandle: "#prompt-7",
      deliveryMode: "send",
      text: "Run prompt 7",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    });
    expect(palette.surfaceMode).toBe("loaded");
    expect(palette.executionState).toBe("loaded");
    expect(palette.preparedExecution?.promptId).toBe("prompt-7");

    setPromptPaletteSelectedIndex(palette, 2);
    expect(palette.preparedExecution?.promptId).toBe("prompt-7");

    setPromptPaletteApplyingState(surface, palette);
    expect(palette.deliveryInFlight).toBe(true);
    expect(palette.executionState).toBe("applying");
    expect(palette.preparedExecution).toBeNull();

    setPromptPaletteActiveState(surface, palette, false);
    expect(palette.surfaceMode).toBe("idle");
    expect(palette.deliveryInFlight).toBe(false);
  });

  test("active state opens palette even when accessibility is missing", () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.accessibilityTrusted = false;

    setPromptPaletteActiveState(surface, palette, true);

    expect(palette.surfaceMode).toBe("palette");
    expect(surface.classNames.has("is-palette-mode")).toBe(true);
  });

  test("accessibility status refresh keeps overlay on the active product surface", () => {
    const surface = fakeElement();
    const palette = runtime();
    palette.accessibilityTrusted = false;
    setPromptPaletteActiveState(surface, palette, true);

    expect(palette.surfaceMode).toBe("palette");
    expect(palette.executionState).toBe("selecting");

    setPromptPaletteAccessibilityStatus(surface, palette, {
      platform: "macos",
      trusted: true,
      required_for_native_delivery: true,
    });

    expect(palette.surfaceMode).toBe("palette");
    expect(surface.classNames.has("is-palette-mode")).toBe(true);
    expect(palette.executionState).toBe("selecting");
  });

  test("search mode opens a distinct command search surface", () => {
    const palette = runtime();
    const surface = fakeElement();

    setPromptPaletteOverlayMode(surface, palette, "launcher", "search");
    setPromptPaletteActiveState(surface, palette, true);

    expect(palette.surfaceMode).toBe("search");
    expect(palette.overlayMode).toBe("launcher");
    expect(palette.launcherMode).toBe("search");
    expect(surface.classNames.has("is-launcher-mode")).toBe(true);
    expect(surface.classNames.has("is-search-mode")).toBe(true);
    expect(surface.classNames.has("is-palette-mode")).toBe(false);
  });
});
