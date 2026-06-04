use tauri::{AppHandle, Runtime};

use crate::intervention_library::{load_intervention_library_from_disk, PromptLoadResult};
use crate::logging::{error_event, info_event, warn_event};
use crate::state::AppState;

pub(crate) fn load_prompt_cache_for_app<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    reload: bool,
) -> Result<PromptLoadResult, String> {
    if !reload {
        if let Some(result) = state.prompt_cache()? {
            return Ok(result);
        }
    }

    let mut result = load_intervention_library_from_disk(app);
    match super::shortcut_sync::sync_intervention_shortcuts_for_app(app, state, &result.artifacts) {
        Ok(sync) => {
            for warning in sync.warnings {
                result.warnings.push(warning);
            }
            for error in sync.errors {
                result.errors.push(error);
            }
        }
        Err(error) => {
            error_event(
                app,
                "intervention-shortcuts",
                "failed to synchronize intervention shortcuts",
            );
            result.errors.push(format!(
                "failed to synchronize intervention shortcuts: {error}"
            ));
        }
    }

    let artifact_count = result.artifacts.len();
    let warning_count = result.warnings.len();
    let error_count = result.errors.len();
    state.set_prompt_cache(result.clone())?;
    if reload {
        info_event(app, "intervention-library", "intervention library reloaded");
    } else {
        info_event(app, "intervention-library", "intervention library loaded");
    }
    if warning_count > 0 {
        warn_event(
            app,
            "intervention-library",
            &format!("intervention library loaded with {warning_count} warning(s)"),
        );
    }
    if error_count > 0 {
        error_event(
            app,
            "intervention-library",
            &format!("intervention library loaded with {error_count} error(s)"),
        );
    }
    info_event(
        app,
        "intervention-library",
        &format!("intervention library has {artifact_count} artifact(s)"),
    );
    Ok(result)
}
