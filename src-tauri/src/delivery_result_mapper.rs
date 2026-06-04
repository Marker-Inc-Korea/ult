use crate::delivery::{DeliveryBlockedReason, DeliveryFailureReason, DeliveryOutcome};
use crate::modes::DeliveryMode;
use crate::overlay_events::{
    DeliveryDiagnostic, DeliveryDiagnosticCode, DeliveryResultPayload, DeliveryResultStatus,
    PromptExecutionKind, PromptExecutionState,
};

#[derive(Clone, Debug)]
pub(crate) struct PromptExecutionMetadata {
    pub prompt_id: Option<String>,
    pub prompt_kind: PromptExecutionKind,
}

pub(crate) fn delivery_result_payload(
    delivery_id: u64,
    metadata: PromptExecutionMetadata,
    mode: DeliveryMode,
    status: DeliveryResultStatus,
    message: &str,
    clipboard_restored: bool,
    diagnostic_code: Option<DeliveryDiagnosticCode>,
) -> DeliveryResultPayload {
    DeliveryResultPayload {
        delivery_id,
        timestamp_ms: unix_timestamp_ms(),
        prompt_id: metadata.prompt_id,
        prompt_kind: metadata.prompt_kind,
        mode,
        execution_state: execution_state_for_status(&status, diagnostic_code),
        status,
        message: message.to_string(),
        clipboard_restored,
        target_application: None,
        diagnostic: diagnostic_code.map(delivery_diagnostic),
    }
}

fn execution_state_for_status(
    status: &DeliveryResultStatus,
    diagnostic_code: Option<DeliveryDiagnosticCode>,
) -> PromptExecutionState {
    match status {
        DeliveryResultStatus::Started => PromptExecutionState::Applying,
        DeliveryResultStatus::Delivered => PromptExecutionState::Delivered,
        DeliveryResultStatus::Copied => PromptExecutionState::Clipboard,
        DeliveryResultStatus::Cancelled | DeliveryResultStatus::Failed => {
            if diagnostic_code == Some(DeliveryDiagnosticCode::AccessibilityRequired) {
                PromptExecutionState::BlockedPermission
            } else {
                PromptExecutionState::Failed
            }
        }
    }
}

