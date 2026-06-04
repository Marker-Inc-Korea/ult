use tauri::{AppHandle, State, WebviewWindow};

use crate::intervention_library::{
    GitHubLibraryImportPreview, GitHubLibraryImportRequest, GitHubLibraryImportSelection,
    PromptLoadResult,
};
use crate::overlay_events::EphemeralContextCapturePayload;
use crate::state::AppState;
use crate::windows::{PALETTE_WINDOW, SETTINGS_WINDOW};

use super::ensure_window;

#[path = "prompt_commands/artifact_crud.rs"]
mod artifact_crud;
#[path = "prompt_commands/artifact_import_export.rs"]
mod artifact_import_export;
#[path = "prompt_commands/cache.rs"]
mod cache;
#[path = "prompt_commands/dynamic_enum.rs"]
mod dynamic_enum;
#[path = "prompt_commands/github_import.rs"]
mod github_import;
#[path = "prompt_commands/project_write.rs"]
mod project_write;
#[path = "prompt_commands/scratch.rs"]
mod scratch;
#[path = "prompt_commands/shortcut_sync.rs"]
mod shortcut_sync;
#[path = "prompt_commands/window_routes.rs"]
mod window_routes;
#[path = "prompt_commands/workflow_input.rs"]
mod workflow_input;

pub use artifact_crud::{
    add_intervention_artifact, delete_intervention_artifact, load_intervention_library,
    reload_intervention_library, update_intervention_artifact,
};
pub use artifact_import_export::{export_intervention_artifacts, import_intervention_artifacts};
pub(crate) use cache::load_prompt_cache_for_app;
pub use project_write::{
    preview_project_artifact_write, preview_project_setup, write_project_artifact,
    write_project_setup,
};
pub use shortcut_sync::sync_intervention_shortcuts;
pub use window_routes::{
    consume_pending_preferences_route, open_intervention_library_folder, open_launcher,
    open_palette, open_preferences, open_skills_folder, reveal_intervention_source,
    reveal_ult_home,
};

use dynamic_enum::DynamicEnumResolveResult;
use github_import::GitHubLibraryImportCommandResult;
use workflow_input::WorkflowInputContextSaveResult;

#[tauri::command]
pub fn palette_selected_artifact_id(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<Option<String>, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    state.selected_artifact_id()
}

#[tauri::command]
pub fn select_intervention_artifact(
    window: WebviewWindow,
    state: State<AppState>,
    artifact_id: String,
) -> Result<(), String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    state.set_selected_artifact_id(artifact_id)
}

#[tauri::command]
pub fn capture_ephemeral_context(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<EphemeralContextCapturePayload, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    crate::ephemeral_context::capture_ephemeral_context_from_clipboard(&app, &state)
}

#[tauri::command]
pub fn resolve_dynamic_enum_argument(
    window: WebviewWindow,
    argument_name: String,
    command: String,
    working_directory: String,
) -> Result<DynamicEnumResolveResult, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    Ok(dynamic_enum::resolve_dynamic_enum_argument_use_case(
        argument_name,
        command,
        working_directory,
    ))
}

#[tauri::command]
pub async fn preview_github_library_import(
    window: WebviewWindow,
    app: AppHandle,
    request: GitHubLibraryImportRequest,
) -> Result<GitHubLibraryImportPreview, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    github_import::preview_github_library_import_use_case(&app, request).await
}

#[tauri::command]
pub async fn import_github_library_pack(
    window: WebviewWindow,
    app: AppHandle,
    state: State<'_, AppState>,
    selection: GitHubLibraryImportSelection,
) -> Result<GitHubLibraryImportCommandResult, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    github_import::import_github_library_pack_use_case(&app, &state, selection).await
}

#[tauri::command]
pub fn save_scratch_prompt(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    text: String,
    confirm: bool,
) -> Result<PromptLoadResult, String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    scratch::save_scratch_prompt_use_case(&app, &state, text, confirm)
}

#[tauri::command]
pub fn save_workflow_input_context(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    text: String,
    workflow_title: String,
) -> Result<WorkflowInputContextSaveResult, String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    workflow_input::save_workflow_input_context_use_case(&app, &state, text, workflow_title)
}
