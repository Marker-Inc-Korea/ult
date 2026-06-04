import "../../src/styles.css";

import { applyAppearance, type AppAppearance } from "../../src/theme";
import {
  createPromptPaletteRuntime,
  positionPromptPalette,
  setPromptPaletteActiveState,
  setPromptPaletteLoadedState,
  setPromptPaletteOverlayMode,
  setPromptPaletteScratchText,
  setPromptPaletteSearchQuery,
  setPromptPaletteTemplateState,
  type PromptPaletteRuntime,
} from "../../src/paletteRuntime";
import { renderPromptPalette, type PaletteRenderActions } from "../../src/paletteRenderers";
import { setPromptPaletteTemplateDynamicEnumResult } from "../../src/overlay/launcher/templateState";
import { renderSettingsWindow } from "../../src/windows/settingsWindow";
import type {
  AccessibilityStatus,
  AppDiagnostics,
  AppSettings,
  DeliveryMode,
  DynamicEnumResolveResult,
  MetaPromptingSettings,
  PromptDefinition,
  PromptLoadResult,
  PromptRegistryEntry,
  UserLauncherCommandDefinition,
  UsageHistoryEntry,
} from "../../src/types";

type VisualSurface =
  | "settings-general"
  | "launcher-empty"
  | "launcher-search"
  | "launcher-library"
  | "launcher-library-prompts"
  | "launcher-library-contexts"
  | "launcher-library-skills"
  | "launcher-library-long"
  | "launcher-library-dense-skills"
  | "launcher-library-issues"
  | "launcher-mixed-search"
  | "launcher-long-search"
  | "launcher-sparse-command-search"
  | "launcher-long-command-search"
  | "launcher-reader"
  | "launcher-actions"
  | "launcher-composer"
  | "launcher-starter-packs"
  | "launcher-github-import"
  | "launcher-project-setup"
  | "launcher-project-write"
  | "launcher-recovery"
  | "launcher-workflow-input"
  | "launcher-scratch"
  | "launcher-variables"
  | "launcher-stack"
  | "palette-picker"
  | "palette-picker-long"
  | "loaded"
  | "loaded-ready"
  | "loaded-context"
  | "loaded-copy"
  | "loaded-long";

const params = new URL(window.location.href).searchParams;
const surface = (params.get("surface") ?? "launcher-search") as VisualSurface;
const theme = (params.get("theme") ?? "light") as AppAppearance;

installHarnessStyles();
installNativeMock(theme);
applyAppearance(theme);

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Visual harness root is missing");

await renderVisualSurface(root, surface);
document.body.dataset.visualReady = "true";

async function renderVisualSurface(rootElement: HTMLElement, visualSurface: VisualSurface) {
  document.documentElement.dataset.visualSurface = visualSurface;
  if (visualSurface === "settings-general") {
    document.documentElement.dataset.windowRole = "settings";
    await renderSettingsWindow(rootElement, "general");
    return;
  }

  document.documentElement.dataset.windowRole = "palette";
  rootElement.replaceChildren(createPaletteVisualSurface(visualSurface));
}

