use tauri::{AppHandle, State, WebviewWindow};

use crate::intervention_library::{
    add_intervention_artifact as add_artifact_to_library,
    delete_intervention_artifact as delete_artifact_from_library,
    update_intervention_artifact as update_artifact_in_library, PromptDefinition, PromptLoadResult,
};
use crate::logging::info_event;
use crate::state::AppState;
use crate::windows::{PALETTE_WINDOW, SETTINGS_WINDOW};

#[tauri::command]
pub fn load_intervention_library(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<PromptLoadResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    super::load_prompt_cache_for_app(&app, &state, false)
}

#[tauri::command]
pub fn reload_intervention_library(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<PromptLoadResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    super::load_prompt_cache_for_app(&app, &state, true)
}

#[tauri::command]
pub fn add_intervention_artifact(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    prompt: PromptDefinition,
) -> Result<PromptLoadResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    let prompt = add_artifact_to_library(&app, prompt)?;
    state.set_selected_artifact_id(prompt.id)?;
    info_event(&app, "intervention-library", "artifact added");
    super::load_prompt_cache_for_app(&app, &state, true)
}

#[tauri::command]
pub fn update_intervention_artifact(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    original_id: String,
    prompt: PromptDefinition,
) -> Result<PromptLoadResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    let prompt = update_artifact_in_library(&app, original_id, prompt)?;
    state.set_selected_artifact_id(prompt.id)?;
    info_event(&app, "intervention-library", "artifact updated");
    super::load_prompt_cache_for_app(&app, &state, true)
}

#[tauri::command]
pub fn delete_intervention_artifact(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    artifact_id: String,
) -> Result<PromptLoadResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    delete_artifact_from_library(&app, artifact_id.clone())?;
    if state.selected_artifact_id()?.as_deref() == Some(artifact_id.as_str()) {
        state.clear_selected_artifact_id()?;
    }
    info_event(&app, "intervention-library", "artifact deleted");
    super::load_prompt_cache_for_app(&app, &state, true)
}
