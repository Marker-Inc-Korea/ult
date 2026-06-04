use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow};

use crate::atomic_write::write_atomic;
use crate::intervention_library::load_intervention_library_from_disk;
use crate::overlay_events::DeliveryResultPayload;
use crate::overlay_runtime;
use crate::state::AppState;
use crate::usage_history::{self, UsageHistoryEntry};
use crate::windows::{PALETTE_WINDOW, SETTINGS_WINDOW};

use super::{current_accessibility_status, ensure_window, AccessibilityStatus};

#[derive(Debug, Serialize)]
pub struct AppDiagnostics {
    pub app_version: &'static str,
    pub config_path: String,
    pub accessibility: AccessibilityStatus,
    pub app_identity: AppIdentityDiagnostics,
    pub overlay_coordinates: overlay_runtime::OverlayCoordinateDiagnostics,
    pub app_shortcuts: Vec<String>,
    pub last_delivery_result: Option<DeliveryResultPayload>,
    pub recent_history: Vec<UsageHistoryEntry>,
}

#[derive(Debug, Serialize)]
pub struct AppIdentityDiagnostics {
    pub bundle_identifier: String,
    pub running_path: String,
    pub launch_kind: String,
    pub signing_status: String,
    pub accessibility_identity_note: String,
    pub stale_permission_reset_command: String,
}

#[derive(Debug, Serialize)]
pub struct DiagnosticsExportResult {
    pub file_path: String,
    pub failure_count: usize,
}

#[derive(Debug, Serialize)]
struct DiagnosticsExport {
    generated_at_ms: u64,
    app_version: &'static str,
    bundle_identifier: String,
    accessibility: AccessibilityStatus,
    paths: DiagnosticsExportPaths,
    app_shortcuts: Vec<String>,
    recent_failures: Vec<UsageHistoryEntry>,
}

#[derive(Debug, Serialize)]
struct DiagnosticsExportPaths {
    app_config_dir: String,
    ult_home: String,
    personal_library: String,
    usage_history: String,
}

#[tauri::command]
pub fn load_app_diagnostics(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<AppDiagnostics, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let config_path = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config directory: {error}"))?;
    let recent_history = crate::usage_history::load_usage_history(&app, Some(5))?;
    let app_shortcuts = state.registered_app_shortcuts()?;

    Ok(AppDiagnostics {
        app_version: env!("CARGO_PKG_VERSION"),
        config_path: config_path.display().to_string(),
        accessibility: current_accessibility_status(),
        app_identity: app_identity_diagnostics(&app),
        overlay_coordinates: overlay_runtime::coordinate_diagnostics(&app),
        app_shortcuts,
        last_delivery_result: state.last_delivery_result()?,
        recent_history,
    })
}

#[tauri::command]
pub fn load_usage_history(
    window: WebviewWindow,
    app: AppHandle,
    limit: Option<usize>,
) -> Result<Vec<UsageHistoryEntry>, String> {
    ensure_window(&window, &[PALETTE_WINDOW, SETTINGS_WINDOW])?;
    crate::usage_history::load_usage_history(&app, limit)
}

#[tauri::command]
pub fn export_app_diagnostics(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
) -> Result<DiagnosticsExportResult, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let generated_at_ms = unix_timestamp_ms();
    let app_config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config directory: {error}"))?;
    fs::create_dir_all(&app_config_dir)
        .map_err(|error| format!("failed to create diagnostics export directory: {error}"))?;

    let library = load_intervention_library_from_disk(&app);
    let history_path = usage_history::history_path(&app)?;
    let recent_failures =
        diagnostics_failure_entries(usage_history::load_usage_history(&app, Some(50))?);
    let failure_count = recent_failures.len();
    let export = DiagnosticsExport {
        generated_at_ms,
        app_version: env!("CARGO_PKG_VERSION"),
        bundle_identifier: app.config().identifier.clone(),
        accessibility: current_accessibility_status(),
        paths: DiagnosticsExportPaths {
            app_config_dir: app_config_dir.display().to_string(),
            ult_home: library.config_path,
            personal_library: library.registry_path,
            usage_history: history_path.display().to_string(),
        },
        app_shortcuts: state.registered_app_shortcuts()?,
        recent_failures,
    };
    let contents = serde_json::to_vec_pretty(&export)
        .map_err(|error| format!("failed to serialize diagnostics export: {error}"))?;
    let export_path = app_config_dir.join(format!("ult-diagnostics-{generated_at_ms}.json"));
    write_atomic(&export_path, &contents, "diagnostics-export.json")?;

    Ok(DiagnosticsExportResult {
        file_path: export_path.display().to_string(),
        failure_count,
    })
}

