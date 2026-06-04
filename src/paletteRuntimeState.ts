import type { PreparedPromptExecution } from "./promptExecutor";
import type {
  AppSettings,
  DeliveryResultEvent,
  LauncherMode,
  OverlayMode,
  OverlaySurfaceMode,
  PromptArtifactType,
  PromptDefinition,
  PromptExecutionState,
  ProjectArtifactWriteKind,
  ProjectArtifactWritePreview,
  ProjectArtifactWriteResult,
  UserLauncherCommandDefinition,
  GitHubLibraryImportPreview,
  GitHubLibraryImportResult,
  UsageHistoryEntry,
} from "./types";
import type { ClipFeedbackState } from "./overlay/launcher/ephemeralContextState";
import type {
  ProjectSetupPreview,
  ProjectSetupResult,
} from "./overlay/launcher/projectSetupTypes";
import type { ExternalSkillDiscoveryIntent } from "./data/externalSkillDiscovery";

export type OverlaySessionState = {
  active: boolean;
  overlayMode: OverlayMode;
  launcherMode: LauncherMode | null;
  surfaceMode: OverlaySurfaceMode;
};

export type PointerRuntimeState = {
  x: number;
  y: number;
  positionFrame: number | null;
  pointerPollTimer: number | null;
  pointerSyncInFlight: boolean;
};

export type LauncherFeedback = {
  message: string;
  tone: "neutral" | "warning";
};

export type LauncherArtifactReaderPanel = {
  mode: "reader";
  artifactId: string;
};

export type LauncherArtifactActionsPanel = {
  mode: "actions";
  artifactId: string;
};

export type LauncherArtifactDeletePanel = {
  mode: "delete";
  artifactId: string;
};

export type LauncherArtifactComposerPanel = {
    mode: "composer";
    kind: "new" | "edit" | "duplicate";
    artifactType: PromptArtifactType;
    artifactId?: string | null;
    initialId?: string | null;
};

export type LauncherStarterPacksPanel = {
    mode: "starter-packs";
    selectedPackId: string;
};

export type LauncherSkillDiscoveryPanel = {
    mode: "skill-discovery";
    intent: ExternalSkillDiscoveryIntent;
};

export type LauncherWorkflowInputPanel = {
    mode: "workflow-input";
    status: "form" | "saving";
    commandId: string;
    inputText: string;
    contextHandleText: string;
    error?: string | null;
};

export type LauncherRecoveryPanel = {
    mode: "recovery";
    status: "ready" | "exporting";
    entry: UsageHistoryEntry;
    error?: string | null;
    message?: string | null;
    exportPath?: string | null;
};

export type LauncherGitHubImportPanel = {
    mode: "github-import";
    status: "form" | "previewing" | "preview" | "importing" | "result";
    url: string;
    reference: string | null;
    preview?: GitHubLibraryImportPreview | null;
    selectedPaths?: string[];
    error?: string | null;
    result?: GitHubLibraryImportResult | null;
};

export type LauncherProjectWritePanel = {
    mode: "project-write";
    status: "form" | "previewing" | "preview" | "writing" | "result";
    artifactId: string;
    writeKind: ProjectArtifactWriteKind;
    targetDirectory: string;
    overwrite: boolean;
    preview?: ProjectArtifactWritePreview | null;
    error?: string | null;
    result?: ProjectArtifactWriteResult | null;
};

export type LauncherProjectSetupPanel = {
    mode: "project-setup";
    status: "form" | "previewing" | "preview" | "writing" | "result";
    presetId?: string;
    targetDirectory: string;
    selectedArtifactIds: string[];
    includeAgentsSnippet: boolean;
    agentsSnippetArtifactId: string | null;
    overwrite: boolean;
    preview?: ProjectSetupPreview | null;
    error?: string | null;
    result?: ProjectSetupResult | null;
  };

export type LauncherPanelByMode = {
  reader: LauncherArtifactReaderPanel;
  actions: LauncherArtifactActionsPanel;
  delete: LauncherArtifactDeletePanel;
  composer: LauncherArtifactComposerPanel;
  "starter-packs": LauncherStarterPacksPanel;
  "skill-discovery": LauncherSkillDiscoveryPanel;
  "workflow-input": LauncherWorkflowInputPanel;
  recovery: LauncherRecoveryPanel;
  "github-import": LauncherGitHubImportPanel;
  "project-write": LauncherProjectWritePanel;
  "project-setup": LauncherProjectSetupPanel;
};