function createPaletteVisualSurface(visualSurface: VisualSurface) {
  const surfaceElement = document.createElement("main");
  surfaceElement.className = "palette-overlay is-idle-mode";
  const palette = createPromptPaletteRuntime(
    visualArtifacts(),
    visualSettings(theme),
    visualAccessibility(),
    visualHistory(),
  );
  const actions = visualActions(surfaceElement, palette);

  if (visualSurface === "palette-picker") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "palette");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.selectedIndex = 1;
    palette.x = 540;
    palette.y = 260;
  } else if (visualSurface === "palette-picker-long") {
    palette.prompts = [
      prompt(
        "internationalization-review-guardrail-long-handle",
        "국제화 회귀 검토와 accessibility fallback policy before release candidate",
        "Long Korean and English title for cursor Palette overflow coverage.",
        true,
      ),
      ...palette.prompts,
      {
        ...context(
          "repo-policy-pinned-but-not-palette",
          "Pinned Context Should Not Render",
          "Pinned contexts stay out of the quick Palette.",
        ),
        pinned: true,
      },
      {
        ...skill(
          "skill-pinned-but-not-palette",
          "Pinned Skill Should Not Render",
          "Pinned skills stay out of the quick Palette.",
        ),
        pinned: true,
      },
    ];
    setPromptPaletteOverlayMode(surfaceElement, palette, "palette");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.selectedIndex = 0;
    palette.x = 540;
    palette.y = 260;
  } else if (visualSurface === "launcher-empty") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-search") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    setPromptPaletteSearchQuery(palette, "#review");
  } else if (visualSurface === "launcher-library") {
    palette.prompts = [
      ...palette.prompts,
      skill("diagnose", "Diagnose", "Inspect agent failures with a repeatable local workflow."),
    ];
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "library");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-library-prompts") {
    palette.prompts = [
      ...palette.prompts,
      prompt("release-retro", "Release Retro", "Summarize release risk and follow-up checks.", false),
    ];
    palette.launcherLibraryFilter = "prompts";
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "library");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-library-contexts") {
    palette.launcherLibraryFilter = "contexts";
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "library");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-library-skills") {
    palette.prompts = [
      ...palette.prompts,
      skill("diagnose", "Diagnose", "Inspect agent failures with a repeatable local workflow."),
      skill("review-pr", "Review PR", "Check pull requests using local engineering policy."),
    ];
    palette.launcherLibraryFilter = "skills";
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "library");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-library-long") {
    palette.prompts = [
      prompt(
        "internationalization-review-guardrail-long-handle",
        "국제화 회귀 검토와 accessibility fallback policy before release candidate",
        "Long Korean and English prompt title for Library row overflow coverage.",
        true,
      ),
      context(
        "repository-policy-for-terminal-agent-workflows-long-handle",
        "터미널 에이전트 정책과 native delivery privacy boundary",
        "Long Korean and English context title for Library row overflow coverage.",
      ),
      skill(
        "diagnose-agent-loop-with-long-bilingual-handle",
        "에이전트 루프 진단 and recovery checklist before handoff",
        "Long Korean and English skill title for Library row overflow coverage.",
      ),
    ];
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "library");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-library-dense-skills") {
    palette.prompts = [
      skill("diagnose", "Diagnose", "Inspect agent failures with a repeatable local workflow."),
      skill("review-pr", "Review PR", "Check pull requests using local engineering policy."),
      skill("fix-ci", "Fix CI", "Turn failing test output into a focused repair loop."),
      skill("write-prd", "Write PRD", "Draft product requirements from explicit notes."),
      skill("release-prep", "Release Prep", "Coordinate release checklist prompts and contexts."),
      skill("incident-review", "Incident Review", "Structure post-incident debugging notes."),
      skill("migration-plan", "Migration Plan", "Plan a staged migration with validation gates."),
      skill("design-audit", "Design Audit", "Review UI changes against the local design system."),
    ];
    palette.launcherLibraryFilter = "skills";
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "library");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-library-issues") {
    palette.prompts = [
      {
        ...prompt(
          "review-change",
          "Review Change",
          "Review with explicit local policy context.",
          true,
        ),
        contexts: ["repo-policy"],
      },
      context("repo-policy", "Repo Policy", "Local engineering rules and validation requirements."),
      skill("diagnose", "Diagnose", "Inspect agent failures with a repeatable local workflow."),
    ];
    palette.userCommands = [
      userCommand(
        "review-with-policy",
        "Review With Policy",
        "Prepare Review Change with local policy context.",
        "review-change",
        ["repo-policy"],
      ),
      userCommand(
        "review-missing-context",
        "Review Missing Context",
        "Shows missing context dependency recovery metadata.",
        "review-change",
        ["missing-context"],
      ),
    ];
    palette.launcherLibraryDiagnostics = [{
      severity: "error",
      message: "Malformed package persistent/prompts/broken/PROMPT.md: missing title",
    }];
    palette.launcherLibrarySort = "issues";
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "library");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "launcher-mixed-search") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    setPromptPaletteSearchQuery(palette, "project #review");
  } else if (visualSurface === "launcher-long-search") {
    palette.prompts = [
      ...palette.prompts,
      prompt(
        "internationalization-review-guardrail-long-handle",
        "국제화 회귀 검토와 accessibility fallback policy before release candidate",
        "Long Korean and English title for row overflow coverage.",
        true,
      ),
    ];
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    setPromptPaletteSearchQuery(palette, "#국제화");
  } else if (visualSurface === "launcher-sparse-command-search") {
    palette.userCommands = [
      userCommand(
        "sparse-only-command",
        "Sparse Result Command",
        "Single command result for compact Launcher Search coverage.",
        "review-change",
        [],
        ["sparse-only"],
        ["sparse-only"],
      ),
    ];
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    setPromptPaletteSearchQuery(palette, "/sparse-only");
  } else if (visualSurface === "launcher-long-command-search") {
    palette.prompts = [
      ...palette.prompts,
      prompt(
        "workflow-review-current-change",
        "Workflow Review Prompt",
        "Editable workflow prompt fixture for command row visual coverage.",
        false,
      ),
    ];
    palette.userCommands = [
      userCommand(
        "workflow-review-current-change",
        "국제화 워크플로우 검토 and release candidate handoff review before native delivery",
        "Editable workflow command row with long bilingual metadata.",
        "workflow-review-current-change",
        [],
        ["국제화", "workflow", "release candidate"],
        ["국제화 워크플로우"],
      ),
      userCommand(
        "review-bilingual-release-candidate",
        "릴리즈 후보 검토 and long command metadata alignment check",
        "Custom command row with long bilingual title.",
        "review-change",
        ["repo-policy"],
        ["국제화", "release", "command"],
        ["긴 커맨드"],
      ),
    ];
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    setPromptPaletteSearchQuery(palette, "/국제화");
  } else if (visualSurface === "launcher-reader") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = { mode: "reader", artifactId: "review-change" };
  } else if (visualSurface === "launcher-actions") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = { mode: "actions", artifactId: "review-change" };
  } else if (visualSurface === "launcher-composer") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = {
      mode: "composer",
      kind: "edit",
      artifactType: "prompt",
      artifactId: "deploy-check",
    };
  } else if (visualSurface === "launcher-github-import") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = {
      mode: "github-import",
      status: "preview",
      url: "https://github.com/taeha/ult-pack",
      reference: "main",
      selectedPaths: [
        "persistent/prompts/review-change/PROMPT.md",
        "persistent/contexts/repo-policy/CONTEXT.md",
      ],
      preview: {
        owner: "taeha",
        repo: "ult-pack",
        requested_ref: "main",
        resolved_ref: "main",
        commit: "1234567890abcdef1234567890abcdef12345678",
        source_url: "https://github.com/taeha/ult-pack/tree/1234567890abcdef1234567890abcdef12345678",
        entries: [{
          artifact_id: "review-change",
          artifact_type: "prompt",
          title: "Review Change",
          source_path: "persistent/prompts/review-change/PROMPT.md",
          target_path: "/Users/taeha/.ult/personal-library/persistent/prompts/review-change/PROMPT.md",
          action: "new",
          diagnostics: [],
        }, {
          artifact_id: "repo-policy",
          artifact_type: "context",
          title: "Repo Policy",
          source_path: "persistent/contexts/repo-policy/CONTEXT.md",
          target_path: "/Users/taeha/.ult/personal-library/persistent/contexts/repo-policy/CONTEXT.md",
          action: "overwrite",
          diagnostics: [],
        }],
        ignored_files: [{ path: "README.md", reason: "not an Ult package" }],
        malformed_packages: [{ path: "persistent/prompts/broken/PROMPT.md", reason: "missing title" }],
        warnings: [],
      },
    };
  } else if (visualSurface === "launcher-starter-packs") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = {
      mode: "starter-packs",
      selectedPackId: "agent-control",
    };
  } else if (visualSurface === "launcher-project-write") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = {
      mode: "project-write",
      status: "preview",
      artifactId: "review-change",
      writeKind: "prompt",
      targetDirectory: "/Users/taeha/Workspace/ult",
      overwrite: false,
      preview: {
        artifact_id: "review-change",
        artifact_type: "prompt",
        write_kind: "prompt",
        target_directory: "/Users/taeha/Workspace/ult",
        ready_to_write: false,
        requires_overwrite_confirmation: true,
        files: [{
          relative_path: ".ult/prompts/review-change/PROMPT.md",
          path: "/Users/taeha/Workspace/ult/.ult/prompts/review-change/PROMPT.md",
          exists: true,
          action: "blocked",
        }],
      },
    };
  } else if (visualSurface === "launcher-project-setup") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = {
      mode: "project-setup",
      status: "preview",
      targetDirectory: "/Users/taeha/Workspace/ult",
      selectedArtifactIds: ["review-change", "repo-policy"],
      includeAgentsSnippet: true,
      agentsSnippetArtifactId: "review-change",
      overwrite: false,
      preview: {
        targetDirectory: "/Users/taeha/Workspace/ult",
        requiresOverwriteConfirmation: true,
        readyToWrite: false,
        planHash: "visual-project-setup-plan",
        entries: [{
          artifactId: "review-change",
          writeKind: "prompt",
          error: null,
          preview: {
            artifact_id: "review-change",
            artifact_type: "prompt",
            write_kind: "prompt",
            target_directory: "/Users/taeha/Workspace/ult",
            ready_to_write: false,
            requires_overwrite_confirmation: true,
            files: [{
              relative_path: ".ult/prompts/review-change/PROMPT.md",
              path: "/Users/taeha/Workspace/ult/.ult/prompts/review-change/PROMPT.md",
              exists: true,
              action: "blocked",
            }],
          },
        }, {
          artifactId: "repo-policy",
          writeKind: "context",
          error: null,
          preview: {
            artifact_id: "repo-policy",
            artifact_type: "context",
            write_kind: "context",
            target_directory: "/Users/taeha/Workspace/ult",
            ready_to_write: true,
            requires_overwrite_confirmation: false,
            files: [{
              relative_path: ".ult/contexts/repo-policy/CONTEXT.md",
              path: "/Users/taeha/Workspace/ult/.ult/contexts/repo-policy/CONTEXT.md",
              exists: false,
              action: "create",
            }],
          },
        }, {
          artifactId: "review-change",
          writeKind: "agents-snippet",
          error: null,
          preview: {
            artifact_id: "review-change",
            artifact_type: "prompt",
            write_kind: "agents-snippet",
            target_directory: "/Users/taeha/Workspace/ult",
            ready_to_write: true,
            requires_overwrite_confirmation: false,
            files: [{
              relative_path: "AGENTS.md",
              path: "/Users/taeha/Workspace/ult/AGENTS.md",
              exists: false,
              action: "create",
            }],
          },
        }],
      },
      error: null,
      result: null,
    };
  } else if (visualSurface === "launcher-workflow-input") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = {
      mode: "workflow-input",
      status: "form",
      commandId: "workflow-fix-failing-tests",
      inputText: "bun test tests/frontend/paletteRuntimeCommandFlows.test.ts\n\nExpected one saved context, received none.",
      contextHandleText: "@repo-policy",
      error: null,
    };
  } else if (visualSurface === "launcher-recovery") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    palette.launcherArtifactPanel = {
      mode: "recovery",
      status: "ready",
      entry: {
        timestamp_ms: 1_700_000_000_000,
        prompt_id: "review-change",
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
  } else if (visualSurface === "launcher-scratch") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "scratch");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    setPromptPaletteScratchText(
      palette,
      "Review the current diff, identify risky assumptions, and run the smallest useful verification before editing more code.",
    );
  } else if (visualSurface === "launcher-variables") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "search");
    setPromptPaletteActiveState(surfaceElement, palette, true);
    setPromptPaletteTemplateState(surfaceElement, palette, "deploy-check", ["repo-policy"]);
    palette.templateValues.branch = "@repo-policy";
    setPromptPaletteTemplateDynamicEnumResult(palette, "target", ["staging", "production"], null);
  } else if (visualSurface === "launcher-stack") {
    setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "stack");
    setPromptPaletteActiveState(surfaceElement, palette, true);
  } else if (visualSurface === "loaded" || visualSurface === "loaded-ready") {
    palette.x = 520;
    palette.y = 260;
    setPromptPaletteLoadedState(surfaceElement, palette, {
      promptId: "review-change",
      promptKind: "local",
      label: "Review Change",
      artifactHandle: "#review-change",
      deliveryMode: "send",
      text: "Review the current change.",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
      templateValueLabels: [],
    });
  } else if (visualSurface === "loaded-context") {
    palette.x = 520;
    palette.y = 260;
    setPromptPaletteLoadedState(surfaceElement, palette, {
      promptId: "review-change",
      promptKind: "local",
      label: "Review Change",
      artifactHandle: "#review-change",
      deliveryMode: "send",
      text: "Review the current change.",
      contextTitles: ["Repo Policy"],
      contextHandles: ["@repo-policy"],
      unresolvedVariables: [],
      templateValueLabels: ["@repo-policy"],
    });
  } else if (visualSurface === "loaded-copy") {
    palette.x = 520;
    palette.y = 260;
    setPromptPaletteLoadedState(surfaceElement, palette, {
      promptId: "review-change",
      promptKind: "local",
      label: "Review Change",
      artifactHandle: "#review-change",
      deliveryMode: "copy",
      text: "Review the current change.",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
      templateValueLabels: [],
    });
  } else if (visualSurface === "loaded-long") {
    palette.x = 520;
    palette.y = 260;
    setPromptPaletteLoadedState(surfaceElement, palette, {
      promptId: "internationalization-review-guardrail-long-handle",
      promptKind: "local",
      label: "국제화 회귀 검토와 accessibility fallback policy before release candidate",
      artifactHandle: "#internationalization-review-guardrail-long-handle",
      deliveryMode: "interrupt-send",
      text: "Review the current change.",
      contextTitles: ["Repo Policy", "Accessibility Notes", "Release Checklist"],
      contextHandles: ["@repo-policy", "@accessibility-notes", "@release-checklist"],
      unresolvedVariables: [],
      templateValueLabels: ["@repo-policy"],
    });
  }

  renderPromptPalette(palette, actions);
  positionPromptPalette(palette);
  surfaceElement.append(palette.container, palette.badge);
  return surfaceElement;
}

