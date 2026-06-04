use std::collections::HashMap;

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::intervention_library::{PromptArtifactType, PromptDefinition, PromptScope};
use crate::logging::{error_event, warn_event};
use crate::overlay_runtime::show_prompt_palette_window;
use crate::settings::load_app_settings_from_disk;
use crate::state::AppState;
use crate::windows::PALETTE_WINDOW;

#[derive(Debug, Serialize)]
pub struct PromptShortcutRegistration {
    pub prompt_id: String,
    pub shortcut: String,
}

#[derive(Debug, Serialize)]
pub struct PromptShortcutSyncResult {
    pub registered: Vec<PromptShortcutRegistration>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[tauri::command]
pub fn sync_intervention_shortcuts(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    artifacts: Vec<PromptDefinition>,
) -> Result<PromptShortcutSyncResult, String> {
    super::super::ensure_window(&window, &[PALETTE_WINDOW])?;
    sync_intervention_shortcuts_for_app(&app, &state, &artifacts)
}

pub(crate) fn sync_intervention_shortcuts_for_app<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    prompts: &[PromptDefinition],
) -> Result<PromptShortcutSyncResult, String> {
    unregister_previous_prompt_shortcuts(app, state)?;

    let app_shortcuts = super::super::settings_commands::registered_app_shortcut_set(
        state,
        &load_app_settings_from_disk(app),
    );
    let mut seen = HashMap::<String, String>::new();
    let mut registered = Vec::new();
    let warnings = Vec::new();
    let mut errors = Vec::new();

    for prompt in prompts {
        if prompt.artifact_type != PromptArtifactType::Prompt
            || prompt.scope != PromptScope::Persistent
        {
            continue;
        }
        let Some(shortcut) = prompt.shortcut.as_deref() else {
            continue;
        };
        let normalized = match crate::hotkeys::normalize_shortcut(shortcut) {
            Ok(normalized) => normalized,
            Err(error) => {
                errors.push(format!(
                    "prompt `{}` shortcut `{shortcut}` is invalid: {error}",
                    prompt.id
                ));
                continue;
            }
        };

        if app_shortcuts.contains(&normalized) {
            errors.push(format!(
                "prompt `{}` shortcut `{shortcut}` collides with a Ult app shortcut",
                prompt.id
            ));
            continue;
        }

        if let Some(previous_id) = seen.insert(normalized.clone(), prompt.id.clone()) {
            errors.push(format!(
                "prompt `{}` shortcut `{shortcut}` duplicates `{previous_id}`",
                prompt.id
            ));
            continue;
        }

        let prompt_id = prompt.id.clone();
        match app.global_shortcut().on_shortcut(
            normalized.as_str(),
            move |app, _shortcut, event| {
                if event.state != ShortcutState::Pressed {
                    return;
                }
                handle_prompt_shortcut(app, &prompt_id);
            },
        ) {
            Ok(()) => registered.push(PromptShortcutRegistration {
                prompt_id: prompt.id.clone(),
                shortcut: normalized,
            }),
            Err(error) => errors.push(format!(
                "failed to register shortcut `{shortcut}` for prompt `{}`: {error}",
                prompt.id
            )),
        }
    }

    state.set_registered_prompt_shortcuts(
        registered
            .iter()
            .map(|registration| registration.shortcut.clone())
            .collect(),
    )?;

    Ok(PromptShortcutSyncResult {
        registered,
        warnings,
        errors,
    })
}

fn unregister_previous_prompt_shortcuts<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
) -> Result<(), String> {
    for shortcut in state.take_registered_prompt_shortcuts()? {
        if let Err(error) = app.global_shortcut().unregister(shortcut.as_str()) {
            warn_event(
                app,
                "shortcuts",
                &format!("failed to unregister intervention shortcut `{shortcut}`: {error}"),
            );
        }
    }
    Ok(())
}

fn handle_prompt_shortcut<R: Runtime>(app: &AppHandle<R>, prompt_id: &str) {
    if let Err(error) = app
        .state::<AppState>()
        .set_selected_artifact_id(prompt_id.to_string())
    {
        error_event(
            app,
            "intervention-shortcuts",
            "failed to select intervention from shortcut",
        );
        tracing::debug!(error = %error, prompt_id, "intervention shortcut selection failed");
        return;
    }

    if let Err(error) = show_prompt_palette_window(app) {
        error_event(
            app,
            "intervention-shortcuts",
            "failed to open palette from intervention shortcut",
        );
        tracing::debug!(error = %error, prompt_id, "intervention shortcut open failed");
    }
}
