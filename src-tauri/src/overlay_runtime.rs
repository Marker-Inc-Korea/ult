use serde::Serialize;
use tauri::window::Color;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};

use crate::geometry::{
    display_index_for_point, project_physical_cursor_to_webview, PhysicalDisplayBounds,
};
use crate::overlay_events::{
    emit_delivery_result, emit_ephemeral_context_captured, emit_palette_active,
    emit_palette_pointer, DeliveryResultPayload, EphemeralContextCapturePayload, LauncherMode,
    OverlayMode, PointerPosition,
};
use crate::state::AppState;
use crate::usage_history;
use crate::windows::{enforce_menu_bar_activation, hide_app_if_no_standard_window, palette_window};

#[derive(Debug, Serialize)]
pub struct OverlayCoordinateDiagnostics {
    pub cursor_physical_position: String,
    pub active_display_name: String,
    pub active_display_physical_bounds: String,
    pub active_display_scale_factor: String,
    pub palette_window_physical_bounds: String,
    pub webview_pointer_position: String,
}

pub fn show_prompt_palette_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    show_overlay_window(app, OverlayMode::Palette, None)
}

pub fn show_launcher_window<R: Runtime>(
    app: &AppHandle<R>,
    launcher_mode: LauncherMode,
) -> Result<(), String> {
    show_overlay_window(app, OverlayMode::Launcher, Some(launcher_mode))
}

fn show_overlay_window<R: Runtime>(
    app: &AppHandle<R>,
    mode: OverlayMode,
    launcher_mode: Option<LauncherMode>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        enforce_menu_bar_activation(app)?;
    }

    let state = app.state::<AppState>();
    match (mode, launcher_mode) {
        (OverlayMode::Palette, _) => {
            state.open_palette()?;
        }
        (OverlayMode::Launcher, Some(launcher_mode)) => {
            state.open_launcher(launcher_mode)?;
        }
        (OverlayMode::Launcher, _) => {
            return Err("launcher mode is required".to_string());
        }
    }
    let generation = state.overlay_generation()?;

    let window = palette_window(app)?;
    let _ = position_palette_window_on_cursor_display(app, &window)?;
    window
        .set_background_color(Some(Color(0, 0, 0, 0)))
        .map_err(|error| error.to_string())?;
    window
        .set_focusable(true)
        .map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    if mode == OverlayMode::Palette {
        sync_palette_pointer(app, &window);
    }
    set_palette_overlay_active(&window, true, mode, launcher_mode, generation);

    Ok(())
}

pub fn unload_overlay_from_app<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let state = app.state::<AppState>();
    let previous_mode = state.overlay_mode().unwrap_or(OverlayMode::Palette);
    let previous_launcher_mode = state.launcher_mode().unwrap_or(None);
    state.unload_overlay()?;
    hide_palette_window_with_mode(app, previous_mode, previous_launcher_mode)
}

pub(crate) fn show_ephemeral_context_feedback<R: Runtime>(
    app: &AppHandle<R>,
    payload: EphemeralContextCapturePayload,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let window = palette_window(app)?;
    if state.is_overlay_idle()? {
        let _ = position_palette_window_on_cursor_display(app, &window)?;
        window
            .set_background_color(Some(Color(0, 0, 0, 0)))
            .map_err(|error| error.to_string())?;
        window
            .set_focusable(false)
            .map_err(|error| error.to_string())?;
        window
            .set_ignore_cursor_events(true)
            .map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
    }
    emit_ephemeral_context_captured(&window, payload)
}

pub fn dismiss_ephemeral_context_feedback<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let state = app.state::<AppState>();
    if state.is_overlay_idle()? {
        hide_palette_window_with_mode(app, OverlayMode::Palette, None)?;
    }
    Ok(())
}

pub fn show_ephemeral_context_indicator<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<PointerPosition, String> {
    let state = app.state::<AppState>();
    if !state.is_overlay_idle()? {
        return current_palette_pointer(app);
    }

    let window = palette_window(app)?;
    window
        .set_background_color(Some(Color(0, 0, 0, 0)))
        .map_err(|error| error.to_string())?;
    window
        .set_focusable(false)
        .map_err(|error| error.to_string())?;
    window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    current_palette_pointer(app)
}