function visualActions(
  surfaceElement: HTMLElement,
  palette: PromptPaletteRuntime,
): PaletteRenderActions {
  const rerender = () => {
    renderPromptPalette(palette, actions);
    positionPromptPalette(palette);
  };
  const actions: PaletteRenderActions = {
    loadSelected: () => undefined,
    applySearchComposer: () => undefined,
    selectAndLoad: () => undefined,
    selectDelta: (delta) => {
      palette.selectedIndex = Math.max(0, Math.min(palette.prompts.length - 1, palette.selectedIndex + delta));
      rerender();
    },
    selectLauncherCommandDelta: (delta, count) => {
      if (count <= 0) return;
      palette.launcherCommandIndex = (palette.launcherCommandIndex + delta + count) % count;
      rerender();
    },
    selectPanelActionDelta: (delta, count) => {
      if (count <= 0) return;
      palette.launcherPanelActionIndex = (palette.launcherPanelActionIndex + delta + count) % count;
      rerender();
    },
    runLauncherCommand: () => undefined,
    copyLauncherCommandHandle: () => undefined,
    openArtifactReader: () => undefined,
    openArtifactActions: () => undefined,
    openArtifactComposer: () => undefined,
    openArtifactDelete: () => undefined,
    openProjectArtifactWrite: () => undefined,
    openProjectSetup: () => undefined,
    closeArtifactPanel: () => undefined,
    runArtifactAction: () => undefined,
    runRecoveryAction: () => undefined,
    saveArtifactDraft: async () => undefined,
    deleteArtifact: async () => undefined,
    openStarterPacks: () => undefined,
    openGitHubImport: () => undefined,
    previewGitHubImport: async () => undefined,
    importGitHubPackages: async () => undefined,
    previewProjectArtifactWrite: async () => undefined,
    writeProjectArtifact: async () => undefined,
    previewProjectSetup: async () => undefined,
    writeProjectSetup: async () => undefined,
    submitWorkflowInput: async () => undefined,
    openContextStack: () => {
      setPromptPaletteOverlayMode(surfaceElement, palette, "launcher", "stack");
      rerender();
    },
    selectContextPickerDelta: () => undefined,
    selectPageDelta: () => undefined,
    submitTemplate: () => undefined,
    cancelTemplate: () => undefined,
    resolveTemplateVariable: () => undefined,
    updateTemplateValue: (variable, value) => {
      palette.templateValues[variable] = value;
    },
    updateSearchQuery: (query) => {
      setPromptPaletteSearchQuery(palette, query);
      rerender();
    },
    setLibraryFilter: (filter) => {
      palette.launcherLibraryFilter = filter;
      palette.launcherCommandIndex = 0;
      rerender();
    },
    updateLibraryQuery: (query) => {
      palette.launcherLibraryQuery = query;
      palette.launcherCommandIndex = 0;
      rerender();
    },
    setLibrarySort: (sort) => {
      palette.launcherLibrarySort = sort;
      palette.launcherCommandIndex = 0;
      rerender();
    },
    removeSearchHandle: () => undefined,
    updateScratchText: (text) => {
      setPromptPaletteScratchText(palette, text);
    },
    updateLoadedDeliveryMode: (mode: DeliveryMode) => {
      if (!palette.preparedExecution) return;
      palette.preparedExecution = {
        ...palette.preparedExecution,
        deliveryMode: mode,
      };
      rerender();
    },
    refineScratch: () => undefined,
    acceptScratchRefinement: () => undefined,
    restoreScratchOriginal: () => undefined,
    submitScratch: () => undefined,
    cancelScratch: () => undefined,
    applyLoaded: () => undefined,
    applyContextPicker: () => undefined,
    unload: () => undefined,
    rerender,
  };
  surfaceElement.dataset.visualActions = "ready";
  return actions;
}

