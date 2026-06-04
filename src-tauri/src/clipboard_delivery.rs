use crate::delivery::write_clipboard;
use crate::delivery_result_mapper::{delivery_result_payload, PromptExecutionMetadata};
use crate::modes::DeliveryMode;
use crate::overlay_events::{
    DeliveryDiagnosticCode, DeliveryResultPayload, DeliveryResultStatus, PromptExecutionKind,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ClipboardDeliveryCommandStatus {
    Copied,
}

pub(crate) struct ClipboardDeliverySuccess {
    pub payload: DeliveryResultPayload,
    pub command_status: ClipboardDeliveryCommandStatus,
    pub message: &'static str,
}

pub(crate) struct ClipboardDeliveryFailure {
    pub payload: DeliveryResultPayload,
    pub error: String,
}

pub(crate) struct ClipboardDeliveryRequest<'a> {
    pub delivery_id: u64,
    pub prompt_id: Option<String>,
    pub prompt_kind: PromptExecutionKind,
    pub mode: DeliveryMode,
    pub text: &'a str,
    pub status: DeliveryResultStatus,
    pub message: &'static str,
    pub diagnostic_code: DeliveryDiagnosticCode,
    pub command_status: ClipboardDeliveryCommandStatus,
}

pub(crate) fn copy_for_delivery(
    request: ClipboardDeliveryRequest<'_>,
) -> Result<ClipboardDeliverySuccess, Box<ClipboardDeliveryFailure>> {
    if let Err(error) = write_clipboard(request.text) {
        return Err(Box::new(ClipboardDeliveryFailure {
            payload: delivery_result_payload(
                request.delivery_id,
                PromptExecutionMetadata {
                    prompt_id: request.prompt_id,
                    prompt_kind: request.prompt_kind,
                },
                request.mode,
                DeliveryResultStatus::Failed,
                "Copy failed",
                false,
                Some(DeliveryDiagnosticCode::PasteboardWriteFailed),
            ),
            error,
        }));
    }

    Ok(ClipboardDeliverySuccess {
        payload: delivery_result_payload(
            request.delivery_id,
            PromptExecutionMetadata {
                prompt_id: request.prompt_id,
                prompt_kind: request.prompt_kind,
            },
            request.mode,
            request.status,
            request.message,
            false,
            Some(request.diagnostic_code),
        ),
        command_status: request.command_status,
        message: request.message,
    })
}
