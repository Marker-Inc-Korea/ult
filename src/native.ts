import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  AccessibilityStatus,
  AppDiagnostics,
  AppSettings,
  AppShortcutUpdateResult,
  DeliveryCommandResult,
  DiagnosticsExportResult,
  DeliveryResultEvent,
  DeliveryMode,
  DynamicEnumResolveResult,
  EphemeralContextCaptureEvent,
  MetaPromptResult,
  MetaPromptingConnectionTestResult,
  MetaPromptingSettings,
  InterventionArtifactInput,
  LauncherMode,
  PaletteActiveEvent,
  PointerPosition,
  PromptLoadResult,
  PromptDefinition,
  PromptExportResult,
  GitHubLibraryImportPreview,
  GitHubLibraryImportResult,
  PromptExecutionKind,
  PromptImportResult,
  ProjectArtifactWriteKind,
  ProjectArtifactWritePreview,
  ProjectArtifactWriteResult,
  ProjectSetupPreview,
  ProjectSetupResult,
  ProjectSetupWriteTarget,
  PromptShortcutSyncResult,
  UsageHistoryEntry,
  WorkflowInputContextSaveResult,
} from "./types";
import type { PreferencesSection } from "./windows/nativeShell";

export type PreferencesRoute = {
  section: PreferencesSection;
};

type TauriInternals = {
  invoke: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: TauriInternals;
  }
}

const PALETTE_POINTER_EVENT = "ult:palette-pointer";
const PALETTE_ACTIVE_EVENT = "ult:palette-active";
const DELIVERY_RESULT_EVENT = "ult:delivery-result";
const EPHEMERAL_CONTEXT_CAPTURED_EVENT = "ult:ephemeral-context-captured";
const PREFERENCES_SECTION_EVENT = "ult:preferences-section";
const APPEARANCE_CHANGED_EVENT = "ult:appearance-changed";

export async function invokeNative<T>(
  command: string,
  payload?: Record<string, unknown>,
) {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (!invoke) {
    throw new Error("Native shell is unavailable");
  }
  return invoke<T>(command, payload);
}