function installNativeMock(appearance: AppAppearance) {
  window.__TAURI_INTERNALS__ = {
    invoke: async <T,>(command: string, payload?: Record<string, unknown>): Promise<T> => {
      switch (command) {
        case "window_label":
          return "settings" as T;
        case "load_app_settings":
        case "set_palette_visible_count":
        case "set_appearance":
        case "set_launch_at_login":
          return visualSettings(appearance) as T;
        case "load_intervention_library":
        case "reload_intervention_library":
          return visualLibrary() as T;
        case "load_meta_prompting_settings":
          return visualMetaPrompting() as T;
        case "accessibility_status":
          return visualAccessibility() as T;
        case "load_app_diagnostics":
          return visualDiagnostics() as T;
        case "load_usage_history":
          return visualHistory() as T;
        case "consume_pending_preferences_route":
          return null as T;
        case "palette_selected_artifact_id":
          return "review-change" as T;
        case "update_intervention_artifact":
        case "add_intervention_artifact":
        case "delete_intervention_artifact":
          return visualLibrary() as T;
        case "resolve_dynamic_enum_argument":
          return visualDynamicEnum(payload?.argumentName as string | undefined) as T;
        default:
          return undefined as T;
      }
    },
  };
}

function visualSettings(appearance: AppAppearance): AppSettings {
  return {
    appearance,
    palette_visible_count: 5,
    pinned_artifact_ids: ["scope-lock", "review-change", "qa"],
    launch_at_login: false,
    project_metadata_enabled: false,
    open_palette_shortcut: "Cmd+U",
    search_shortcut: "Option+Space",
    scratch_prompt_shortcut: "Cmd+Option+Control+S",
    meta_prompting_enabled: true,
    meta_prompting_provider: "openai",
    meta_prompting_model: "gpt-5-mini",
    meta_prompting_template: "Rewrite for a coding agent: {input}",
  };
}