export type LauncherPanelMode = keyof LauncherPanelByMode;
export type LauncherArtifactPanel = LauncherPanelByMode[LauncherPanelMode];

export type LauncherSearchState = {
  searchQuery: string;
  launcherCommandIndex: number;
  launcherFeedback: LauncherFeedback | null;
};

export type LauncherLibraryFilter =
  | "all"
  | "prompts"
  | "contexts"
  | "skills"
  | "commands";

export type LauncherLibrarySort =
  | "recent"
  | "updated"
  | "type"
  | "pinned"
  | "issues";

export type LauncherLibraryDiagnostic = {
  severity: "warning" | "error";
  message: string;
};

export type LauncherLibraryState = {
  launcherLibraryFilter: LauncherLibraryFilter;
  launcherLibraryQuery: string;
  launcherLibrarySort: LauncherLibrarySort;
  launcherLibraryDiagnostics: LauncherLibraryDiagnostic[];
};

export type LauncherPanelState = {
  launcherArtifactPanel: LauncherArtifactPanel | null;
  launcherPanelActionIndex: number;
};

export type PaletteSelectionState = {
  selectedIndex: number;
  visibleStart: number;
  pendingConfirmPromptId: string | null;
};

export type DeliveryRuntimeState = {
  executionState: PromptExecutionState;
  preparedExecution: PreparedPromptExecution | null;
  lastDeliveryResult: DeliveryResultEvent | null;
  deliveryInFlight: boolean;
};

export type TemplateRuntimeState = {
  templatePromptId: string | null;
  templateValues: Record<string, string>;
  templateContextIds: string[];
  templateReturnLauncherMode: LauncherMode | null;
  templateValidationErrors: Record<string, string>;
  templateDynamicEnumValues: Record<string, string[]>;
  templateDynamicEnumErrors: Record<string, string>;
  templateDynamicEnumLoading: Record<string, boolean>;
};

export type ScratchRuntimeState = {
  scratchText: string;
  scratchNotice: string | null;
  scratchMetaConfirmRequired: boolean;
  scratchMetaConfirmPending: boolean;
  scratchRefining: boolean;
  scratchRefineSourceText: string | null;
  scratchRefineSourceRequiresConfirmation: boolean;
  scratchRefineResultText: string | null;
  scratchRefineResultRequiresConfirmation: boolean;
  scratchRefineApplied: boolean;
  scratchRefineError: string | null;
  scratchRefineGeneration: number;
};

export type ContextStackRuntimeState = {
  ephemeralContextCount: number;
  contextPickerSelectedIndex: number;
  clipFeedback: ClipFeedbackState | null;
};

export type OverlayDataState = {
  prompts: PromptDefinition[];
  userCommands: UserLauncherCommandDefinition[];
  usageHistory: UsageHistoryEntry[];
  appSettings: AppSettings;
  accessibilityTrusted: boolean | null;
};

export type NativeOverlaySyncState = {
  syncGeneration: number;
  nativeOverlayGeneration: number;
  unlistenNativeEvents: (() => void) | null;
};

export type PromptPaletteRuntimeSessions = {
  overlaySession: OverlaySessionState;
  pointerSession: PointerRuntimeState;
  launcherSearchSession: LauncherSearchState;
  launcherLibrarySession: LauncherLibraryState;
  launcherPanelSession: LauncherPanelState;
  paletteSelectionSession: PaletteSelectionState;
  deliverySession: DeliveryRuntimeState;
  templateSession: TemplateRuntimeState;
  scratchSession: ScratchRuntimeState;
  contextStackSession: ContextStackRuntimeState;
  overlayDataSession: OverlayDataState;
  nativeSyncSession: NativeOverlaySyncState;
};

export type PromptPaletteRuntimeSessionName = keyof PromptPaletteRuntimeSessions;

type UnionToIntersection<Union> =
  (Union extends unknown ? (value: Union) => void : never) extends
    (value: infer Intersection) => void
    ? Intersection
    : never;

export type PromptPaletteRuntimeState = UnionToIntersection<
  PromptPaletteRuntimeSessions[PromptPaletteRuntimeSessionName]
>;