fn unix_timestamp_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn delivery_diagnostic(code: DeliveryDiagnosticCode) -> DeliveryDiagnostic {
    let (summary, action) = match code {
        DeliveryDiagnosticCode::CopyMode => ("Copied to clipboard.", "Paste manually when ready."),
        DeliveryDiagnosticCode::AccessibilityRequired => (
            "Native Delivery is blocked by missing Accessibility permission.",
            "Grant Ult access in macOS Privacy & Security > Accessibility.",
        ),
        DeliveryDiagnosticCode::NativeUnavailable => (
            "Native delivery is not available on this platform.",
            "Run the macOS app for paste/send delivery.",
        ),
        DeliveryDiagnosticCode::PointerUnavailable => (
            "The app could not read the current pointer location.",
            "Open the palette again and apply while the cursor is over the target app.",
        ),
        DeliveryDiagnosticCode::TargetUnavailable => (
            "No target application was found under the pointer.",
            "Apply over a visible target app, or switch the loaded item to Copy.",
        ),
        DeliveryDiagnosticCode::ClickFailed => (
            "The app could not click the target before delivery.",
            "Retry over a focused target app.",
        ),
        DeliveryDiagnosticCode::FocusTimeout => (
            "The target did not become frontmost before delivery timed out.",
            "Click the target app once, then apply the intervention again.",
        ),
        DeliveryDiagnosticCode::PasteboardWriteFailed => (
            "The prompt could not be staged on the macOS pasteboard.",
            "Check clipboard manager restrictions and retry.",
        ),
        DeliveryDiagnosticCode::PasteFailed => (
            "The paste shortcut could not be sent.",
            "Focus the target app and retry Paste.",
        ),
        DeliveryDiagnosticCode::SendFailed => (
            "The paste-and-enter sequence could not be sent.",
            "Focus the target app and retry Paste + Enter.",
        ),
        DeliveryDiagnosticCode::InterruptFailed => (
            "The interrupt-and-send sequence could not be sent.",
            "Focus the target app and retry Interrupt + Enter.",
        ),
        DeliveryDiagnosticCode::NativeKeyFailed => (
            "The native key sequence could not be sent.",
            "Retry from a focused target app.",
        ),
        DeliveryDiagnosticCode::OverlayPassthroughFailed => (
            "The palette could not switch into pass-through delivery mode.",
            "Close the palette and open it again before retrying.",
        ),
        DeliveryDiagnosticCode::StaleDelivery => (
            "Delivery was ignored because the palette session changed.",
            "Open the palette again if you still want to apply the intervention.",
        ),
        DeliveryDiagnosticCode::Cancelled => (
            "Delivery was cancelled before completion.",
            "Open the palette again when you want to retry.",
        ),
        DeliveryDiagnosticCode::Delivered => ("Native delivery completed.", "No action needed."),
        DeliveryDiagnosticCode::NativeDeliveryFailed => (
            "Native delivery failed before it could complete.",
            "Retry from a focused target app, or switch the loaded item to Copy.",
        ),
    };

    DeliveryDiagnostic {
        code,
        summary: summary.to_string(),
        action: action.to_string(),
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn delivery_result_status(outcome: DeliveryOutcome) -> DeliveryResultStatus {
    match outcome {
        DeliveryOutcome::Delivered { .. } => DeliveryResultStatus::Delivered,
        DeliveryOutcome::Blocked { .. } | DeliveryOutcome::Failed { .. } => {
            DeliveryResultStatus::Failed
        }
        DeliveryOutcome::Cancelled { .. } => DeliveryResultStatus::Cancelled,
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn delivery_result_message(
    outcome: DeliveryOutcome,
    mode: DeliveryMode,
) -> &'static str {
    match outcome {
        DeliveryOutcome::Delivered {
            clipboard_restored: true,
        } => "Delivered · Clipboard restored",
        DeliveryOutcome::Delivered {
            clipboard_restored: false,
        } => "Delivered · Clipboard restore unavailable",
        DeliveryOutcome::Blocked {
            reason: DeliveryBlockedReason::PointerUnavailable,
        } => "Blocked · Pointer unavailable",
        DeliveryOutcome::Blocked {
            reason: DeliveryBlockedReason::TargetUnavailable,
        } => "Blocked · No target found",
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::ClickFailed,
            ..
        } => "Failed · Click failed",
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::FocusTimeout,
            ..
        } => "Failed · Focus timed out",
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::PasteboardWriteFailed,
            clipboard_restored: true,
        } => "Failed · Clipboard restored",
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::PasteboardWriteFailed,
            clipboard_restored: false,
        } => "Failed · Clipboard unavailable",
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::NativeKeyFailed,
            ..
        } => native_key_failure_message(mode),
        DeliveryOutcome::Cancelled { .. } => "Cancelled",
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn delivery_diagnostic_code(
    outcome: DeliveryOutcome,
    mode: DeliveryMode,
) -> DeliveryDiagnosticCode {
    match outcome {
        DeliveryOutcome::Delivered { .. } => DeliveryDiagnosticCode::Delivered,
        DeliveryOutcome::Blocked {
            reason: DeliveryBlockedReason::PointerUnavailable,
        } => DeliveryDiagnosticCode::PointerUnavailable,
        DeliveryOutcome::Blocked {
            reason: DeliveryBlockedReason::TargetUnavailable,
        } => DeliveryDiagnosticCode::TargetUnavailable,
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::ClickFailed,
            ..
        } => DeliveryDiagnosticCode::ClickFailed,
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::FocusTimeout,
            ..
        } => DeliveryDiagnosticCode::FocusTimeout,
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::PasteboardWriteFailed,
            ..
        } => DeliveryDiagnosticCode::PasteboardWriteFailed,
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::NativeKeyFailed,
            ..
        } => native_key_failure_code(mode),
        DeliveryOutcome::Cancelled { .. } => DeliveryDiagnosticCode::Cancelled,
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn delivery_diagnostic_code_from_error(
    error: &str,
    mode: DeliveryMode,
) -> DeliveryDiagnosticCode {
    let normalized = error.to_ascii_lowercase();
    if normalized.contains("pasteboard") || normalized.contains("clipboard") {
        DeliveryDiagnosticCode::PasteboardWriteFailed
    } else if normalized.contains("key") || normalized.contains("keyboard") {
        native_key_failure_code(mode)
    } else {
        DeliveryDiagnosticCode::NativeDeliveryFailed
    }
}