function visualLibrary(): PromptLoadResult {
  const artifacts = visualArtifacts();
  return {
    artifacts,
    entries: artifacts.map(visualRegistryEntry),
    config_path: "/Users/taeha/.ult/personal-library",
    registry_path: "/Users/taeha/.ult/personal-library",
    editable_artifact_ids: artifacts.map((artifact) => artifact.id),
    errors: [
      "/Users/taeha/.ult/personal-library/persistent/prompts/broken/PROMPT.md: invalid markdown front matter: expected table",
    ],
    warnings: [],
  };
}

function visualRegistryEntry(prompt: PromptDefinition): PromptRegistryEntry {
  const scope = prompt.scope ?? "persistent";
  const sourcePath = prompt.artifact_type === "skill"
    ? `/Users/taeha/.ult/personal-library/persistent/skills/${prompt.id}/SKILL.md`
    : prompt.artifact_type === "context"
    ? `/Users/taeha/.ult/personal-library/${scope}/contexts/${prompt.id}/CONTEXT.md`
    : `/Users/taeha/.ult/personal-library/${scope}/prompts/${prompt.id}/PROMPT.md`;
  return {
    prompt,
    source: "local-file",
    source_path: sourcePath,
    source_created_ms: null,
    source_modified_ms: null,
    editable: true,
    template_variables: prompt.template_variables ?? [],
    diagnostics: [],
  };
}

