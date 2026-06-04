use serde::{Deserialize, Serialize};
use tauri::{Emitter, Runtime, WebviewWindow};

use crate::intervention_library::PromptDefinition;
use crate::modes::DeliveryMode;

pub const PALETTE_POINTER_EVENT: &str = "ult:palette-pointer";
pub const PALETTE_ACTIVE_EVENT: &str = "ult:palette-active";
pub const DELIVERY_RESULT_EVENT: &str = "ult:delivery-result";
pub const APPEARANCE_CHANGED_EVENT: &str = "ult:appearance-changed";
pub const EPHEMERAL_CONTEXT_CAPTURED_EVENT: &str = "ult:ephemeral-context-captured";

#[derive(Clone, Debug, Default, Serialize)]
pub struct PointerPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Clone, Debug, Serialize)]
pub struct PaletteActivePayload {
    pub active: bool,
    pub mode: OverlayMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub launcher_mode: Option<LauncherMode>,
    pub generation: u64,
}

#[derive(Clone, Debug, Serialize)]
pub struct EphemeralContextCapturePayload {
    pub artifact: PromptDefinition,
    pub preview: String,
    pub timestamp_ms: u64,
    pub pointer: PointerPosition,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum OverlayMode {
    #[default]
    Palette,
    Launcher,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LauncherMode {
    Search,
    Scratch,
    Refine,
    Variables,
    Stack,
    Recent,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptExecutionKind {
    #[default]
    Bundled,
    Local,
    Template,
    Scratch,
    Context,
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptExecutionState {
    BlockedPermission,
    #[default]
    Selecting,
    CollectingTemplateValues,
    Loaded,
    Applying,
    Delivered,
    Copied,
    Clipboard,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeliveryResultStatus {
    Started,
    Delivered,
    Copied,
    Cancelled,
    Failed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeliveryDiagnosticCode {
    CopyMode,
    AccessibilityRequired,
    NativeUnavailable,
    PointerUnavailable,
    TargetUnavailable,
    ClickFailed,
    FocusTimeout,
    PasteboardWriteFailed,
    PasteFailed,
    SendFailed,
    InterruptFailed,
    NativeKeyFailed,
    OverlayPassthroughFailed,
    StaleDelivery,
    Cancelled,
    Delivered,
    NativeDeliveryFailed,
}

impl DeliveryResultStatus {
    pub fn is_terminal(&self) -> bool {
        !matches!(self, Self::Started)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeliveryTargetApplication {
    pub bundle_id: String,
    pub name: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DeliveryDiagnostic {
    pub code: DeliveryDiagnosticCode,
    pub summary: String,
    pub action: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DeliveryResultPayload {
    pub delivery_id: u64,
    pub timestamp_ms: u64,
    pub prompt_id: Option<String>,
    pub prompt_kind: PromptExecutionKind,
    pub mode: DeliveryMode,
    pub execution_state: PromptExecutionState,
    pub status: DeliveryResultStatus,
    pub message: String,
    pub clipboard_restored: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_application: Option<DeliveryTargetApplication>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub diagnostic: Option<DeliveryDiagnostic>,
}

pub fn emit_palette_pointer<R: Runtime>(
    window: &WebviewWindow<R>,
    pointer: PointerPosition,
) -> Result<(), String> {
    window
        .emit(PALETTE_POINTER_EVENT, pointer)
        .map_err(|error| error.to_string())
}

pub fn emit_palette_active<R: Runtime>(
    window: &WebviewWindow<R>,
    active: bool,
    mode: OverlayMode,
    launcher_mode: Option<LauncherMode>,
    generation: u64,
) -> Result<(), String> {
    window
        .emit(
            PALETTE_ACTIVE_EVENT,
            PaletteActivePayload {
                active,
                mode,
                launcher_mode,
                generation,
            },
        )
        .map_err(|error| error.to_string())
}

pub fn emit_delivery_result<R: Runtime>(
    window: &WebviewWindow<R>,
    payload: DeliveryResultPayload,
) -> Result<(), String> {
    window
        .emit(DELIVERY_RESULT_EVENT, payload)
        .map_err(|error| error.to_string())
}

pub fn emit_ephemeral_context_captured<R: Runtime>(
    window: &WebviewWindow<R>,
    payload: EphemeralContextCapturePayload,
) -> Result<(), String> {
    window
        .emit(EPHEMERAL_CONTEXT_CAPTURED_EVENT, payload)
        .map_err(|error| error.to_string())
}
