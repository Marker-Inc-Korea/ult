use serde::Serialize;
use tauri::{AppHandle, Runtime, State};

use crate::clipboard_delivery::{
    copy_for_delivery, ClipboardDeliveryCommandStatus, ClipboardDeliveryFailure,
    ClipboardDeliveryRequest, ClipboardDeliverySuccess,
};
use crate::delivery_result_mapper::{delivery_result_payload, PromptExecutionMetadata};
#[cfg(target_os = "macos")]
use crate::delivery_supervisor::{spawn_prompt_delivery, DeliveryRequest};
use crate::modes::DeliveryMode;
use crate::overlay_events::{DeliveryDiagnosticCode, DeliveryResultStatus, PromptExecutionKind};
use crate::overlay_runtime::{
    emit_delivery_result_to_palette, prepare_palette_window_for_permission_prompt,
    unload_overlay_from_app,
};
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeliveryCommandStatus {
    Started,
    Copied,
    Blocked,
}

#[derive(Debug, Serialize)]
pub struct DeliveryCommandResult {
    pub delivery_id: u64,
    pub status: DeliveryCommandStatus,
    pub message: String,
    pub diagnostic_code: Option<DeliveryDiagnosticCode>,
}

#[derive(Clone, Copy)]
struct NativeDeliveryBlock {
    message: &'static str,
    diagnostic_code: DeliveryDiagnosticCode,
}

pub fn deliver_prompt_at_pointer(
    app: AppHandle,
    state: State<AppState>,
    text: String,
    mode: DeliveryMode,
    prompt_id: Option<String>,
    prompt_kind: PromptExecutionKind,
) -> Result<DeliveryCommandResult, String> {
    let delivery_id = state.next_delivery_id()?;

    if mode == DeliveryMode::Copy {
        return complete_clipboard_delivery(
            &app,
            copy_for_delivery(ClipboardDeliveryRequest {
                delivery_id,
                prompt_id,
                prompt_kind,
                mode,
                text: &text,
                status: DeliveryResultStatus::Copied,
                message: "Copied",
                diagnostic_code: DeliveryDiagnosticCode::CopyMode,
                command_status: ClipboardDeliveryCommandStatus::Copied,
            }),
        );
    }

    #[cfg(target_os = "macos")]
    if let Some(block) =
        native_delivery_permission_block(mode, crate::delivery::accessibility_permission_status())
    {
        let result = complete_delivery_blocked_command(
            &app,
            delivery_id,
            prompt_id,
            prompt_kind,
            mode,
            block.message,
            block.diagnostic_code,
        );
        if should_keep_overlay_for_permission_handoff(block.diagnostic_code) {
            let _ = prepare_palette_window_for_permission_prompt(&app);
            request_accessibility_prompt_for_blocked_delivery();
        } else {
            let _ = unload_overlay_from_app(&app);
        }
        return result;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let result = complete_delivery_blocked_command(
            &app,
            delivery_id,
            prompt_id,
            prompt_kind,
            mode,
            "Native Delivery unavailable",
            DeliveryDiagnosticCode::NativeUnavailable,
        );
        let _ = unload_overlay_from_app(&app);
        return result;
    }

    #[cfg(target_os = "macos")]
    {
        let generation = state.start_delivery()?;
        emit_delivery_result_to_palette(
            &app,
            delivery_result_payload(
                delivery_id,
                PromptExecutionMetadata {
                    prompt_id: prompt_id.clone(),
                    prompt_kind,
                },
                mode,
                DeliveryResultStatus::Started,
                "Applying",
                false,
                None,
            ),
        );
        spawn_prompt_delivery(DeliveryRequest {
            app,
            text,
            mode,
            generation,
            delivery_id,
            prompt_id,
            prompt_kind,
        });
        Ok(delivery_command_result(
            delivery_id,
            DeliveryCommandStatus::Started,
            "Applying",
            None,
        ))
    }
}

fn native_delivery_permission_block(
    mode: DeliveryMode,
    accessibility_trusted: bool,
) -> Option<NativeDeliveryBlock> {
    if mode.requires_accessibility() && !accessibility_trusted {
        return Some(NativeDeliveryBlock {
            message: "Accessibility permission required",
            diagnostic_code: DeliveryDiagnosticCode::AccessibilityRequired,
        });
    }
    None
}