function visualArtifacts(): PromptDefinition[] {
  const now = Date.now();
  return [
    prompt("scope-lock", "Scope Lock", "Constrain the agent to the requested scope before it makes broad edits.", true),
    prompt(
      "review-change",
      "Review Change",
      "Inspect the current diff for regressions, missing tests, risky assumptions, and user-facing behavior changes.",
      true,
    ),
    prompt("qa", "QA", "Run focused verification and report the exact command output.", true),
    {
      ...prompt(
        "deploy-check",
        "Deploy Check",
        "Collect branch, target, and policy context before touching deployment code.",
        false,
      ),
      prompt: "Check {{branch}} against {{target}} using {{policy}}.",
      template_variables: ["branch", "target", "policy"],
      template_arguments: [
        {
          name: "branch",
          description: "Branch or @context",
          default_value: "",
          value_type: "text",
        },
        {
          name: "target",
          description: "Deployment target",
          default_value: "staging",
          value_type: "enum",
          enum_source: "static",
          enum_values: ["staging", "production"],
        },
        {
          name: "policy",
          description: "Policy context",
          default_value: "@repo-policy",
          value_type: "text",
        },
      ],
    },
    {
      ...prompt(
        "75ac6db",
        "Review auth redirect race condition and document the smallest safe patch before implementing.",
        "Scratch prompt preview that should wrap naturally in Personal Library instead of clipping.",
        false,
      ),
      scope: "ephemeral",
      source: "scratch",
      created_at: now - 30_000,
      expires_at: now + 7 * 24 * 60 * 60 * 1000,
    },
    context("repo-policy", "Repo Policy", "Local engineering rules and validation requirements."),
    {
      ...context(
        "89abcde",
        "Liquid Glass Effect",
        "Copied context kept for temporary reuse.",
      ),
      scope: "ephemeral",
      source: "clipboard",
      created_at: now - 15_000,
      expires_at: now + 7 * 24 * 60 * 60 * 1000,
    },
  ];
}

