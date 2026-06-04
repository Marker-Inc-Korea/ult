use tauri::image::Image;
use tauri::tray::TrayIconBuilder;
use tauri::Manager;

mod atomic_write;
mod clipboard_delivery;
mod commands;
mod config_lock;
mod delivery;
mod delivery_result_mapper;
mod delivery_supervisor;
mod ephemeral_context;
mod geometry;
mod hotkeys;
mod intervention_library;
mod logging;
mod modes;
mod overlay_events;
mod overlay_runtime;
mod prompt_executor;
mod settings;
mod state;
mod tray_menu;
mod usage_history;
mod windows;

use commands::{
    accessibility_status, add_intervention_artifact, apply_launch_at_login_setting,
    capture_ephemeral_context, consume_pending_preferences_route, current_palette_pointer,
    delete_intervention_artifact, deliver_prompt_at_pointer, dismiss_ephemeral_context_feedback,
    export_app_diagnostics, export_intervention_artifacts, import_github_library_pack,
    import_intervention_artifacts, load_app_diagnostics, load_app_settings,
    load_intervention_library, load_meta_prompting_settings, load_prompt_cache_for_app,
    load_usage_history, open_intervention_library_folder, open_launcher, open_palette,
    open_preferences, open_skills_folder, palette_selected_artifact_id,
    preview_github_library_import, preview_project_artifact_write, preview_project_setup,
    refine_scratch_prompt, reload_intervention_library, resolve_dynamic_enum_argument,
    reveal_intervention_source, reveal_ult_home, save_scratch_prompt, save_workflow_input_context,
    select_intervention_artifact, set_app_shortcuts, set_appearance, set_launch_at_login,
    set_meta_prompting_settings, set_palette_visible_count, set_pinned_intervention_artifacts,
    show_ephemeral_context_indicator, sync_app_shortcuts_for_app, sync_intervention_shortcuts,
    test_meta_prompting_connection, unload_overlay, update_intervention_artifact, window_label,
    write_project_artifact, write_project_setup,
};
use logging::{error_event, info_event, warn_event};
use settings::load_app_settings_from_disk;
use state::AppState;
use tray_menu::{build_tray_menu, handle_tray_menu_event};
use windows::{enforce_menu_bar_activation, handle_standard_window_close};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    logging::init_tracing();

    let builder = tauri::Builder::default();
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    let builder = builder.plugin(tauri_plugin_autostart::init(
        tauri_plugin_autostart::MacosLauncher::LaunchAgent,
        None,
    ));

    builder
        .plugin(hotkeys::plugin().expect("failed to initialize global shortcut plugin"))
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle();
            #[cfg(target_os = "macos")]
            enforce_menu_bar_activation(handle)?;

            let app_settings = load_app_settings_from_disk(handle);
            if app_settings.launch_at_login {
                if let Err(error) =
                    apply_launch_at_login_setting(handle, app_settings.launch_at_login)
                {
                    error_event(handle, "startup", "failed to sync launch-at-login setting");
                    tracing::debug!(error = %error, "launch-at-login startup sync failed");
                }
            }

            let state = app.state::<AppState>();
            if let Err(error) =
                intervention_library::cleanup_expired_ephemeral_artifacts_for_app(handle)
            {
                warn_event(
                    handle,
                    "startup",
                    "failed to clean expired ephemeral artifacts",
                );
                tracing::debug!(error = %error, "ephemeral artifact startup cleanup failed");
            }
            match sync_app_shortcuts_for_app(handle, &state, &app_settings) {
                Ok(result) => {
                    for error in result.errors {
                        error_event(
                            handle,
                            "startup",
                            "failed to register app shortcut at startup",
                        );
                        tracing::debug!(error = %error, "app shortcut startup registration failed");
                    }
                }
                Err(error) => {
                    error_event(
                        handle,
                        "startup",
                        "failed to register app shortcuts at startup",
                    );
                    tracing::debug!(error = %error, "app shortcut startup sync failed");
                }
            }

            match load_prompt_cache_for_app(handle, &state, true) {
                Ok(library) => {
                    if library.warnings.is_empty() && library.errors.is_empty() {
                        info_event(handle, "startup", "intervention library ready");
                    }
                    for warning in library.warnings {
                        warn_event(
                            handle,
                            "intervention-library",
                            "intervention library warning",
                        );
                        tracing::debug!(warning, "intervention library warning");
                    }
                    for error in library.errors {
                        error_event(handle, "intervention-library", "intervention library error");
                        tracing::debug!(error, "intervention library error");
                    }
                }
                Err(error) => {
                    error_event(handle, "startup", "failed to load intervention library");
                    tracing::debug!(error = %error, "intervention library startup load failed");
                }
            }

            let icon = Image::from_bytes(include_bytes!("../icons/tray-template.png"))?;
            let tray_menu = build_tray_menu(handle)?;

            TrayIconBuilder::with_id("ult")
                .tooltip("Ult")
                .icon(icon)
                .icon_as_template(true)
                .menu(&tray_menu)
                .show_menu_on_left_click(true)
                .build(app)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            handle_tray_menu_event(app, event.id().as_ref());
        })
        .on_window_event(|window, event| {
            handle_standard_window_close(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            accessibility_status,
            add_intervention_artifact,
            capture_ephemeral_context,
            consume_pending_preferences_route,
            current_palette_pointer,
            delete_intervention_artifact,
            deliver_prompt_at_pointer,
            dismiss_ephemeral_context_feedback,
            export_app_diagnostics,
            export_intervention_artifacts,
            import_github_library_pack,
            import_intervention_artifacts,
            load_app_diagnostics,
            load_app_settings,
            load_intervention_library,
            load_meta_prompting_settings,
            load_usage_history,
            open_intervention_library_folder,
            open_launcher,
            open_palette,
            open_preferences,
            open_skills_folder,
            palette_selected_artifact_id,
            preview_github_library_import,
            preview_project_artifact_write,
            preview_project_setup,
            refine_scratch_prompt,
            reload_intervention_library,
            resolve_dynamic_enum_argument,
            reveal_intervention_source,
            reveal_ult_home,
            save_scratch_prompt,
            save_workflow_input_context,
            select_intervention_artifact,
            set_appearance,
            set_app_shortcuts,
            set_launch_at_login,
            set_meta_prompting_settings,
            set_palette_visible_count,
            set_pinned_intervention_artifacts,
            show_ephemeral_context_indicator,
            sync_intervention_shortcuts,
            test_meta_prompting_connection,
            unload_overlay,
            update_intervention_artifact,
            window_label,
            write_project_artifact,
            write_project_setup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Ult");
}