export type PromptPaletteRuntimeTransition =
  | {
    type: "set-active";
    active: boolean;
    inactiveSurfaceMode?: OverlaySurfaceMode;
  }
  | {
    type: "set-overlay-mode";
    mode: OverlayMode;
    launcherMode?: LauncherMode | null;
  }
  | {
    type: "set-applying";
  }
  | {
    type: "set-loaded";
    prepared: PreparedPromptExecution;
  }
  | {
    type: "set-template";
    promptId: string;
    contextIds: string[];
    initialValues: Record<string, string>;
  }
  | {
    type: "clear-template";
  }
  | {
    type: "set-clip-feedback";
  }
  | {
    type: "clear-clip-feedback";
  };

export type PromptPaletteRuntimeTransitionResult = {
  surfaceMode?: OverlaySurfaceMode;
  ensureSelectionVisible?: boolean;
  schedulePosition?: boolean;
  changed: boolean;
};

export function initialOverlaySessionState(): OverlaySessionState {
  return {
    active: false,
    overlayMode: "palette",
    launcherMode: null,
    surfaceMode: "idle",
  };
}

export function initialPointerRuntimeState(): PointerRuntimeState {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    positionFrame: null,
    pointerPollTimer: null,
    pointerSyncInFlight: false,
  };
}

export function initialLauncherSearchState(): LauncherSearchState {
  return {
    searchQuery: "",
    launcherCommandIndex: 0,
    launcherFeedback: null,
  };
}

export function initialLauncherLibraryState(): LauncherLibraryState {
  return {
    launcherLibraryFilter: "all",
    launcherLibraryQuery: "",
    launcherLibrarySort: "recent",
    launcherLibraryDiagnostics: [],
  };
}

export function initialLauncherPanelState(): LauncherPanelState {
  return {
    launcherArtifactPanel: null,
    launcherPanelActionIndex: 0,
  };
}

export function initialPaletteSelectionState(): PaletteSelectionState {
  return {
    selectedIndex: 0,
    visibleStart: 0,
    pendingConfirmPromptId: null,
  };
}

export function initialDeliveryRuntimeState(): DeliveryRuntimeState {
  return {
    executionState: "selecting",
    preparedExecution: null,
    lastDeliveryResult: null,
    deliveryInFlight: false,
  };
}

export function initialTemplateRuntimeState(): TemplateRuntimeState {
  return {
    templatePromptId: null,
    templateValues: {},
    templateContextIds: [],
    templateReturnLauncherMode: null,
    templateValidationErrors: {},
    templateDynamicEnumValues: {},
    templateDynamicEnumErrors: {},
    templateDynamicEnumLoading: {},
  };
}

export function initialScratchRuntimeState(): ScratchRuntimeState {
  return {
    scratchText: "",
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
  };
}

export function initialContextStackRuntimeState(): ContextStackRuntimeState {
  return {
    ephemeralContextCount: 0,
    contextPickerSelectedIndex: 0,
    clipFeedback: null,
  };
}

export function initialNativeOverlaySyncState(): NativeOverlaySyncState {
  return {
    syncGeneration: 0,
    nativeOverlayGeneration: 0,
    unlistenNativeEvents: null,
  };
}

export function resetLauncherSearchState(
  palette: LauncherSearchState & LauncherPanelState & PaletteSelectionState,
  options: {
    clearFeedback?: boolean;
    clearPanel?: boolean;
    resetSelection?: boolean;
  } = {},
) {
  palette.searchQuery = "";
  if (options.resetSelection !== false) {
    palette.launcherCommandIndex = 0;
  }
  if (options.clearFeedback !== false) {
    palette.launcherFeedback = null;
  }
  if (options.clearPanel !== false) {
    palette.launcherArtifactPanel = null;
    palette.launcherPanelActionIndex = 0;
  }
  palette.pendingConfirmPromptId = null;
}

export function resetLauncherLibraryState(
  palette: LauncherLibraryState & LauncherSearchState,
) {
  palette.launcherLibraryFilter = "all";
  palette.launcherCommandIndex = 0;
}

export function resetLauncherPanelState(palette: LauncherPanelState) {
  palette.launcherArtifactPanel = null;
  palette.launcherPanelActionIndex = 0;
}

export function resetTemplateRuntimeState(palette: TemplateRuntimeState) {
  Object.assign(palette, initialTemplateRuntimeState());
}