function prompt(
  id: string,
  title: string,
  description: string,
  pinned: boolean,
): PromptDefinition {
  return {
    id,
    title,
    artifact_type: "prompt",
    scope: "persistent",
    pinned,
    description,
    prompt: `Use ${title} to guide the coding agent.`,
    contexts: [],
    shortcut: null,
    confirm: false,
    template_arguments: [],
    source: "user",
  };
}

function context(id: string, title: string, description: string): PromptDefinition {
  return {
    id,
    title,
    artifact_type: "context",
    scope: "persistent",
    pinned: false,
    description,
    prompt: `${title}\n\n${description}`,
    contexts: [],
    shortcut: null,
    confirm: false,
    template_arguments: [],
    source: "user",
  };
}

function skill(id: string, title: string, description: string): PromptDefinition {
  return {
    id,
    title,
    artifact_type: "skill",
    scope: "persistent",
    pinned: false,
    description,
    prompt: `---\nname: ${id}\ndescription: ${description}\n---\n\nUse ${title}.`,
    contexts: [],
    shortcut: null,
    confirm: false,
    template_arguments: [],
    source: "user",
    registry_source: "local-file",
    registry_source_path: `/Users/taeha/.ult/personal-library/persistent/skills/${id}/SKILL.md`,
    registry_editable: true,
  };
}

