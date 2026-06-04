import type {
  DeliveryMode,
  ProjectArtifactWriteKind,
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import type {
  LauncherLibraryFilter,
  LauncherLibrarySort,
} from "../../paletteRuntime";
import type { LauncherCommand } from "../launcher/launcherCommands";

export type LauncherArtifactActionId =
  | "load"
  | "read"
  | "copy-handle"
  | "copy-body"
  | "toggle-pin"
  | "duplicate-scratch"
  | "reveal"
  | "edit"
  | "duplicate"
  | "delete"
  | "export-project"
  | "install-project"
  | "agents-snippet";

export type LauncherRecoveryActionId =
  | "prepare-again"
  | "retry-copy"
  | "reveal-source"
  | "open-accessibility"
  | "export-diagnostics";

export type PaletteRenderActions = {
  loadSelected: (target: EventTarget | null) => void;
  applySearchComposer: () => void;
  selectAndLoad: (index: number, target: EventTarget | null) => void;
  selectDelta: (delta: number) => void;
  selectLauncherCommandDelta: (delta: number, count: number) => void;
  selectPanelActionDelta: (delta: number, count: number) => void;
  runLauncherCommand: (command: LauncherCommand) => void;
  copyLauncherCommandHandle: (command: LauncherCommand) => void;
  openArtifactReader: (artifactId?: string | null) => void;
  openArtifactActions: (artifactId?: string | null) => void;
  openArtifactComposer: (
    kind: "new" | "edit" | "duplicate",
    artifactType: PromptArtifactType,
    artifactId?: string | null,
    initialId?: string | null,
  ) => void;
  openArtifactDelete: (artifactId?: string | null) => void;
  openProjectArtifactWrite: (
    writeKind: ProjectArtifactWriteKind,
    artifactId?: string | null,
  ) => void;
  openProjectSetup: () => void;
  closeArtifactPanel: () => void;
  runArtifactAction: (
    actionId: LauncherArtifactActionId,
    artifactId?: string | null,
  ) => void;
  runRecoveryAction: (actionId: LauncherRecoveryActionId) => void;
  saveArtifactDraft: (
    originalId: string | null,
    draft: PromptDefinition,
  ) => Promise<void>;
  deleteArtifact: (artifactId: string) => Promise<void>;
  openStarterPacks: () => void;
  openGitHubImport: () => void;
  previewGitHubImport: (url: string, reference: string | null) => Promise<void>;
  importGitHubPackages: (
    url: string,
    reference: string | null,
    selectedPaths: string[],
  ) => Promise<void>;
  previewProjectArtifactWrite: (
    artifactId: string,
    writeKind: ProjectArtifactWriteKind,
    targetDirectory: string,
    overwrite: boolean,
  ) => Promise<void>;
  writeProjectArtifact: (
    artifactId: string,
    writeKind: ProjectArtifactWriteKind,
    targetDirectory: string,
    overwrite: boolean,
  ) => Promise<void>;
  previewProjectSetup: (
    targetDirectory: string,
    selectedArtifactIds: string[],
    includeAgentsSnippet: boolean,
    agentsSnippetArtifactId: string | null,
    overwrite: boolean,
    presetId?: string,
  ) => Promise<void>;
  writeProjectSetup: (
    targetDirectory: string,
    selectedArtifactIds: string[],
    includeAgentsSnippet: boolean,
    agentsSnippetArtifactId: string | null,
    overwrite: boolean,
  ) => Promise<void>;
  submitWorkflowInput: (
    commandId: string,
    inputText: string,
    contextHandleText: string,
  ) => Promise<void>;
  openContextStack: () => void;
  selectContextPickerDelta: (delta: number) => void;
  selectPageDelta: (delta: number) => void;
  submitTemplate: (values: Record<string, string>) => void;
  cancelTemplate: () => void;
  resolveTemplateVariable: (variable: string) => void;
  updateTemplateValue: (variable: string, value: string) => void;
  updateSearchQuery: (query: string, options?: { rerender?: boolean }) => void;
  setLibraryFilter: (filter: LauncherLibraryFilter) => void;
  updateLibraryQuery: (query: string) => void;
  setLibrarySort: (sort: LauncherLibrarySort) => void;
  removeSearchHandle: (handle: string) => void;
  updateScratchText: (text: string) => void;
  updateLoadedDeliveryMode: (mode: DeliveryMode) => void;
  refineScratch: () => void;
  acceptScratchRefinement: () => void;
  restoreScratchOriginal: () => void;
  submitScratch: () => void;
  cancelScratch: () => void;
  applyLoaded: () => void;
  applyContextPicker: () => void;
  unload: () => void;
  rerender: () => void;
};