export function resetScratchRuntimeState(palette: ScratchRuntimeState) {
  Object.assign(palette, initialScratchRuntimeState());
}

export function normalizeOverlaySession(
  mode: OverlayMode,
  launcherMode?: LauncherMode | null,
): { overlayMode: OverlayMode; launcherMode: LauncherMode | null } {
  if (mode === "launcher") {
    return {
      overlayMode: "launcher",
      launcherMode: launcherMode ?? "search",
    };
  }
  return { overlayMode: "palette", launcherMode: null };
}

export function transitionPromptPaletteRuntimeState(
  palette: PromptPaletteRuntimeState,
  transition: PromptPaletteRuntimeTransition,
): PromptPaletteRuntimeTransitionResult {
  switch (transition.type) {
    case "set-active":
      return transitionActiveState(palette, transition.active, transition.inactiveSurfaceMode);
    case "set-overlay-mode":
      return transitionOverlayMode(palette, transition.mode, transition.launcherMode);
    case "set-applying":
      return transitionApplyingState(palette);
    case "set-loaded":
      return transitionLoadedState(palette, transition.prepared);
    case "set-template":
      return transitionTemplateState(
        palette,
        transition.promptId,
        transition.contextIds,
        transition.initialValues,
      );
    case "clear-template":
      return transitionClearTemplateState(palette);
    case "set-clip-feedback":
      palette.active = false;
      return {
        surfaceMode: "clip-feedback",
        schedulePosition: false,
        changed: true,
      };
    case "clear-clip-feedback":
      if (palette.surfaceMode !== "clip-feedback") {
        return { changed: false };
      }
      palette.clipFeedback = null;
      return {
        surfaceMode: "idle",
        schedulePosition: true,
        changed: true,
      };
  }
}

function transitionActiveState(
  palette: PromptPaletteRuntimeState,
  active: boolean,
  inactiveSurfaceMode: OverlaySurfaceMode = "idle",
): PromptPaletteRuntimeTransitionResult {
  palette.active = active;
  if (active) {
    const keepCurrentSurface =
      palette.surfaceMode === "loaded"
      || palette.surfaceMode === "template"
      || palette.deliveryInFlight;
    return {
      surfaceMode: keepCurrentSurface ? palette.surfaceMode : undefined,
      ensureSelectionVisible: true,
      changed: true,
    };
  }

  palette.overlayMode = "palette";
  palette.launcherMode = null;
  palette.preparedExecution = null;
  resetTemplateRuntimeState(palette);
  resetScratchRuntimeState(palette);
  palette.deliveryInFlight = false;
  resetLauncherSearchState(palette);
  return {
    surfaceMode: inactiveSurfaceMode,
    ensureSelectionVisible: true,
    changed: true,
  };
}

function transitionOverlayMode(
  palette: PromptPaletteRuntimeState,
  mode: OverlayMode,
  launcherMode?: LauncherMode | null,
): PromptPaletteRuntimeTransitionResult {
  const next = normalizeOverlaySession(mode, launcherMode);
  const previousLauncherMode = palette.launcherMode;
  palette.overlayMode = next.overlayMode;
  palette.launcherMode = next.launcherMode;

  if (next.launcherMode !== "search") {
    resetLauncherSearchState(palette);
  }
  if (next.launcherMode !== "library" && previousLauncherMode === "library") {
    resetLauncherLibraryState(palette);
  }
  if (next.launcherMode === "library" && previousLauncherMode !== "library") {
    palette.launcherCommandIndex = 0;
  }
  if (
    previousLauncherMode
    && (previousLauncherMode === "scratch" || previousLauncherMode === "refine")
    && next.launcherMode !== "scratch"
    && next.launcherMode !== "refine"
  ) {
    palette.scratchText = "";
    palette.scratchMetaConfirmRequired = false;
    palette.scratchMetaConfirmPending = false;
  }
  if (next.launcherMode === "stack") {
    palette.contextPickerSelectedIndex = 0;
  }
  if (
    next.overlayMode === "launcher"
    && previousLauncherMode
    && previousLauncherMode !== next.launcherMode
  ) {
    clearScratchRefinementState(palette);
    palette.scratchRefining = false;
    palette.scratchRefineError = null;
    palette.scratchNotice = null;
  }

  const keepCurrentSurface =
    palette.surfaceMode === "loaded"
    || palette.deliveryInFlight
    || (
      palette.surfaceMode === "template"
      && next.overlayMode === "launcher"
      && next.launcherMode === "variables"
    );
  return {
    surfaceMode: palette.active
      ? keepCurrentSurface ? palette.surfaceMode : undefined
      : palette.surfaceMode,
    schedulePosition: true,
    changed: true,
  };
}