function userCommand(
  id: string,
  title: string,
  description: string,
  promptId: string,
  contexts: string[],
  keywords: string[] = [],
  aliases: string[] = [],
): UserLauncherCommandDefinition {
  return {
    id,
    title,
    description,
    prompt_id: promptId,
    contexts,
    variable_values: {},
    keywords,
    aliases,
    actions: ["prepare"],
    home: false,
    source_path: `/Users/taeha/.ult/personal-library/persistent/commands/${id}/COMMAND.md`,
  };
}

function visualMetaPrompting(): MetaPromptingSettings {
  return {
    enabled: true,
    provider: "openai",
    api_key: "",
    model: "gpt-5-mini",
    template: "Rewrite for a coding agent: {input}",
  };
}

function visualAccessibility(): AccessibilityStatus {
  return {
    platform: "macos",
    trusted: false,
    required_for_native_delivery: true,
  };
}

function visualDiagnostics(): AppDiagnostics {
  return {
    app_version: "0.1.0",
    config_path: "/Users/taeha/Library/Application Support/engineer.ultra.ult",
    accessibility: visualAccessibility(),
    app_identity: {
      bundle_identifier: "engineer.ultra.ult",
      running_path: "/Applications/Ult.app",
      launch_kind: "release",
      signing_status: "developer-id",
      accessibility_identity_note: "Visual harness fixture.",
      stale_permission_reset_command: "tccutil reset Accessibility engineer.ultra.ult",
    },
    overlay_coordinates: {
      cursor_physical_position: "520,260",
      active_display_name: "Built-in Retina Display",
      active_display_physical_bounds: "0,0 2880x1800",
      active_display_scale_factor: "2",
      palette_window_physical_bounds: "0,0 2880x1800",
      webview_pointer_position: "520,260",
    },
    app_shortcuts: [
      "Cmd+U",
      "Option+Space",
      "Cmd+Option+Control+S",
    ],
    last_delivery_result: null,
    recent_history: visualHistory(),
  };
}

function visualHistory(): UsageHistoryEntry[] {
  return [
    {
      timestamp_ms: 1_700_000_000_000,
      prompt_id: "review-change",
      prompt_kind: "local",
      delivery_mode: "send",
      result: "delivered",
      diagnostic_code: null,
      target_application: {
        bundle_id: "com.apple.Terminal",
        name: "Terminal",
      },
    },
  ];
}

function visualDynamicEnum(argumentName = "target"): DynamicEnumResolveResult {
  return {
    argument_name: argumentName,
    ok: true,
    values: ["staging", "production"],
    truncated: false,
    timed_out: false,
    retryable: false,
    error: null,
  };
}

function installHarnessStyles() {
  const style = document.createElement("style");
  style.textContent = `
    * {
      caret-color: transparent !important;
    }

    html,
    body,
    #app {
      min-height: 100%;
    }

    body {
      margin: 0;
      overflow: hidden;
    }

    html[data-visual-surface^="settings"] body {
      overflow: auto;
    }
  `;
  document.head.append(style);
}