#[cfg(target_os = "macos")]
fn native_key_failure_code(mode: DeliveryMode) -> DeliveryDiagnosticCode {
    match mode {
        DeliveryMode::Paste => DeliveryDiagnosticCode::PasteFailed,
        DeliveryMode::Send => DeliveryDiagnosticCode::SendFailed,
        DeliveryMode::InterruptSend => DeliveryDiagnosticCode::InterruptFailed,
        DeliveryMode::Copy => DeliveryDiagnosticCode::NativeKeyFailed,
    }
}

#[cfg(target_os = "macos")]
fn native_key_failure_message(mode: DeliveryMode) -> &'static str {
    match mode {
        DeliveryMode::Paste => "Failed · Paste shortcut failed",
        DeliveryMode::Send => "Failed · Send sequence failed",
        DeliveryMode::InterruptSend => "Failed · Interrupt sequence failed",
        DeliveryMode::Copy => "Failed · Native input failed",
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::{
        delivery_diagnostic_code, delivery_diagnostic_code_from_error, delivery_result_message,
    };
    use crate::delivery::{DeliveryFailureReason, DeliveryOutcome};
    use crate::modes::DeliveryMode;
    use crate::overlay_events::DeliveryDiagnosticCode;

    fn native_key_failure() -> DeliveryOutcome {
        DeliveryOutcome::Failed {
            reason: DeliveryFailureReason::NativeKeyFailed,
            clipboard_restored: true,
        }
    }

    #[test]
    fn native_key_failure_diagnostic_is_mode_specific() {
        assert_eq!(
            delivery_diagnostic_code(native_key_failure(), DeliveryMode::Paste),
            DeliveryDiagnosticCode::PasteFailed
        );
        assert_eq!(
            delivery_diagnostic_code(native_key_failure(), DeliveryMode::Send),
            DeliveryDiagnosticCode::SendFailed
        );
        assert_eq!(
            delivery_diagnostic_code(native_key_failure(), DeliveryMode::InterruptSend),
            DeliveryDiagnosticCode::InterruptFailed
        );
    }

    #[test]
    fn native_key_error_diagnostic_is_mode_specific() {
        assert_eq!(
            delivery_diagnostic_code_from_error("keyboard event failed", DeliveryMode::Paste),
            DeliveryDiagnosticCode::PasteFailed
        );
        assert_eq!(
            delivery_diagnostic_code_from_error("key sequence failed", DeliveryMode::Send),
            DeliveryDiagnosticCode::SendFailed
        );
        assert_eq!(
            delivery_diagnostic_code_from_error(
                "keyboard event failed",
                DeliveryMode::InterruptSend
            ),
            DeliveryDiagnosticCode::InterruptFailed
        );
    }

    #[test]
    fn native_key_failure_message_is_mode_specific() {
        assert_eq!(
            delivery_result_message(native_key_failure(), DeliveryMode::Paste),
            "Failed · Paste shortcut failed"
        );
        assert_eq!(
            delivery_result_message(native_key_failure(), DeliveryMode::Send),
            "Failed · Send sequence failed"
        );
        assert_eq!(
            delivery_result_message(native_key_failure(), DeliveryMode::InterruptSend),
            "Failed · Interrupt sequence failed"
        );
    }
}
