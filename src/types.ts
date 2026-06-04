export type DeliveryMode = "copy" | "paste" | "send" | "interrupt-send";

export type OverlayMode = "palette" | "launcher";
export type LauncherMode =
  | "search"
  | "library"
  | "scratch"
  | "refine"
  | "variables"
  | "stack"
  | "recent";
export type PromptExecutionKind = "bundled" | "local" | "template" | "scratch" | "context";
export type PromptArtifactType = "prompt" | "context" | "skill";
export type LibraryPackageType = PromptArtifactType | "command";
export type PromptScope = "persistent" | "ephemeral";
export type PromptArtifactSource = "user" | "clipboard" | "scratch";
export type PromptExecutionState =
  | "blocked-permission"
  | "selecting"
  | "collecting-template-values"
  | "loaded"
  | "applying"
  | "delivered"
  | "copied"
  | "clipboard"
  | "failed";
export type OverlaySurfaceMode =
  | "idle"
  | "palette"
  | "search"
  | "library"
  | "loaded"
  | "template"
  | "scratch"
  | "context-picker"
  | "clip-feedback";

export type DeliveryCommandStatus =
  | "started"
  | "copied"
  | "blocked";

export type DeliveryCommandResult = {
  delivery_id: number;
  status: DeliveryCommandStatus;
  message: string;
  diagnostic_code?: DeliveryDiagnosticCode | null;
};

export type DeliveryResultStatus =
  | "started"
  | "delivered"
  | "copied"
  | "cancelled"
  | "failed";

export type DeliveryTargetApplication = {
  bundle_id: string;
  name: string;
};

export type DeliveryDiagnosticCode =
  | "copy-mode"
  | "accessibility-required"
  | "native-unavailable"
  | "pointer-unavailable"
  | "target-unavailable"
  | "click-failed"
  | "focus-timeout"
  | "pasteboard-write-failed"
  | "paste-failed"
  | "send-failed"
  | "interrupt-failed"
  | "native-key-failed"
  | "overlay-passthrough-failed"
  | "stale-delivery"
  | "cancelled"
  | "delivered"
  | "native-delivery-failed";

export type DeliveryDiagnostic = {
  code: DeliveryDiagnosticCode;
  summary: string;
  action: string;
};

export type DeliveryResultEvent = {
  delivery_id: number;
  timestamp_ms: number;
  prompt_id: string | null;
  prompt_kind: PromptExecutionKind;
  mode: DeliveryMode;
  execution_state: PromptExecutionState;
  status: DeliveryResultStatus;
  message: string;
  clipboard_restored: boolean;
  target_application?: DeliveryTargetApplication | null;
  diagnostic?: DeliveryDiagnostic | null;
};

export type PromptShortcutSyncResult = {
  registered: PromptShortcutRegistration[];
  warnings: string[];
  errors: string[];
};

export type PromptShortcutRegistration = {
  prompt_id: string;
  shortcut: string;
};

export type AppShortcutSyncResult = {
  registered: AppShortcutRegistration[];
  errors: string[];
};

export type AppShortcutRegistration = {
  action: string;
  shortcut: string;
};

export type AppShortcutUpdateResult = {
  settings: AppSettings;
  shortcut_sync: AppShortcutSyncResult;
};

export type PromptDefinition = {
  id: string;
  title: string;
  artifact_type?: PromptArtifactType;
  scope?: PromptScope;
  pinned?: boolean;
  description: string;
  prompt: string;
  contexts?: string[];
  shortcut?: string | null;
  confirm?: boolean;
  template_arguments?: PromptTemplateArgument[];
  created_at?: number | null;
  expires_at?: number | null;
  source?: PromptArtifactSource;
  registry_source?: PromptRegistrySource;
  registry_source_path?: string | null;
  registry_source_created_ms?: number | null;
  registry_source_modified_ms?: number | null;
  registry_editable?: boolean;
  template_variables?: string[];
  template_diagnostics?: string[];
};

