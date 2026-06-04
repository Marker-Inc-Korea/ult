use serde::Serialize;
use tauri::{AppHandle, State, WebviewWindow};

use crate::intervention_library::{
    export_intervention_artifacts as export_artifacts_from_library,
    import_intervention_artifacts as import_artifacts_to_library, PromptExportResult,
    PromptImportSummary, PromptLoadResult,
};
use crate::logging::info_event;
use crate::state::AppState;
use crate::windows::SETTINGS_WINDOW;

#[derive(Debug, Serialize)]
pub struct InterventionImportCommandResult {
    pub library: PromptLoadResult,
    pub imported_count: usize,
    pub updated_count: usize,
    pub imported_artifact_ids: Vec<String>,
}

#[tauri::command]
pub fn export_intervention_artifacts(
    window: WebviewWindow,
    app: AppHandle,
    artifact_ids: Vec<String>,
) -> Result<PromptExportResult, String> {
    super::super::ensure_window(&window, &[SETTINGS_WINDOW])?;
    export_artifacts_from_library(&app, artifact_ids)
}

#[tauri::command]
pub fn import_intervention_artifacts(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    contents: String,
) -> Result<InterventionImportCommandResult, String> {
    super::super::ensure_window(&window, &[SETTINGS_WINDOW])?;
    let summary = import_artifacts_to_library(&app, contents)?;
    if let Some(prompt_id) = summary.imported_artifact_ids.first() {
        state.set_selected_artifact_id(prompt_id.clone())?;
    }
    info_event(&app, "intervention-library", "artifact import completed");
    Ok(prompt_import_command_result(
        summary,
        super::load_prompt_cache_for_app(&app, &state, true)?,
    ))
}

fn prompt_import_command_result(
    summary: PromptImportSummary,
    library: PromptLoadResult,
) -> InterventionImportCommandResult {
    InterventionImportCommandResult {
        library,
        imported_count: summary.imported_count,
        updated_count: summary.updated_count,
        imported_artifact_ids: summary.imported_artifact_ids,
    }
}
