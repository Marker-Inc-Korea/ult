mod delivery_commands;
mod diagnostics_commands;
mod meta_prompting_commands;
mod prompt_commands;
mod settings_commands;

use serde::Serialize;
use tauri::{AppHandle, Runtime, WebviewWindow};

use crate::settings::{load_app_settings_from_disk, AppSettings};

pub use delivery_commands::{
    current_palette_pointer, deliver_prompt_at_pointer, dismiss_ephemeral_context_feedback,
    show_ephemeral_context_indicator, unload_overlay,
};
pub use diagnostics_commands::{export_app_diagnostics, load_app_diagnostics, load_usage_history};
pub use meta_prompting_commands::{refine_scratch_prompt, test_meta_prompting_connection};
pub(crate) use prompt_commands::load_prompt_cache_for_app;
pub use prompt_commands::{
    add_intervention_artifact, capture_ephemeral_context, consume_pending_preferences_route,
    delete_intervention_artifact, export_intervention_artifacts, import_github_library_pack,
    import_intervention_artifacts, load_intervention_library, open_intervention_library_folder,
    open_launcher, open_palette, open_preferences, open_skills_folder,
    palette_selected_artifact_id, preview_github_library_import, preview_project_artifact_write,
    preview_project_setup, reload_intervention_library, resolve_dynamic_enum_argument,
    reveal_intervention_source, reveal_ult_home, save_scratch_prompt, save_workflow_input_context,
    select_intervention_artifact, sync_intervention_shortcuts, update_intervention_artifact,
    write_project_artifact, write_project_setup,
};
pub use settings_commands::{
    accessibility_status, load_app_settings, load_meta_prompting_settings, set_app_shortcuts,
    set_appearance, set_launch_at_login, set_meta_prompting_settings, set_palette_visible_count,
    set_pinned_intervention_artifacts,
};
pub(crate) use settings_commands::{apply_launch_at_login_setting, sync_app_shortcuts_for_app};

#[derive(Debug, Serialize)]
pub struct AccessibilityStatus {
    pub platform: &'static str,
    pub trusted: bool,
    pub required_for_native_delivery: bool,
}

#[tauri::command]
pub fn window_label(window: WebviewWindow) -> String {
    window.label().to_string()
}

pub(crate) fn ensure_window(window: &WebviewWindow, allowed: &[&str]) -> Result<(), String> {
    let label = window.label();
    if allowed.contains(&label) {
        Ok(())
    } else {
        Err(format!("command is not available to `{label}` window"))
    }
}

pub(crate) fn current_accessibility_status() -> AccessibilityStatus {
    AccessibilityStatus {
        platform: accessibility_platform(),
        trusted: crate::delivery::accessibility_permission_status(),
        required_for_native_delivery: true,
    }
}

#[cfg(target_os = "macos")]
fn accessibility_platform() -> &'static str {
    "macos"
}

#[cfg(not(target_os = "macos"))]
fn accessibility_platform() -> &'static str {
    "unsupported"
}

pub(crate) fn load_effective_app_settings<R: Runtime>(app: &AppHandle<R>) -> AppSettings {
    let mut settings = load_app_settings_from_disk(app);
    settings.launch_at_login = settings_commands::launch_at_login_enabled(app);
    settings
}