export type PromptTemplateArgument = {
  name: string;
  description?: string;
  default_value?: string;
  value_type?: "text" | "enum";
  enum_source?: "static" | "dynamic";
  enum_name?: string;
  enum_values?: string[];
  enum_dynamic_command?: string | null;
  enum_dynamic_cwd?: string | null;
};

export type DynamicEnumResolveResult = {
  argument_name: string;
  ok: boolean;
  values: string[];
  truncated: boolean;
  timed_out: boolean;
  retryable: boolean;
  error?: string | null;
};

export type PromptLoadResult = {
  artifacts: PromptDefinition[];
  entries?: PromptRegistryEntry[];
  commands?: UserLauncherCommandDefinition[];
  config_path: string;
  registry_path?: string;
  editable_artifact_ids: string[];
  errors: string[];
  warnings: string[];
};

export type WorkflowInputContextSaveResult = {
  artifact: PromptDefinition;
  library: PromptLoadResult;
};

export type UserLauncherCommandAction = "prepare";

export type UserLauncherCommandDefinition = {
  id: string;
  title: string;
  description: string;
  prompt_id: string;
  contexts: string[];
  variable_values: Record<string, string>;
  keywords: string[];
  aliases: string[];
  actions: UserLauncherCommandAction[];
  home: boolean;
  source_path?: string | null;
};

export type PromptRegistrySource =
  | "bundled"
  | "local-file"
  | "local-override";

export type PromptRegistryEntry = {
  prompt: PromptDefinition;
  source: PromptRegistrySource;
  source_path?: string | null;
  source_created_ms?: number | null;
  source_modified_ms?: number | null;
  editable: boolean;
  template_variables: string[];
  diagnostics: string[];
};

export type PromptImportResult = {
  library: PromptLoadResult;
  imported_count: number;
  updated_count: number;
  imported_artifact_ids: string[];
};

export type PromptExportResult = {
  file_path: string;
  artifact_count: number;
};

export type GitHubLibraryImportRequest = {
  url: string;
  reference?: string | null;
};

export type GitHubLibraryImportSelection = GitHubLibraryImportRequest & {
  selected_paths: string[];
};

export type GitHubLibraryImportAction = "new" | "overwrite";

export type GitHubLibraryImportEntry = {
  artifact_id: string;
  artifact_type: LibraryPackageType;
  title: string;
  source_path: string;
  target_path: string;
  action: GitHubLibraryImportAction;
  diagnostics: string[];
};

export type GitHubLibraryImportIssue = {
  path: string;
  reason: string;
};

export type GitHubLibraryImportPreview = {
  owner: string;
  repo: string;
  requested_ref?: string | null;
  resolved_ref: string;
  commit: string;
  source_url: string;
  entries: GitHubLibraryImportEntry[];
  ignored_files: GitHubLibraryImportIssue[];
  malformed_packages: GitHubLibraryImportIssue[];
  warnings: string[];
};

export type GitHubLibraryImportResult = PromptImportResult & {
  commit: string;
};

export type ProjectArtifactWriteKind =
  | "prompt"
  | "context"
  | "skill"
  | "agents-snippet";

export type ProjectArtifactWriteAction = "create" | "overwrite" | "blocked";

export type ProjectArtifactWriteFile = {
  relative_path: string;
  path: string;
  exists: boolean;
  action: ProjectArtifactWriteAction;
};

export type ProjectArtifactWritePreview = {
  artifact_id: string;
  artifact_type: PromptArtifactType;
  write_kind: ProjectArtifactWriteKind;
  target_directory: string;
  files: ProjectArtifactWriteFile[];
  requires_overwrite_confirmation: boolean;
  ready_to_write: boolean;
};

export type ProjectArtifactWriteResult = {
  artifact_id: string;
  write_kind: ProjectArtifactWriteKind;
  target_directory: string;
  written_files: string[];
};

