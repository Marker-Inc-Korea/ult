import { renderPromptPalette, type PaletteRenderActions } from "../../../src/paletteRenderers";
import type { PromptPaletteRuntime } from "../../../src/paletteRuntime";
import type { AppSettings, PromptDefinition } from "../../../src/types";
import {
  FakeElement,
  type FakeEvent,
  findAllByClass,
  findAllByTag,
  findByClass,
  findByTag,
  installFakeDom,
  keyEvent,
  textOf,
} from "./fakeDom";

export {
  FakeElement,
  type FakeEvent,
  findAllByClass,
  findAllByTag,
  findByClass,
  findByTag,
  keyEvent,
  renderPromptPalette,
  textOf,
};
export type { PaletteRenderActions, PromptPaletteRuntime, PromptDefinition };

export function prompt(index: number): PromptDefinition {
  return {
    id: `prompt-${index}`,
    title: `Prompt ${index}`,
    pinned: true,
    description: "",
    prompt: `Run prompt ${index}`,
  };
}

export function context(index: number): PromptDefinition {
  return {
    ...prompt(index),
    id: `context-${index}`,
    title: `Context ${index}`,
    artifact_type: "context",
    pinned: false,
    prompt: `Context body ${index}`,
  };
}

const EPHEMERAL_CONTEXT_IDS = ["75ac6db", "89abcde", "c001234", "d00f123"];

export function clipContext(index: number, text: string): PromptDefinition {
  const createdAt = 9_000_000_000_000 + index;
  return {
    id: EPHEMERAL_CONTEXT_IDS[index - 1] ?? `e${index.toString(16).padStart(6, "0")}`,
    title: `Clip ${index}`,
    artifact_type: "context",
    scope: "ephemeral",
    pinned: false,
    description: text,
    prompt: text,
    created_at: createdAt,
    expires_at: createdAt + 7 * 24 * 60 * 60 * 1000,
    source: "clipboard",
  };
}

export function settings(): AppSettings {
  return {
    palette_visible_count: 5,
    pinned_artifact_ids: [],
    launch_at_login: false,
    project_metadata_enabled: false,
    open_palette_shortcut: "Cmd+U",
    search_shortcut: "Option+Space",
    scratch_prompt_shortcut: "Cmd+Option+Control+S",
    meta_prompting_enabled: true,
    meta_prompting_provider: "openai",
    meta_prompting_model: "gpt-5-mini",
    meta_prompting_template: "Rewrite: {input}",
  };
}

export function runtime(): PromptPaletteRuntime {
  const container = new FakeElement("div");
  const badge = new FakeElement("div");
  return {
    container: container as unknown as PromptPaletteRuntime["container"],
    badge: badge as unknown as HTMLDivElement,
    active: true,
    overlayMode: "launcher",
    launcherMode: "scratch",
    surfaceMode: "scratch",
    executionState: "selecting",
    x: 10,
    y: 10,
    searchQuery: "",
    launcherCommandIndex: 0,
    launcherFeedback: null,
    launcherLibraryFilter: "all",
    launcherLibraryQuery: "",
    launcherLibrarySort: "recent",
    launcherLibraryDiagnostics: [],
    launcherArtifactPanel: null,
    launcherPanelActionIndex: 0,
    selectedIndex: 0,
    visibleStart: 0,
    preparedExecution: null,
    templatePromptId: null,
    templateValues: {},
    templateContextIds: [],
    templateReturnLauncherMode: null,
    templateValidationErrors: {},
    templateDynamicEnumValues: {},
    templateDynamicEnumErrors: {},
    templateDynamicEnumLoading: {},
    scratchText: "rough prompt",
    scratchNotice: null,
    scratchMetaConfirmRequired: false,
    scratchMetaConfirmPending: false,
    scratchRefining: false,
    scratchRefineSourceText: null,
    scratchRefineSourceRequiresConfirmation: false,
    scratchRefineResultText: null,
    scratchRefineResultRequiresConfirmation: false,
    scratchRefineApplied: false,
    scratchRefineError: null,
    scratchRefineGeneration: 0,
    ephemeralContextCount: 0,
    contextPickerSelectedIndex: 0,
    clipFeedback: null,
    pendingConfirmPromptId: null,
    prompts: [prompt(0)],
    userCommands: [],
    usageHistory: [],
    appSettings: settings(),
    accessibilityTrusted: true,
    lastDeliveryResult: null,
    deliveryInFlight: false,
    syncGeneration: 0,
    nativeOverlayGeneration: 0,
    positionFrame: null,
    pointerPollTimer: null,
    pointerSyncInFlight: false,
    unlistenNativeEvents: null,
  };
}

export function actions(overrides: Partial<PaletteRenderActions> = {}): PaletteRenderActions {
  return {
    loadSelected: () => undefined,
    applySearchComposer: () => undefined,
    selectAndLoad: () => undefined,
    selectDelta: () => undefined,
    selectLauncherCommandDelta: () => undefined,
    selectPanelActionDelta: () => undefined,
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
    openContextStack: () => undefined,
    selectContextPickerDelta: () => undefined,
    selectPageDelta: () => undefined,
    submitTemplate: () => undefined,
    cancelTemplate: () => undefined,
    resolveTemplateVariable: () => undefined,
    updateTemplateValue: () => undefined,
    updateSearchQuery: () => undefined,
    setLibraryFilter: () => undefined,
    updateLibraryQuery: () => undefined,
    setLibrarySort: () => undefined,
    removeSearchHandle: () => undefined,
    updateScratchText: () => undefined,
    updateLoadedDeliveryMode: () => undefined,
    refineScratch: () => undefined,
    acceptScratchRefinement: () => undefined,
    restoreScratchOriginal: () => undefined,
    submitScratch: () => undefined,
    cancelScratch: () => undefined,
    applyLoaded: () => undefined,
    applyContextPicker: () => undefined,
    unload: () => undefined,
    rerender: () => undefined,
    ...overrides,
  };
}

export function installPaletteRendererDom() {
  installFakeDom({ immediateTimeout: true });
}
