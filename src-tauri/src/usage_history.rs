use std::fs::{self, OpenOptions};
use std::io::Write;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::atomic_write::write_atomic;
use crate::config_lock::with_config_write_lock;
use crate::modes::DeliveryMode;
use crate::overlay_events::{
    DeliveryDiagnosticCode, DeliveryResultPayload, DeliveryResultStatus, DeliveryTargetApplication,
    PromptExecutionKind,
};
const HISTORY_FILE: &str = "usage-history.jsonl";
const DEFAULT_HISTORY_LIMIT: usize = 25;
const MAX_HISTORY_LIMIT: usize = 200;
const HISTORY_RETAIN_LIMIT: usize = MAX_HISTORY_LIMIT;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageHistoryEntry {
    pub timestamp_ms: u64,
    pub prompt_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_kind: Option<PromptExecutionKind>,
    pub delivery_mode: DeliveryMode,
    pub result: DeliveryResultStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub diagnostic_code: Option<DeliveryDiagnosticCode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_application: Option<DeliveryTargetApplication>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<UsageHistoryProjectMetadata>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UsageHistoryProjectMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub basename: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path_hash: Option<String>,
}

pub fn append_delivery_result<R: Runtime>(
    app: &AppHandle<R>,
    result: &DeliveryResultPayload,
) -> Result<(), String> {
    with_config_write_lock(|| append_delivery_result_unlocked(app, result))
}

fn append_delivery_result_unlocked<R: Runtime>(
    app: &AppHandle<R>,
    result: &DeliveryResultPayload,
) -> Result<(), String> {
    if !result.status.is_terminal() {
        return Ok(());
    }

    let entry = usage_history_entry_from_delivery_result(result);

    let path = history_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create usage history directory: {error}"))?;
    }

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("failed to open usage history: {error}"))?;
    let line = serde_json::to_string(&entry)
        .map_err(|error| format!("failed to serialize usage history entry: {error}"))?;
    writeln!(file, "{line}").map_err(|error| format!("failed to write usage history: {error}"))?;

    compact_usage_history_file(&path, HISTORY_RETAIN_LIMIT)
}

pub fn load_usage_history<R: Runtime>(
    app: &AppHandle<R>,
    limit: Option<usize>,
) -> Result<Vec<UsageHistoryEntry>, String> {
    let path = history_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let contents = fs::read_to_string(&path)
        .map_err(|error| format!("failed to read usage history: {error}"))?;
    Ok(parse_history_contents(&contents, limit))
}

fn parse_history_contents(contents: &str, limit: Option<usize>) -> Vec<UsageHistoryEntry> {
    let limit = history_limit(limit);
    let mut entries = contents
        .lines()
        .filter_map(|line| serde_json::from_str::<UsageHistoryEntry>(line).ok())
        .collect::<Vec<_>>();
    entries.reverse();
    entries.truncate(limit);
    entries
}

fn history_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(DEFAULT_HISTORY_LIMIT)
        .clamp(1, MAX_HISTORY_LIMIT)
}

pub fn history_path<R: Runtime>(app: &AppHandle<R>) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config directory: {error}"))?
        .join(HISTORY_FILE))
}

fn compact_usage_history_file(path: &std::path::Path, retain_limit: usize) -> Result<(), String> {
    let contents = fs::read_to_string(path)
        .map_err(|error| format!("failed to read usage history for compaction: {error}"))?;
    let compacted = compact_history_contents(&contents, retain_limit);
    if compacted == contents {
        return Ok(());
    }
    write_atomic(path, compacted.as_bytes(), HISTORY_FILE)
}

fn compact_history_contents(contents: &str, retain_limit: usize) -> String {
    let retain_limit = retain_limit.clamp(1, MAX_HISTORY_LIMIT);
    let mut lines = contents
        .lines()
        .filter(|line| serde_json::from_str::<UsageHistoryEntry>(line).is_ok())
        .map(str::to_string)
        .collect::<Vec<_>>();
    let keep_from = lines.len().saturating_sub(retain_limit);
    lines.drain(0..keep_from);

    if lines.is_empty() {
        return String::new();
    }

    let mut compacted = lines.join("\n");
    compacted.push('\n');
    compacted
}

