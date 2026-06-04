use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime, State, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::hotkeys::ShortcutAction;
use crate::logging::{error_event, warn_event};
use crate::overlay_events::LauncherMode;
use crate::overlay_events::APPEARANCE_CHANGED_EVENT;
use crate::overlay_runtime::{show_launcher_window, show_prompt_palette_window};
use crate::settings::{
    normalize_app_shortcut, normalize_appearance, normalize_artifact_id_list,
    normalize_palette_visible_count, update_app_settings, AppSettings,
    DEFAULT_META_PROMPTING_PROVIDER,
};
use crate::state::AppState;
use crate::tray_menu::refresh_tray_menu;
use crate::windows::{PALETTE_WINDOW, SETTINGS_WINDOW};

use super::{
    current_accessibility_status, ensure_window, load_effective_app_settings, AccessibilityStatus,
};

#[cfg(any(target_os = "macos", windows, target_os = "linux"))]
use tauri_plugin_autostart::ManagerExt;

#[derive(Debug, Serialize)]
pub struct AppShortcutRegistration {
    pub action: &'static str,
    pub shortcut: String,
}

#[derive(Debug, Serialize)]
pub struct AppShortcutSyncResult {
    pub registered: Vec<AppShortcutRegistration>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct AppShortcutUpdateResult {
    pub settings: AppSettings,
    pub shortcut_sync: AppShortcutSyncResult,
}

#[derive(Debug, Serialize)]
pub struct MetaPromptingSettings {
    pub enabled: bool,
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub template: String,
}

#[tauri::command]
pub fn load_app_settings(window: WebviewWindow, app: AppHandle) -> Result<AppSettings, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    Ok(load_effective_app_settings(&app))
}

#[tauri::command]
pub fn load_meta_prompting_settings(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<MetaPromptingSettings, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    Ok(meta_prompting_settings_from_app_settings(
        &load_effective_app_settings(&app),
    ))
}

#[tauri::command]
pub fn set_palette_visible_count(
    window: WebviewWindow,
    app: AppHandle,
    visible_count: usize,
) -> Result<AppSettings, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    update_app_settings(&app, |settings| {
        settings.palette_visible_count = normalize_palette_visible_count(Some(visible_count));
        Ok(())
    })?;
    refresh_tray_menu(&app)?;
    Ok(load_effective_app_settings(&app))
}

#[tauri::command]
pub fn set_appearance(
    window: WebviewWindow,
    app: AppHandle,
    appearance: String,
) -> Result<AppSettings, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let appearance = normalize_appearance(Some(&appearance));
    update_app_settings(&app, move |settings| {
        settings.appearance = appearance;
        Ok(())
    })?;
    let settings = load_effective_app_settings(&app);
    let _ = app.emit(APPEARANCE_CHANGED_EVENT, settings.appearance.clone());
    Ok(settings)
}

#[tauri::command]
pub fn set_pinned_intervention_artifacts(
    window: WebviewWindow,
    app: AppHandle,
    artifact_ids: Vec<String>,
) -> Result<AppSettings, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let pinned_artifact_ids = normalize_artifact_id_list(Some(artifact_ids));
    update_app_settings(&app, move |settings| {
        settings.pinned_artifact_ids = pinned_artifact_ids;
        Ok(())
    })?;
    refresh_tray_menu(&app)?;
    Ok(load_effective_app_settings(&app))
}

#[tauri::command]
pub fn set_launch_at_login(
    window: WebviewWindow,
    app: AppHandle,
    enabled: bool,
) -> Result<AppSettings, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let actual = apply_launch_at_login_setting(&app, enabled)?;
    update_app_settings(&app, |settings| {
        settings.launch_at_login = actual;
        Ok(())
    })?;
    refresh_tray_menu(&app)?;
    Ok(load_effective_app_settings(&app))
}

#[tauri::command]
pub fn set_meta_prompting_settings(
    window: WebviewWindow,
    app: AppHandle,
    enabled: bool,
    provider: String,
    api_key: String,
    model: String,
    template: String,
) -> Result<MetaPromptingSettings, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let provider = provider.trim().to_lowercase();
    if provider.is_empty() {
        return Err("Meta Prompting provider is required".to_string());
    }
    if provider != DEFAULT_META_PROMPTING_PROVIDER {
        return Err("Only OpenAI is supported for Meta Prompting in this beta".to_string());
    }
    let api_key = api_key.trim().to_string();
    if enabled && api_key.is_empty() {
        return Err("OpenAI API key is required to enable Meta Prompting".to_string());
    }
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err("Meta Prompting model is required".to_string());
    }
    let template = template.trim().to_string();
    if template.is_empty() {
        return Err("Meta Prompting template is required".to_string());
    }
    if !template.contains("{input}") {
        return Err("Meta Prompting template must include {input}".to_string());
    }
    update_app_settings(&app, move |settings| {
        settings.meta_prompting_enabled = enabled;
        settings.meta_prompting_provider = provider;
        settings.meta_prompting_api_key = api_key;
        settings.meta_prompting_model = model;
        settings.meta_prompting_template = template;
        Ok(())
    })?;
    refresh_tray_menu(&app)?;
    Ok(meta_prompting_settings_from_app_settings(
        &load_effective_app_settings(&app),
    ))
}

