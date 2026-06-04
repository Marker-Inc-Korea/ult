use std::path::Path;
use std::process::Command;

use serde::Serialize;
use tauri::{AppHandle, Emitter, State, WebviewWindow};

use crate::intervention_library::{
    ensure_ult_home_for_app, persistent_skills_dir_for_app, prompt_source_path_for_app,
};
use crate::overlay_events::LauncherMode;
use crate::overlay_runtime::{show_launcher_window, show_prompt_palette_window};
use crate::state::{AppState, PendingPreferencesRoute};
use crate::windows::{show_standard_window, PALETTE_WINDOW, SETTINGS_WINDOW};

#[derive(Debug, Clone, Serialize)]
struct PreferencesRoutePayload {
    section: &'static str,
}

const REVEAL_INTERVENTION_SOURCE_WINDOWS: &[&str] = &[PALETTE_WINDOW, SETTINGS_WINDOW];

#[tauri::command]
pub fn open_palette(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    super::super::ensure_window(&window, &[SETTINGS_WINDOW])?;
    show_prompt_palette_window(&app)
}

#[tauri::command]
pub fn open_launcher(
    window: WebviewWindow,
    app: AppHandle,
    mode: LauncherMode,
) -> Result<(), String> {
    super::super::ensure_window(&window, &[SETTINGS_WINDOW])?;
    show_launcher_window(&app, mode)
}

#[tauri::command]
pub fn open_preferences(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<(), String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    state.set_pending_preferences_route("general")?;
    show_standard_window(&app, SETTINGS_WINDOW)?;
    app.emit(
        "ult:preferences-section",
        PreferencesRoutePayload { section: "general" },
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn consume_pending_preferences_route(
    window: WebviewWindow,
    state: State<AppState>,
) -> Result<Option<PendingPreferencesRoute>, String> {
    super::super::ensure_window(&window, &[SETTINGS_WINDOW])?;
    state.consume_pending_preferences_route()
}

#[tauri::command]
pub fn reveal_ult_home(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    super::super::ensure_window(&window, &[SETTINGS_WINDOW])?;
    let ult_home = ensure_ult_home_for_app(&app)?;
    open_path(&ult_home)
}

#[tauri::command]
pub fn open_intervention_library_folder(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<(), String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    let ult_home = ensure_ult_home_for_app(&app)?;
    open_path(&ult_home)
}

#[tauri::command]
pub fn open_skills_folder(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    super::super::ensure_window(&window, &[SETTINGS_WINDOW])?;
    let skills_dir = persistent_skills_dir_for_app(&app)?;
    open_path(&skills_dir)
}

#[tauri::command]
pub fn reveal_intervention_source(
    window: WebviewWindow,
    app: AppHandle,
    artifact_id: String,
) -> Result<(), String> {
    super::super::ensure_window(&window, REVEAL_INTERVENTION_SOURCE_WINDOWS)?;
    let source_path = prompt_source_path_for_app(&app, &artifact_id)?;
    open_path(&source_path)
}

fn open_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(path);
        command
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", ""]).arg(path);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command
        .spawn()
        .map_err(|error| format!("failed to open {}: {error}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::REVEAL_INTERVENTION_SOURCE_WINDOWS;
    use crate::windows::{PALETTE_WINDOW, SETTINGS_WINDOW};

    #[test]
    fn reveal_intervention_source_is_available_from_launcher_and_preferences() {
        assert!(REVEAL_INTERVENTION_SOURCE_WINDOWS.contains(&PALETTE_WINDOW));
        assert!(REVEAL_INTERVENTION_SOURCE_WINDOWS.contains(&SETTINGS_WINDOW));
    }
}