function transitionApplyingState(
  palette: PromptPaletteRuntimeState,
): PromptPaletteRuntimeTransitionResult {
  palette.active = false;
  palette.overlayMode = "palette";
  palette.launcherMode = null;
  palette.preparedExecution = null;
  resetTemplateRuntimeState(palette);
  resetScratchRuntimeState(palette);
  palette.deliveryInFlight = true;
  resetLauncherSearchState(palette);
  return {
    surfaceMode: "idle",
    changed: true,
  };
}

function transitionLoadedState(
  palette: PromptPaletteRuntimeState,
  prepared: PreparedPromptExecution,
): PromptPaletteRuntimeTransitionResult {
  palette.active = true;
  palette.overlayMode = "palette";
  palette.launcherMode = null;
  palette.preparedExecution = prepared;
  resetTemplateRuntimeState(palette);
  palette.scratchNotice = null;
  palette.scratchMetaConfirmRequired = false;
  palette.scratchMetaConfirmPending = false;
  palette.scratchRefining = false;
  clearScratchRefinementState(palette);
  palette.scratchRefineError = null;
  palette.deliveryInFlight = false;
  resetLauncherSearchState(palette);
  return {
    surfaceMode: "loaded",
    schedulePosition: true,
    changed: true,
  };
}

function transitionTemplateState(
  palette: PromptPaletteRuntimeState,
  promptId: string,
  contextIds: string[],
  initialValues: Record<string, string>,
): PromptPaletteRuntimeTransitionResult {
  const returnLauncherMode = palette.overlayMode === "launcher"
    ? palette.launcherMode
    : null;
  palette.active = true;
  palette.overlayMode = "launcher";
  palette.launcherMode = "variables";
  palette.preparedExecution = null;
  palette.templatePromptId = promptId;
  palette.templateValues = { ...initialValues };
  palette.templateContextIds = contextIds;
  palette.templateReturnLauncherMode = returnLauncherMode;
  palette.templateValidationErrors = {};
  clearTemplateDynamicEnumState(palette);
  palette.scratchMetaConfirmRequired = false;
  palette.scratchMetaConfirmPending = false;
  palette.scratchRefining = false;
  clearScratchRefinementState(palette);
  palette.scratchRefineError = null;
  palette.deliveryInFlight = false;
  palette.pendingConfirmPromptId = null;
  return {
    surfaceMode: "template",
    schedulePosition: true,
    changed: true,
  };
}

function transitionClearTemplateState(
  palette: PromptPaletteRuntimeState,
): PromptPaletteRuntimeTransitionResult {
  const returnLauncherMode = palette.templateReturnLauncherMode;
  resetTemplateRuntimeState(palette);
  if (palette.surfaceMode !== "template") {
    return {
      surfaceMode: palette.surfaceMode,
      schedulePosition: true,
      changed: true,
    };
  }
  if (returnLauncherMode) {
    palette.overlayMode = "launcher";
    palette.launcherMode = returnLauncherMode;
    return {
      schedulePosition: true,
      changed: true,
    };
  }
  palette.active = false;
  palette.overlayMode = "palette";
  palette.launcherMode = null;
  return {
    surfaceMode: "idle",
    schedulePosition: true,
    changed: true,
  };
}

export function clearScratchRefinementState(
  palette: ScratchRuntimeState & Pick<OverlaySessionState, "launcherMode">,
) {
  palette.scratchRefining = false;
  palette.scratchRefineSourceText = null;
  palette.scratchRefineSourceRequiresConfirmation = false;
  palette.scratchRefineResultText = null;
  palette.scratchRefineResultRequiresConfirmation = false;
  palette.scratchRefineApplied = false;
  if (palette.launcherMode === "refine") {
    palette.launcherMode = "scratch";
  }
}

function clearTemplateDynamicEnumState(palette: TemplateRuntimeState) {
  palette.templateDynamicEnumValues = {};
  palette.templateDynamicEnumErrors = {};
  palette.templateDynamicEnumLoading = {};
}