fn meta_prompting_settings_from_app_settings(settings: &AppSettings) -> MetaPromptingSettings {
    MetaPromptingSettings {
        enabled: settings.meta_prompting_enabled,
        provider: settings.meta_prompting_provider.clone(),
        api_key: settings.meta_prompting_api_key.clone(),
        model: settings.meta_prompting_model.clone(),
        template: settings.meta_prompting_template.clone(),
    }
}

#[tauri::command]
pub fn set_app_shortcuts(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    open_palette_shortcut: String,
    search_shortcut: String,
    scratch_prompt_shortcut: String,
) -> Result<AppShortcutUpdateResult, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let open_palette_shortcut = normalize_app_shortcut(&open_palette_shortcut)
        .map_err(|error| format!("open palette shortcut is invalid: {error}"))?;
    let search_shortcut = normalize_app_shortcut(&search_shortcut)
        .map_err(|error| format!("open launcher shortcut is invalid: {error}"))?;
    let scratch_prompt_shortcut = normalize_app_shortcut(&scratch_prompt_shortcut)
        .map_err(|error| format!("launcher scratch shortcut is invalid: {error}"))?;
    if app_shortcuts_have_duplicates([
        open_palette_shortcut.as_str(),
        search_shortcut.as_str(),
        scratch_prompt_shortcut.as_str(),
        crate::hotkeys::DEFAULT_CONTEXT_PICKER_SHORTCUT,
    ]) {
        return Err("app shortcuts must be different".to_string());
    }

    let open_palette_shortcut_for_write = open_palette_shortcut.clone();
    let search_shortcut_for_write = search_shortcut.clone();
    let scratch_prompt_shortcut_for_write = scratch_prompt_shortcut.clone();
    let mut shortcut_sync = None;
    if let Err(error) = update_app_settings(&app, |settings| {
        let previous = settings.clone();
        settings.open_palette_shortcut = open_palette_shortcut_for_write;
        settings.search_shortcut = search_shortcut_for_write;
        settings.scratch_prompt_shortcut = scratch_prompt_shortcut_for_write;

        let sync = sync_app_shortcuts_for_app(&app, &state, settings)?;
        if !sync.errors.is_empty() {
            let _ = sync_app_shortcuts_for_app(&app, &state, &previous);
            return Err(sync.errors.join("; "));
        }

        shortcut_sync = Some(sync);
        Ok(())
    }) {
        let previous = load_effective_app_settings(&app);
        let _ = sync_app_shortcuts_for_app(&app, &state, &previous);
        return Err(error);
    }

    refresh_tray_menu(&app)?;
    Ok(AppShortcutUpdateResult {
        settings: load_effective_app_settings(&app),
        shortcut_sync: shortcut_sync
            .ok_or_else(|| "failed to synchronize app shortcuts".to_string())?,
    })
}

#[tauri::command]
pub fn accessibility_status(
    window: WebviewWindow,
    _app: AppHandle,
) -> Result<AccessibilityStatus, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    Ok(current_accessibility_status())
}

pub(crate) fn sync_app_shortcuts_for_app<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    settings: &AppSettings,
) -> Result<AppShortcutSyncResult, String> {
    unregister_previous_app_shortcuts(app, state)?;

    let mut registered = Vec::new();
    let mut errors = Vec::new();
    for (action, shortcut) in [
        (
            ShortcutAction::Palette,
            settings.open_palette_shortcut.as_str(),
        ),
        (ShortcutAction::Launcher, settings.search_shortcut.as_str()),
        (
            ShortcutAction::LauncherScratch,
            settings.scratch_prompt_shortcut.as_str(),
        ),
        (
            ShortcutAction::LauncherStack,
            crate::hotkeys::DEFAULT_CONTEXT_PICKER_SHORTCUT,
        ),
    ] {
        match register_app_shortcut(app, action, shortcut) {
            Ok(()) => registered.push(AppShortcutRegistration {
                action: app_shortcut_action_name(action),
                shortcut: shortcut.to_string(),
            }),
            Err(error) => errors.push(format!(
                "failed to register {} shortcut `{shortcut}`: {error}",
                app_shortcut_action_name(action)
            )),
        }
    }

    state.set_registered_app_shortcuts(
        registered
            .iter()
            .map(|registration| registration.shortcut.clone())
            .collect(),
    )?;

    Ok(AppShortcutSyncResult { registered, errors })
}