export type ProjectSetupWriteTarget = {
  artifact_id: string;
  write_kind: ProjectArtifactWriteKind;
};

export type ProjectSetupPreviewEntry = ProjectSetupWriteTarget & {
  preview: ProjectArtifactWritePreview | null;
  error: string | null;
};

export type ProjectSetupPreview = {
  target_directory: string;
  entries: ProjectSetupPreviewEntry[];
  requires_overwrite_confirmation: boolean;
  ready_to_write: boolean;
  plan_hash: string;
};

export type ProjectSetupResultEntry = ProjectSetupWriteTarget & {
  result: ProjectArtifactWriteResult | null;
  error: string | null;
  files: ProjectArtifactWriteFile[];
};

export type ProjectSetupResult = {
  target_directory: string;
  plan_hash: string;
  entries: ProjectSetupResultEntry[];
  written_files: string[];
  failed_files: string[];
  ok: boolean;
};

export type InterventionArtifactInput = PromptDefinition;

export type PointerPosition = {
  x: number;
  y: number;
};

export type PaletteActiveEvent = {
  active: boolean;
  mode: OverlayMode;
  launcher_mode?: LauncherMode | null;
  generation?: number;
};

export type EphemeralContextCaptureEvent = {
  artifact: PromptDefinition;
  preview: string;
  timestamp_ms: number;
  pointer: PointerPosition;
};

export type AppSettings = {
  appearance?: "system" | "light" | "dark";
  palette_visible_count: number;
  pinned_artifact_ids: string[];
  launch_at_login: boolean;
  /** Reserved schema marker; native normalization keeps this false until a resolver exists. */
  project_metadata_enabled: boolean;
  open_palette_shortcut: string;
  search_shortcut: string;
  scratch_prompt_shortcut: string;
  meta_prompting_enabled: boolean;
  meta_prompting_provider: string;
  meta_prompting_model: string;
  meta_prompting_template: string;
};

export type MetaPromptingSettings = {
  enabled: boolean;
  provider: string;
  api_key: string;
  model: string;
  template: string;
};

export type MetaPromptingConnectionTestResult = {
  provider: string;
  model: string;
  message: string;
};

export type MetaPromptResult = {
  intervention_text: string;
  title: string;
  risk_level: "low" | "medium" | "high";
  requires_confirmation: boolean;
  why_this_wording: string;
};

export type AccessibilityStatus = {
  platform: "macos" | "unsupported";
  trusted: boolean;
  required_for_native_delivery: boolean;
};

export type UsageHistoryEntry = {
  timestamp_ms: number;
  prompt_id: string | null;
  prompt_kind?: PromptExecutionKind | null;
  delivery_mode: DeliveryMode;
  result: DeliveryResultStatus;
  diagnostic_code?: DeliveryDiagnosticCode | null;
  target_application?: DeliveryTargetApplication | null;
  project?: UsageHistoryProjectMetadata | null;
};

export type UsageHistoryProjectMetadata = {
  basename?: string | null;
  path_hash?: string | null;
};

export type DiagnosticsExportResult = {
  file_path: string;
  failure_count: number;
};

export type AppDiagnostics = {
  app_version: string;
  config_path: string;
  accessibility: AccessibilityStatus;
  app_identity: AppIdentityDiagnostics;
  overlay_coordinates: OverlayCoordinateDiagnostics;
  app_shortcuts: string[];
  last_delivery_result: DeliveryResultEvent | null;
  recent_history: UsageHistoryEntry[];
};

export type AppIdentityDiagnostics = {
  bundle_identifier: string;
  running_path: string;
  launch_kind: string;
  signing_status: string;
  accessibility_identity_note: string;
  stale_permission_reset_command: string;
};

export type OverlayCoordinateDiagnostics = {
  cursor_physical_position: string;
  active_display_name: string;
  active_display_physical_bounds: string;
  active_display_scale_factor: string;
  palette_window_physical_bounds: string;
  webview_pointer_position: string;
};