pub fn current_palette_pointer<R: Runtime>(app: &AppHandle<R>) -> Result<PointerPosition, String> {
    let window = palette_window(app)?;
    let _ = position_palette_window_on_cursor_display(app, &window)?;
    cursor_position_in_palette_window(app, &window)
}

fn sync_palette_pointer<R: Runtime>(app: &AppHandle<R>, window: &WebviewWindow<R>) {
    let Ok(pointer) = cursor_position_in_palette_window(app, window) else {
        return;
    };
    let _ = emit_palette_pointer(window, pointer);
}

fn cursor_position_in_palette_window<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Result<PointerPosition, String> {
    let cursor = cursor_physical_position(app)?;
    let window_position = window.outer_position().map_err(|error| error.to_string())?;
    let window_scale_factor =
        valid_scale_factor(window.scale_factor().map_err(|error| error.to_string())?);
    let (x, y) = project_physical_cursor_to_webview(
        cursor.x,
        cursor.y,
        window_position.x,
        window_position.y,
        window_scale_factor,
    );
    Ok(PointerPosition { x, y })
}

pub(crate) fn hide_palette_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let mode = app
        .state::<AppState>()
        .overlay_mode()
        .unwrap_or(OverlayMode::Palette);
    let launcher_mode = app.state::<AppState>().launcher_mode().unwrap_or(None);
    hide_palette_window_with_mode(app, mode, launcher_mode)
}

pub(crate) fn hide_palette_window_with_mode<R: Runtime>(
    app: &AppHandle<R>,
    mode: OverlayMode,
    launcher_mode: Option<LauncherMode>,
) -> Result<(), String> {
    if let Ok(window) = palette_window(app) {
        let generation = app
            .state::<AppState>()
            .overlay_generation()
            .unwrap_or_default();
        set_palette_overlay_active(&window, false, mode, launcher_mode, generation);
        let _ = window.set_ignore_cursor_events(true);
        window.hide().map_err(|error| error.to_string())?;
    }

    hide_app_if_no_standard_window(app)?;
    Ok(())
}

pub(crate) fn prepare_palette_window_for_passthrough<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    state.mark_passthrough()?;
    if let Ok(window) = palette_window(app) {
        let generation = state.overlay_generation().unwrap_or_default();
        set_palette_overlay_active(&window, false, OverlayMode::Palette, None, generation);
        window
            .set_ignore_cursor_events(true)
            .map_err(|error| error.to_string())?;
        window.hide().map_err(|error| error.to_string())?;
    }
    hide_app_if_no_standard_window(app)?;
    Ok(())
}

