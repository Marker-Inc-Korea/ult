use tauri::{AppHandle, State, WebviewWindow};

use crate::modes::DeliveryMode;
use crate::overlay_events::{PointerPosition, PromptExecutionKind};
use crate::overlay_runtime::{self, unload_overlay_from_app};
use crate::prompt_executor::{self, DeliveryCommandResult};
use crate::state::AppState;
use crate::windows::PALETTE_WINDOW;

use super::ensure_window;

#[tauri::command]
pub fn current_palette_pointer(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<PointerPosition, String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    overlay_runtime::current_palette_pointer(&app)
}

#[tauri::command]
pub fn deliver_prompt_at_pointer(
    window: WebviewWindow,
    app: AppHandle,
    state: State<AppState>,
    text: String,
    mode: DeliveryMode,
    prompt_id: Option<String>,
    prompt_kind: PromptExecutionKind,
) -> Result<DeliveryCommandResult, String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    prompt_executor::deliver_prompt_at_pointer(app, state, text, mode, prompt_id, prompt_kind)
}

#[tauri::command]
pub fn unload_overlay(window: WebviewWindow, app: AppHandle) -> Result<(), String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    unload_overlay_from_app(&app)
}

#[tauri::command]
pub fn dismiss_ephemeral_context_feedback(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<(), String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    overlay_runtime::dismiss_ephemeral_context_feedback(&app)
}

#[tauri::command]
pub fn show_ephemeral_context_indicator(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<PointerPosition, String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    overlay_runtime::show_ephemeral_context_indicator(&app)
}
