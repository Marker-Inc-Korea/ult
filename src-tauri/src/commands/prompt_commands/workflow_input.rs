use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Runtime};

use crate::intervention_library::{
    save_workflow_input_context_artifact, PromptDefinition, PromptLoadResult,
};
use crate::logging::info_event;
use crate::state::AppState;

#[derive(Clone, Debug, Serialize)]
pub struct WorkflowInputContextSaveResult {
    pub artifact: PromptDefinition,
    pub library: PromptLoadResult,
}

pub(crate) fn save_workflow_input_context_use_case<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    text: String,
    workflow_title: String,
) -> Result<WorkflowInputContextSaveResult, String> {
    let artifact = save_workflow_input_context_artifact(app, text, workflow_title, timestamp_ms())?;
    state.set_selected_artifact_id(artifact.id.clone())?;
    info_event(app, "intervention-library", "workflow input context saved");
    let library = super::load_prompt_cache_for_app(app, state, true)?;
    Ok(WorkflowInputContextSaveResult { artifact, library })
}

fn timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}