export const native = {
  addInterventionArtifact: (prompt: InterventionArtifactInput) =>
    invokeNative<PromptLoadResult>("add_intervention_artifact", { prompt }),
  accessibilityStatus: () =>
    invokeNative<AccessibilityStatus>("accessibility_status"),
  captureEphemeralContext: () =>
    invokeNative<EphemeralContextCaptureEvent>("capture_ephemeral_context"),
  currentPalettePointer: () => invokeNative<PointerPosition>("current_palette_pointer"),
  deliverPromptAtPointer: (
    text: string,
    mode: DeliveryMode,
    promptId?: string | null,
    promptKind: PromptExecutionKind = "local",
  ) =>
    invokeNative<DeliveryCommandResult>("deliver_prompt_at_pointer", {
      text,
      mode,
      promptId: promptId ?? null,
      promptKind,
    }),
  deleteInterventionArtifact: (artifactId: string) =>
    invokeNative<PromptLoadResult>("delete_intervention_artifact", { artifactId }),
  exportAppDiagnostics: () =>
    invokeNative<DiagnosticsExportResult>("export_app_diagnostics"),
  exportInterventionArtifacts: (artifactIds: string[]) =>
    invokeNative<PromptExportResult>("export_intervention_artifacts", { artifactIds }),
  resolveDynamicEnumArgument: (
    argumentName: string,
    command: string,
    workingDirectory: string,
  ) =>
    invokeNative<DynamicEnumResolveResult>("resolve_dynamic_enum_argument", {
      argumentName,
      command,
      workingDirectory,
    }),
  importInterventionArtifacts: (contents: string) =>
    invokeNative<PromptImportResult>("import_intervention_artifacts", { contents }),
  previewGitHubLibraryImport: (url: string, reference: string | null = null) =>
    invokeNative<GitHubLibraryImportPreview>("preview_github_library_import", {
      request: { url, reference },
    }),
  importGitHubLibraryPack: (
    url: string,
    reference: string | null,
    selectedPaths: string[],
  ) =>
    invokeNative<GitHubLibraryImportResult>("import_github_library_pack", {
      selection: { url, reference, selected_paths: selectedPaths },
    }),
  previewProjectArtifactWrite: (
    artifactId: string,
    writeKind: ProjectArtifactWriteKind,
    targetDirectory: string,
    overwrite = false,
  ) =>
    invokeNative<ProjectArtifactWritePreview>("preview_project_artifact_write", {
      request: {
        artifact_id: artifactId,
        write_kind: writeKind,
        target_directory: targetDirectory,
        overwrite,
      },
    }),
  writeProjectArtifact: (
    artifactId: string,
    writeKind: ProjectArtifactWriteKind,
    targetDirectory: string,
    overwrite: boolean,
  ) =>
    invokeNative<ProjectArtifactWriteResult>("write_project_artifact", {
      request: {
        artifact_id: artifactId,
        write_kind: writeKind,
        target_directory: targetDirectory,
        overwrite,
      },
    }),
  previewProjectSetup: (
    targets: ProjectSetupWriteTarget[],
    targetDirectory: string,
    overwrite = false,
  ) =>
    invokeNative<ProjectSetupPreview>("preview_project_setup", {
      request: {
        target_directory: targetDirectory,
        targets,
        overwrite,
      },
    }),
  writeProjectSetup: (
    targets: ProjectSetupWriteTarget[],
    targetDirectory: string,
    overwrite: boolean,
    planHash: string,
  ) =>
    invokeNative<ProjectSetupResult>("write_project_setup", {
      request: {
        target_directory: targetDirectory,
        targets,
        overwrite,
        plan_hash: planHash,
      },
    }),
  loadAppSettings: () => invokeNative<AppSettings>("load_app_settings"),
  loadAppDiagnostics: () =>
    invokeNative<AppDiagnostics>("load_app_diagnostics"),
  loadMetaPromptingSettings: () =>
    invokeNative<MetaPromptingSettings>("load_meta_prompting_settings"),
  loadUsageHistory: (limit?: number) =>
    invokeNative<UsageHistoryEntry[]>("load_usage_history", { limit: limit ?? null }),
  loadInterventionLibrary: () =>
    invokeNative<PromptLoadResult>("load_intervention_library"),
  reloadInterventionLibrary: () =>
    invokeNative<PromptLoadResult>("reload_intervention_library"),
  consumePendingPreferencesRoute: () =>
    invokeNative<PreferencesRoute | null>("consume_pending_preferences_route"),
  paletteSelectedArtifactId: () =>
    invokeNative<string | null>("palette_selected_artifact_id"),
  refineScratchPrompt: (text: string) =>
    invokeNative<MetaPromptResult>("refine_scratch_prompt", { text }),
  saveScratchPrompt: (text: string, confirm: boolean) =>
    invokeNative<PromptLoadResult>("save_scratch_prompt", { text, confirm }),
  saveWorkflowInputContext: (text: string, workflowTitle: string) =>
    invokeNative<WorkflowInputContextSaveResult>("save_workflow_input_context", {
      text,
      workflowTitle,
    }),
  openPalette: () => invokeNative<void>("open_palette"),
  openLauncher: (mode: LauncherMode = "search") =>
    invokeNative<void>("open_launcher", { mode }),
  openPreferences: () =>
    invokeNative<void>("open_preferences"),
  openInterventionLibraryFolder: () =>
    invokeNative<void>("open_intervention_library_folder"),
  openSkillsFolder: () =>
    invokeNative<void>("open_skills_folder"),
  revealUltHome: () => invokeNative<void>("reveal_ult_home"),
  revealInterventionSource: (artifactId: string) =>
    invokeNative<void>("reveal_intervention_source", { artifactId }),
  selectInterventionArtifact: (artifactId: string) =>
    invokeNative<void>("select_intervention_artifact", { artifactId }),
  setAppShortcuts: (
    openPaletteShortcut: string,
    searchShortcut: string,
    scratchPromptShortcut: string,
  ) =>
    invokeNative<AppShortcutUpdateResult>("set_app_shortcuts", {
      openPaletteShortcut,
      searchShortcut,
      scratchPromptShortcut,
    }),
  setLaunchAtLogin: (enabled: boolean) =>
    invokeNative<AppSettings>("set_launch_at_login", { enabled }),
  setMetaPromptingSettings: (
    enabled: boolean,
    provider: string,
    apiKey: string,
    model: string,
    template: string,
  ) =>
    invokeNative<MetaPromptingSettings>("set_meta_prompting_settings", {
      enabled,
      provider,
      apiKey,
      model,
      template,
    }),
  testMetaPromptingConnection: (
    provider: string,
    apiKey: string,
    model: string,
  ) =>
    invokeNative<MetaPromptingConnectionTestResult>("test_meta_prompting_connection", {
      provider,
      apiKey,
      model,
    }),
  setPaletteVisibleCount: (visibleCount: number) =>
    invokeNative<AppSettings>("set_palette_visible_count", { visibleCount }),
  setAppearance: (appearance: NonNullable<AppSettings["appearance"]>) =>
    invokeNative<AppSettings>("set_appearance", { appearance }),
  setPinnedInterventionArtifacts: (artifactIds: string[]) =>
    invokeNative<AppSettings>("set_pinned_intervention_artifacts", { artifactIds }),
  syncInterventionShortcuts: (artifacts: PromptDefinition[]) =>
    invokeNative<PromptShortcutSyncResult>("sync_intervention_shortcuts", { artifacts }),
  dismissEphemeralContextFeedback: () =>
    invokeNative<void>("dismiss_ephemeral_context_feedback"),
  showEphemeralContextIndicator: () =>
    invokeNative<PointerPosition>("show_ephemeral_context_indicator"),
  listenPreferencesRoute: async (handler: (route: PreferencesRoute) => void) => {
    try {
      return await listen<PreferencesRoute>(PREFERENCES_SECTION_EVENT, (event) => {
        handler(event.payload);
      });
    } catch {
      return () => undefined;
    }
  },
  listenAppearanceChanged: async (
    handler: (appearance: NonNullable<AppSettings["appearance"]>) => void,
  ) => {
    try {
      return await listen<NonNullable<AppSettings["appearance"]>>(APPEARANCE_CHANGED_EVENT, (event) => {
        handler(event.payload);
      });
    } catch {
      return () => undefined;
    }
  },
  unloadOverlay: () => invokeNative<void>("unload_overlay"),
  updateInterventionArtifact: (originalId: string, prompt: InterventionArtifactInput) =>
    invokeNative<PromptLoadResult>("update_intervention_artifact", { originalId, prompt }),
  windowLabel: () => invokeNative<string>("window_label"),
};

export type PaletteEventHandlers = {
  pointer: (position: PointerPosition) => void;
  active: (payload: PaletteActiveEvent) => void;
  deliveryResult: (payload: DeliveryResultEvent) => void;
  ephemeralContextCaptured: (payload: EphemeralContextCaptureEvent) => void;
};

export async function listenPaletteEvents(handlers: PaletteEventHandlers) {
  const unlisteners: UnlistenFn[] = await Promise.all([
    listen<PointerPosition>(PALETTE_POINTER_EVENT, (event) => {
      handlers.pointer(event.payload);
    }),
    listen<PaletteActiveEvent>(PALETTE_ACTIVE_EVENT, (event) => {
      handlers.active(event.payload);
    }),
    listen<DeliveryResultEvent>(DELIVERY_RESULT_EVENT, (event) => {
      handlers.deliveryResult(event.payload);
    }),
    listen<EphemeralContextCaptureEvent>(
      EPHEMERAL_CONTEXT_CAPTURED_EVENT,
      (event) => {
        handlers.ephemeralContextCaptured(event.payload);
      },
    ),
  ]);

  return () => {
    for (const unlisten of unlisteners) {
      unlisten();
    }
  };
}