fn usage_history_entry_from_delivery_result(result: &DeliveryResultPayload) -> UsageHistoryEntry {
    UsageHistoryEntry {
        timestamp_ms: result.timestamp_ms,
        prompt_id: result.prompt_id.clone(),
        prompt_kind: Some(result.prompt_kind),
        delivery_mode: result.mode,
        result: result.status.clone(),
        diagnostic_code: result.diagnostic.as_ref().map(|diagnostic| diagnostic.code),
        target_application: result.target_application.clone(),
        project: None,
    }
}

#[cfg(test)]
fn unix_timestamp_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::{
        compact_history_contents, parse_history_contents, unix_timestamp_ms,
        usage_history_entry_from_delivery_result, UsageHistoryEntry,
    };
    use crate::modes::DeliveryMode;
    use crate::overlay_events::{
        DeliveryDiagnostic, DeliveryDiagnosticCode, DeliveryResultPayload, DeliveryResultStatus,
        DeliveryTargetApplication, PromptExecutionKind,
    };

    #[test]
    fn timestamp_is_available() {
        assert!(unix_timestamp_ms() > 0);
    }

    #[test]
    fn compacts_history_to_recent_valid_entries() {
        let entries = (0..5)
            .map(|index| UsageHistoryEntry {
                timestamp_ms: index,
                prompt_id: Some(format!("prompt-{index}")),
                prompt_kind: Some(PromptExecutionKind::Bundled),
                delivery_mode: DeliveryMode::Send,
                result: DeliveryResultStatus::Delivered,
                diagnostic_code: None,
                target_application: None,
                project: None,
            })
            .map(|entry| serde_json::to_string(&entry).expect("entry"))
            .collect::<Vec<_>>();
        let contents = format!(
            "{}\nnot json\n{}\n{}\n{}\n{}\n",
            entries[0], entries[1], entries[2], entries[3], entries[4]
        );

        let compacted = compact_history_contents(&contents, 3);

        assert!(!compacted.contains("not json"));
        assert!(!compacted.contains("prompt-0"));
        assert!(compacted.contains("prompt-2"));
        assert!(compacted.contains("prompt-4"));
        assert!(compacted.ends_with('\n'));
    }

    #[test]
    fn parses_history_newest_first_with_clamped_limit() {
        let contents = (0..205)
            .map(|index| {
                serde_json::to_string(&UsageHistoryEntry {
                    timestamp_ms: index,
                    prompt_id: Some(format!("prompt-{index}")),
                    prompt_kind: Some(PromptExecutionKind::Bundled),
                    delivery_mode: DeliveryMode::Paste,
                    result: DeliveryResultStatus::Delivered,
                    diagnostic_code: None,
                    target_application: None,
                    project: None,
                })
                .expect("entry")
            })
            .collect::<Vec<_>>()
            .join("\n");

        let entries = parse_history_contents(&contents, Some(usize::MAX));

        assert_eq!(entries.len(), 200);
        assert_eq!(entries[0].timestamp_ms, 204);
        assert_eq!(entries[199].timestamp_ms, 5);
    }

    #[test]
    fn scratch_delivery_history_keeps_only_generic_metadata() {
        let scratch_text = "private scratch text that must not be stored";
        let entry = usage_history_entry_from_delivery_result(&DeliveryResultPayload {
            delivery_id: 1,
            timestamp_ms: 42,
            prompt_id: None,
            prompt_kind: PromptExecutionKind::Scratch,
            mode: DeliveryMode::Paste,
            execution_state: crate::overlay_events::PromptExecutionState::Delivered,
            status: DeliveryResultStatus::Delivered,
            message: format!("Delivered {scratch_text}"),
            clipboard_restored: true,
            target_application: None,
            diagnostic: None,
        });

        let serialized = serde_json::to_string(&entry).expect("entry");
        assert_eq!(entry.prompt_id, None);
        assert_eq!(entry.prompt_kind, Some(PromptExecutionKind::Scratch));
        assert_eq!(entry.timestamp_ms, 42);
        assert_eq!(entry.diagnostic_code, None);
        assert_eq!(entry.project, None);
        assert!(serialized.contains(r#""prompt_id":null"#));
        assert!(serialized.contains(r#""prompt_kind":"scratch""#));
        assert!(serialized.contains(r#""delivery_mode":"paste""#));
        assert!(!serialized.contains(r#""project""#));
        assert!(!serialized.contains(scratch_text));
    }

    #[test]
    fn failed_delivery_history_keeps_metadata_without_failure_text() {
        let private_text = "private prompt body and terminal context";
        let entry = usage_history_entry_from_delivery_result(&DeliveryResultPayload {
            delivery_id: 7,
            timestamp_ms: 99,
            prompt_id: Some("review-pr".to_string()),
            prompt_kind: PromptExecutionKind::Template,
            mode: DeliveryMode::InterruptSend,
            execution_state: crate::overlay_events::PromptExecutionState::Failed,
            status: DeliveryResultStatus::Failed,
            message: format!("Failed while delivering {private_text}"),
            clipboard_restored: false,
            target_application: Some(DeliveryTargetApplication {
                bundle_id: "com.apple.Terminal".to_string(),
                name: "Terminal".to_string(),
            }),
            diagnostic: Some(DeliveryDiagnostic {
                code: DeliveryDiagnosticCode::InterruptFailed,
                summary: format!("Could not send {private_text}"),
                action: "Retry from a focused terminal.".to_string(),
            }),
        });

        let serialized = serde_json::to_string(&entry).expect("entry");
        assert_eq!(entry.prompt_id.as_deref(), Some("review-pr"));
        assert_eq!(entry.prompt_kind, Some(PromptExecutionKind::Template));
        assert_eq!(entry.delivery_mode, DeliveryMode::InterruptSend);
        assert_eq!(entry.result, DeliveryResultStatus::Failed);
        assert_eq!(
            entry.diagnostic_code,
            Some(DeliveryDiagnosticCode::InterruptFailed)
        );
        assert!(serialized.contains(r#""target_application""#));
        assert!(serialized.contains(r#""diagnostic_code":"interrupt-failed""#));
        assert!(serialized.contains(r#""Terminal""#));
        assert!(!serialized.contains(r#""project""#));
        assert!(!serialized.contains(private_text));
        assert!(!serialized.contains("Could not send"));
        assert!(!serialized.contains("Retry from a focused terminal"));
    }

    #[test]
    fn project_metadata_schema_accepts_only_privacy_safe_fields() {
        let contents = r#"{"timestamp_ms":1,"prompt_id":"review","prompt_kind":"local","delivery_mode":"send","result":"delivered","project":{"basename":"ult","path_hash":"sha256:abcdef"}}"#;

        let entries = parse_history_contents(contents, Some(1));

        let project = entries[0].project.as_ref().expect("project");
        assert_eq!(project.basename.as_deref(), Some("ult"));
        assert_eq!(project.path_hash.as_deref(), Some("sha256:abcdef"));
    }

    #[test]
    fn project_metadata_is_not_collected_without_resolver() {
        let entry = usage_history_entry_from_delivery_result(&DeliveryResultPayload {
            delivery_id: 3,
            timestamp_ms: 100,
            prompt_id: Some("review".to_string()),
            prompt_kind: PromptExecutionKind::Local,
            mode: DeliveryMode::Send,
            execution_state: crate::overlay_events::PromptExecutionState::Delivered,
            status: DeliveryResultStatus::Delivered,
            message: "Delivered".to_string(),
            clipboard_restored: true,
            target_application: Some(DeliveryTargetApplication {
                bundle_id: "com.apple.Terminal".to_string(),
                name: "Terminal".to_string(),
            }),
            diagnostic: None,
        });

        assert_eq!(entry.project, None);
    }
}