pub(crate) fn prepare_palette_window_for_permission_prompt<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let previous_mode = state.overlay_mode().unwrap_or(OverlayMode::Palette);
    let previous_launcher_mode = state.launcher_mode().unwrap_or(None);
    state.unload_overlay()?;
    if let Ok(window) = palette_window(app) {
        let generation = state.overlay_generation().unwrap_or_default();
        set_palette_overlay_active(
            &window,
            false,
            previous_mode,
            previous_launcher_mode,
            generation,
        );
        window
            .set_ignore_cursor_events(true)
            .map_err(|error| error.to_string())?;
        window
            .set_focusable(false)
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn set_palette_overlay_active<R: Runtime>(
    window: &WebviewWindow<R>,
    active: bool,
    mode: OverlayMode,
    launcher_mode: Option<LauncherMode>,
    generation: u64,
) {
    let _ = emit_palette_active(window, active, mode, launcher_mode, generation);
}

pub(crate) fn emit_delivery_result_to_palette<R: Runtime>(
    app: &AppHandle<R>,
    payload: DeliveryResultPayload,
) {
    let state = app.state::<AppState>();
    let _ = state.record_delivery_result(payload.clone());
    let _ = usage_history::append_delivery_result(app, &payload);

    if let Ok(window) = palette_window(app) {
        let _ = emit_delivery_result(&window, payload);
    }
}

#[derive(Debug, Clone)]
struct OverlayDisplayBounds {
    name: String,
    position: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
    scale_factor: f64,
}

fn position_palette_window_on_cursor_display<R: Runtime>(
    app: &AppHandle<R>,
    window: &WebviewWindow<R>,
) -> Result<OverlayDisplayBounds, String> {
    let display = overlay_cursor_display_bounds(app)?;
    if window.outer_position().ok() != Some(display.position) {
        window
            .set_position(display.position)
            .map_err(|error| error.to_string())?;
    }
    if window.outer_size().ok() != Some(display.size) {
        window
            .set_size(display.size)
            .map_err(|error| error.to_string())?;
    }
    Ok(display)
}

fn overlay_cursor_display_bounds<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<OverlayDisplayBounds, String> {
    let cursor = cursor_physical_position(app)?;
    let monitors = app
        .available_monitors()
        .map_err(|error| error.to_string())?;
    let displays = monitors
        .iter()
        .map(|monitor| OverlayDisplayBounds {
            name: monitor
                .name()
                .map(|name| name.to_string())
                .unwrap_or_else(|| "Display".to_string()),
            position: *monitor.position(),
            size: *monitor.size(),
            scale_factor: valid_scale_factor(monitor.scale_factor()),
        })
        .collect::<Vec<_>>();
    let physical_bounds = displays
        .iter()
        .map(OverlayDisplayBounds::physical_bounds)
        .collect::<Vec<_>>();
    if let Some(index) = display_index_for_point(&physical_bounds, cursor.x, cursor.y) {
        return Ok(displays[index].clone());
    }

    if let Some(monitor) = app.primary_monitor().map_err(|error| error.to_string())? {
        return Ok(OverlayDisplayBounds {
            name: monitor
                .name()
                .map(|name| name.to_string())
                .unwrap_or_else(|| "Primary display".to_string()),
            position: *monitor.position(),
            size: *monitor.size(),
            scale_factor: valid_scale_factor(monitor.scale_factor()),
        });
    }

    Ok(OverlayDisplayBounds {
        name: "Fallback display".to_string(),
        position: PhysicalPosition::new(0, 0),
        size: PhysicalSize::new(1280, 800),
        scale_factor: 1.0,
    })
}

fn cursor_physical_position<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<PhysicalPosition<f64>, String> {
    app.cursor_position().map_err(|error| error.to_string())
}

fn valid_scale_factor(scale_factor: f64) -> f64 {
    if scale_factor.is_finite() && scale_factor > 0.0 {
        scale_factor
    } else {
        1.0
    }
}

pub fn coordinate_diagnostics<R: Runtime>(app: &AppHandle<R>) -> OverlayCoordinateDiagnostics {
    let cursor = cursor_physical_position(app);
    let active_display = overlay_cursor_display_bounds(app);
    let palette_bounds = palette_window(app)
        .ok()
        .and_then(|window| {
            let position = window.outer_position().ok()?;
            let size = window.outer_size().ok()?;
            Some(format_physical_bounds(position, size))
        })
        .unwrap_or_else(|| "Unavailable".to_string());

    let webview_pointer = palette_window(app)
        .and_then(|window| cursor_position_in_palette_window(app, &window))
        .map(|position| format!("{:.1}, {:.1}", position.x, position.y))
        .unwrap_or_else(|error| format!("Unavailable ({error})"));

    OverlayCoordinateDiagnostics {
        cursor_physical_position: cursor
            .map(|position| format!("{:.1}, {:.1}", position.x, position.y))
            .unwrap_or_else(|error| format!("Unavailable ({error})")),
        active_display_name: active_display
            .as_ref()
            .map(|display| display.name.clone())
            .unwrap_or_else(|error| format!("Unavailable ({error})")),
        active_display_physical_bounds: active_display
            .as_ref()
            .map(|display| format_physical_bounds(display.position, display.size))
            .unwrap_or_else(|error| format!("Unavailable ({error})")),
        active_display_scale_factor: active_display
            .as_ref()
            .map(|display| format!("{:.2}", display.scale_factor))
            .unwrap_or_else(|error| format!("Unavailable ({error})")),
        palette_window_physical_bounds: palette_bounds,
        webview_pointer_position: webview_pointer,
    }
}

impl OverlayDisplayBounds {
    fn physical_bounds(&self) -> PhysicalDisplayBounds {
        PhysicalDisplayBounds {
            x: f64::from(self.position.x),
            y: f64::from(self.position.y),
            width: f64::from(self.size.width),
            height: f64::from(self.size.height),
        }
    }
}

fn format_physical_bounds(position: PhysicalPosition<i32>, size: PhysicalSize<u32>) -> String {
    format!(
        "x={} y={} w={} h={}",
        position.x, position.y, size.width, size.height
    )
}