fn diagnostics_failure_entries(entries: Vec<UsageHistoryEntry>) -> Vec<UsageHistoryEntry> {
    entries
        .into_iter()
        .filter(|entry| {
            !matches!(
                entry.result,
                crate::overlay_events::DeliveryResultStatus::Delivered
                    | crate::overlay_events::DeliveryResultStatus::Copied
            )
        })
        .collect()
}

fn app_identity_diagnostics<R: Runtime>(app: &AppHandle<R>) -> AppIdentityDiagnostics {
    let running_path = std::env::current_exe().ok();
    let running_path_text = running_path
        .as_ref()
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| "Unknown".to_string());
    let launch_kind = running_path
        .as_deref()
        .map(classify_launch_kind)
        .unwrap_or("Unknown")
        .to_string();
    let signing_status = running_path
        .as_deref()
        .map(signing_status_for_path)
        .unwrap_or_else(|| "Could not resolve running executable.".to_string());

    AppIdentityDiagnostics {
        bundle_identifier: app.config().identifier.clone(),
        running_path: running_path_text,
        launch_kind,
        signing_status,
        accessibility_identity_note: "Development builds may appear in Accessibility as a debug executable path. Packaged, consistently signed .app builds should appear as Ult.".to_string(),
        stale_permission_reset_command: format!(
            "tccutil reset Accessibility {}",
            app.config().identifier
        ),
    }
}

fn unix_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn classify_launch_kind(path: &Path) -> &'static str {
    let path_text = path.to_string_lossy();
    if path_text.contains(".app/Contents/MacOS/") {
        "Packaged .app"
    } else if path_text.contains("/src-tauri/target/")
        || path_text.contains("/target/debug/")
        || path_text.contains("/target/release/")
    {
        "Development binary"
    } else {
        "Standalone binary"
    }
}

fn signing_status_for_path(path: &Path) -> String {
    #[cfg(target_os = "macos")]
    {
        let target = app_bundle_root(path).unwrap_or_else(|| path.to_path_buf());
        let output = Command::new("codesign")
            .args(["--verify", "--deep", "--strict", "--verbose=2"])
            .arg(&target)
            .output();
        let Ok(output) = output else {
            return "codesign unavailable.".to_string();
        };
        if output.status.success() {
            return "Valid signature".to_string();
        }
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = stderr
            .lines()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("Signature verification failed");
        format!("Not verified: {message}")
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        "Not checked on this platform".to_string()
    }
}

#[cfg(target_os = "macos")]
fn app_bundle_root(path: &Path) -> Option<PathBuf> {
    for ancestor in path.ancestors() {
        if ancestor.extension().and_then(|value| value.to_str()) == Some("app") {
            return Some(ancestor.to_path_buf());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::diagnostics_failure_entries;
    use crate::modes::DeliveryMode;
    use crate::overlay_events::{
        DeliveryDiagnosticCode, DeliveryResultStatus, DeliveryTargetApplication,
        PromptExecutionKind,
    };
    use crate::usage_history::UsageHistoryEntry;

    #[test]
    fn diagnostics_export_keeps_failure_metadata_only() {
        let private_text = "terminal contents and prompt body must stay out";
        let entries = vec![
            UsageHistoryEntry {
                timestamp_ms: 10,
                prompt_id: Some("safe-handle".to_string()),
                prompt_kind: Some(PromptExecutionKind::Template),
                delivery_mode: DeliveryMode::Send,
                result: DeliveryResultStatus::Failed,
                diagnostic_code: Some(DeliveryDiagnosticCode::FocusTimeout),
                target_application: Some(DeliveryTargetApplication {
                    bundle_id: "com.apple.Terminal".to_string(),
                    name: "Terminal".to_string(),
                }),
                project: None,
            },
            UsageHistoryEntry {
                timestamp_ms: 9,
                prompt_id: Some(private_text.to_string()),
                prompt_kind: Some(PromptExecutionKind::Local),
                delivery_mode: DeliveryMode::Paste,
                result: DeliveryResultStatus::Delivered,
                diagnostic_code: None,
                target_application: None,
                project: None,
            },
        ];

        let failures = diagnostics_failure_entries(entries);
        let serialized = serde_json::to_string(&failures).expect("export");

        assert_eq!(failures.len(), 1);
        assert!(serialized.contains("safe-handle"));
        assert!(serialized.contains("focus-timeout"));
        assert!(serialized.contains("Terminal"));
        assert!(!serialized.contains(private_text));
    }
}
