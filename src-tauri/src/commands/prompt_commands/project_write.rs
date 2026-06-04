use tauri::{AppHandle, WebviewWindow};

use crate::intervention_library::{
    preview_project_artifact_write as preview_project_write,
    preview_project_setup as preview_project_setup_plan,
    write_project_artifact as write_project_artifact_to_target,
    write_project_setup as write_project_setup_plan, ProjectArtifactWritePreview,
    ProjectArtifactWriteRequest, ProjectArtifactWriteResult, ProjectSetupPreview,
    ProjectSetupPreviewRequest, ProjectSetupResult, ProjectSetupWriteRequest,
};
use crate::windows::PALETTE_WINDOW;

#[tauri::command]
pub fn preview_project_artifact_write(
    window: WebviewWindow,
    app: AppHandle,
    request: ProjectArtifactWriteRequest,
) -> Result<ProjectArtifactWritePreview, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW])?;
    preview_project_write(&app, request)
}

#[tauri::command]
pub fn write_project_artifact(
    window: WebviewWindow,
    app: AppHandle,
    request: ProjectArtifactWriteRequest,
) -> Result<ProjectArtifactWriteResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW])?;
    write_project_artifact_to_target(&app, request)
}

#[tauri::command]
pub fn preview_project_setup(
    window: WebviewWindow,
    app: AppHandle,
    request: ProjectSetupPreviewRequest,
) -> Result<ProjectSetupPreview, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW])?;
    preview_project_setup_plan(&app, request)
}

#[tauri::command]
pub fn write_project_setup(
    window: WebviewWindow,
    app: AppHandle,
    request: ProjectSetupWriteRequest,
) -> Result<ProjectSetupResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW])?;
    write_project_setup_plan(&app, request)
}
