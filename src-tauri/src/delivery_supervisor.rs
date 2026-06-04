#[cfg(target_os = "macos")]
use std::thread;

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager};

#[cfg(target_os = "macos")]
use crate::delivery::{DeliveryCoordinator, DeliveryOutcome, DeliveryReport};
#[cfg(target_os = "macos")]
use crate::delivery_result_mapper::{
    delivery_diagnostic_code, delivery_diagnostic_code_from_error, delivery_result_message,
    delivery_result_payload, delivery_result_status, PromptExecutionMetadata,
};
#[cfg(target_os = "macos")]
use crate::logging::error_event;
#[cfg(target_os = "macos")]
use crate::modes::DeliveryMode;
#[cfg(target_os = "macos")]
use crate::overlay_events::{DeliveryDiagnosticCode, DeliveryResultStatus, PromptExecutionKind};
#[cfg(target_os = "macos")]
use crate::overlay_runtime::{
    emit_delivery_result_to_palette, hide_palette_window, prepare_palette_window_for_passthrough,
};
#[cfg(target_os = "macos")]
use crate::state::AppState;

#[cfg(target_os = "macos")]
pub(crate) struct DeliveryRequest {
    pub app: AppHandle,
    pub text: String,
    pub mode: DeliveryMode,
    pub generation: u64,
    pub delivery_id: u64,
    pub prompt_id: Option<String>,
    pub prompt_kind: PromptExecutionKind,
}

#[cfg(target_os = "macos")]
pub(crate) fn spawn_prompt_delivery(request: DeliveryRequest) {
    thread::spawn(move || {
        if let Err(error) = run_prompt_delivery(request) {
            tracing::debug!(error = %error, "prompt palette delivery worker failed");
        }
    });
}

#[cfg(target_os = "macos")]
fn run_prompt_delivery(request: DeliveryRequest) -> Result<(), String> {
    let coordinator = DeliveryCoordinator::new(request.text, request.mode);
    complete_prompt_palette_delivery(
        request.app,
        coordinator,
        request.generation,
        request.delivery_id,
        request.prompt_id,
        request.prompt_kind,
        request.mode,
    )
}

#[cfg(target_os = "macos")]
fn complete_prompt_palette_delivery(
    app: AppHandle,
    coordinator: DeliveryCoordinator,
    generation: u64,
    delivery_id: u64,
    prompt_id: Option<String>,
    prompt_kind: PromptExecutionKind,
    mode: DeliveryMode,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    if !state.overlay_generation_matches(generation)? {
        state.delivery_cancelled(generation)?;
        emit_delivery_result_to_palette(
            &app,
            delivery_result_payload(
                delivery_id,
                PromptExecutionMetadata {
                    prompt_id,
                    prompt_kind,
                },
                mode,
                DeliveryResultStatus::Cancelled,
                "Cancelled",
                false,
                Some(DeliveryDiagnosticCode::StaleDelivery),
            ),
        );
        return Ok(());
    }

    if let Err(error) = prepare_palette_window_for_passthrough(&app) {
        state.delivery_cancelled(generation)?;
        emit_delivery_result_to_palette(
            &app,
            delivery_result_payload(
                delivery_id,
                PromptExecutionMetadata {
                    prompt_id,
                    prompt_kind,
                },
                mode,
                DeliveryResultStatus::Failed,
                "Delivery failed",
                false,
                Some(DeliveryDiagnosticCode::OverlayPassthroughFailed),
            ),
        );
        return Err(error);
    }

    let result = run_native_delivery(&state, &coordinator, generation);
    let delivery_is_current = state.overlay_generation_matches(generation)?;

    match &result {
        Ok(report) => {
            let outcome = report.outcome;
            if !delivery_is_current || matches!(outcome, DeliveryOutcome::Cancelled { .. }) {
                state.delivery_cancelled(generation)?;
            } else {
                state.delivery_finished(generation)?;
            }

            let mut payload = delivery_result_payload(
                delivery_id,
                PromptExecutionMetadata {
                    prompt_id: prompt_id.clone(),
                    prompt_kind,
                },
                mode,
                delivery_result_status(outcome),
                delivery_result_message(outcome, mode),
                outcome.clipboard_restored(),
                Some(delivery_diagnostic_code(outcome, mode)),
            );
            payload.target_application = report.target_application.clone();
            emit_delivery_result_to_palette(&app, payload);
        }
        Err(error) => {
            error_event(&app, "delivery", "prompt palette delivery failed");
            tracing::debug!(error = %error, "prompt palette delivery failed");
            state.delivery_cancelled(generation)?;
            emit_delivery_result_to_palette(
                &app,
                delivery_result_payload(
                    delivery_id,
                    PromptExecutionMetadata {
                        prompt_id: prompt_id.clone(),
                        prompt_kind,
                    },
                    mode,
                    DeliveryResultStatus::Failed,
                    "Delivery failed",
                    false,
                    Some(delivery_diagnostic_code_from_error(error, mode)),
                ),
            );
        }
    }

    let _ = hide_palette_window(&app);
    result.map(|_| ())
}

#[cfg(target_os = "macos")]
fn run_native_delivery(
    state: &AppState,
    coordinator: &DeliveryCoordinator,
    generation: u64,
) -> Result<DeliveryReport, String> {
    if !state.overlay_generation_matches(generation)? {
        return Ok(DeliveryReport {
            outcome: DeliveryOutcome::Cancelled {
                clipboard_restored: false,
            },
            target_application: None,
        });
    }

    coordinator.deliver_to_current_pointer(|| {
        state
            .overlay_generation_matches(generation)
            .map(|matches| !matches)
    })
}