fn should_keep_overlay_for_permission_handoff(diagnostic_code: DeliveryDiagnosticCode) -> bool {
    diagnostic_code == DeliveryDiagnosticCode::AccessibilityRequired
}

#[cfg(target_os = "macos")]
fn request_accessibility_prompt_for_blocked_delivery() {
    if !crate::delivery::request_accessibility_permission_prompt() {
        tracing::debug!("requested macOS Accessibility permission prompt for blocked delivery");
    }
}

fn complete_clipboard_delivery<R: Runtime>(
    app: &AppHandle<R>,
    result: Result<ClipboardDeliverySuccess, Box<ClipboardDeliveryFailure>>,
) -> Result<DeliveryCommandResult, String> {
    match result {
        Ok(success) => {
            let delivery_id = success.payload.delivery_id;
            let diagnostic_code = success.payload.diagnostic.as_ref().map(|entry| entry.code);
            emit_delivery_result_to_palette(app, success.payload);
            Ok(delivery_command_result(
                delivery_id,
                delivery_command_status_from_clipboard_delivery(success.command_status),
                success.message,
                diagnostic_code,
            ))
        }
        Err(failure) => {
            emit_delivery_result_to_palette(app, failure.payload);
            Err(failure.error)
        }
    }
}

fn complete_delivery_blocked_command<R: Runtime>(
    app: &AppHandle<R>,
    delivery_id: u64,
    prompt_id: Option<String>,
    prompt_kind: PromptExecutionKind,
    mode: DeliveryMode,
    message: &str,
    diagnostic_code: DeliveryDiagnosticCode,
) -> Result<DeliveryCommandResult, String> {
    emit_delivery_result_to_palette(
        app,
        delivery_result_payload(
            delivery_id,
            PromptExecutionMetadata {
                prompt_id,
                prompt_kind,
            },
            mode,
            DeliveryResultStatus::Failed,
            message,
            false,
            Some(diagnostic_code),
        ),
    );
    Ok(delivery_command_result(
        delivery_id,
        DeliveryCommandStatus::Blocked,
        message,
        Some(diagnostic_code),
    ))
}

fn delivery_command_status_from_clipboard_delivery(
    status: ClipboardDeliveryCommandStatus,
) -> DeliveryCommandStatus {
    match status {
        ClipboardDeliveryCommandStatus::Copied => DeliveryCommandStatus::Copied,
    }
}

fn delivery_command_result(
    delivery_id: u64,
    status: DeliveryCommandStatus,
    message: &str,
    diagnostic_code: Option<DeliveryDiagnosticCode>,
) -> DeliveryCommandResult {
    DeliveryCommandResult {
        delivery_id,
        status,
        message: message.to_string(),
        diagnostic_code,
    }
}

#[cfg(test)]
mod tests {
    use super::{native_delivery_permission_block, should_keep_overlay_for_permission_handoff};
    use crate::modes::DeliveryMode;
    use crate::overlay_events::DeliveryDiagnosticCode;

    #[test]
    fn copy_mode_does_not_require_accessibility() {
        assert!(native_delivery_permission_block(DeliveryMode::Copy, false).is_none());
    }

    #[test]
    fn native_delivery_modes_report_accessibility_block() {
        for mode in [
            DeliveryMode::Paste,
            DeliveryMode::Send,
            DeliveryMode::InterruptSend,
        ] {
            let block = native_delivery_permission_block(mode, false).expect("block");
            assert_eq!(block.message, "Accessibility permission required");
            assert_eq!(
                block.diagnostic_code,
                DeliveryDiagnosticCode::AccessibilityRequired
            );
            assert!(native_delivery_permission_block(mode, true).is_none());
        }
    }

    #[test]
    fn accessibility_permission_handoff_keeps_overlay_window_alive() {
        assert!(should_keep_overlay_for_permission_handoff(
            DeliveryDiagnosticCode::AccessibilityRequired
        ));
        assert!(!should_keep_overlay_for_permission_handoff(
            DeliveryDiagnosticCode::NativeUnavailable
        ));
    }
}