pub(super) fn registered_app_shortcut_set(
    state: &AppState,
    settings: &AppSettings,
) -> std::collections::HashSet<String> {
    let registered = state.registered_app_shortcuts().unwrap_or_default();
    if registered.is_empty() {
        return [
            settings.open_palette_shortcut.clone(),
            settings.search_shortcut.clone(),
            settings.scratch_prompt_shortcut.clone(),
            crate::hotkeys::DEFAULT_CONTEXT_PICKER_SHORTCUT.to_string(),
        ]
        .into_iter()
        .collect();
    }
    registered.into_iter().collect()
}

fn register_app_shortcut<R: Runtime>(
    app: &AppHandle<R>,
    action: ShortcutAction,
    shortcut: &str,
) -> Result<(), String> {
    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }
            handle_app_shortcut(app, action);
        })
        .map_err(|error| error.to_string())
}

fn unregister_previous_app_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<(), String> {
    for shortcut in state.take_registered_app_shortcuts()? {
        if let Err(error) = app.global_shortcut().unregister(shortcut.as_str()) {
            warn_event(
                app,
                "shortcuts",
                &format!("failed to unregister app shortcut `{shortcut}`: {error}"),
            );
        }
    }
    Ok(())
}

fn handle_app_shortcut<R: Runtime>(app: &AppHandle<R>, action: ShortcutAction) {
    match action {
        ShortcutAction::Palette => {
            if let Err(error) = show_prompt_palette_window(app) {
                error_event(
                    app,
                    "shortcuts",
                    "failed to open prompt palette from global shortcut",
                );
                tracing::debug!(error = %error, "open palette shortcut failed");
            }
        }
        ShortcutAction::Launcher => {
            if let Err(error) = show_launcher_window(app, LauncherMode::Search) {
                error_event(
                    app,
                    "shortcuts",
                    "failed to open launcher from global shortcut",
                );
                tracing::debug!(error = %error, "launcher shortcut failed");
            }
        }
        ShortcutAction::LauncherScratch => {
            if let Err(error) = show_launcher_window(app, LauncherMode::Scratch) {
                error_event(
                    app,
                    "shortcuts",
                    "failed to open launcher scratch from global shortcut",
                );
                tracing::debug!(error = %error, "launcher scratch shortcut failed");
            }
        }
        ShortcutAction::LauncherStack => {
            if let Err(error) = show_launcher_window(app, LauncherMode::Stack) {
                error_event(
                    app,
                    "shortcuts",
                    "failed to open launcher stack from global shortcut",
                );
                tracing::debug!(error = %error, "launcher stack shortcut failed");
            }
        }
    }
}

fn app_shortcut_action_name(action: ShortcutAction) -> &'static str {
    match action {
        ShortcutAction::Palette => "open-palette",
        ShortcutAction::Launcher => "open-launcher",
        ShortcutAction::LauncherScratch => "open-launcher-scratch",
        ShortcutAction::LauncherStack => "open-launcher-stack",
    }
}

fn app_shortcuts_have_duplicates<const N: usize>(shortcuts: [&str; N]) -> bool {
    let mut seen = std::collections::HashSet::new();
    shortcuts.into_iter().any(|shortcut| !seen.insert(shortcut))
}

pub(crate) fn apply_launch_at_login_setting<R: Runtime>(
    app: &AppHandle<R>,
    enabled: bool,
) -> Result<bool, String> {
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        let manager = app.autolaunch();
        if enabled {
            manager
                .enable()
                .map_err(|error| format!("failed to enable launch at login: {error}"))?;
        } else {
            manager
                .disable()
                .map_err(|error| format!("failed to disable launch at login: {error}"))?;
        }
        manager
            .is_enabled()
            .map_err(|error| format!("failed to read launch at login state: {error}"))
    }

    #[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
    {
        let _ = (app, enabled);
        Ok(false)
    }
}

pub(crate) fn launch_at_login_enabled<R: Runtime>(app: &AppHandle<R>) -> bool {
    #[cfg(any(target_os = "macos", windows, target_os = "linux"))]
    {
        app.autolaunch().is_enabled().unwrap_or(false)
    }

    #[cfg(not(any(target_os = "macos", windows, target_os = "linux")))]
    {
        let _ = app;
        false
    }
}
