use tauri::{AppHandle, Manager, Runtime, WebviewWindow, Window, WindowEvent};

pub const PALETTE_WINDOW: &str = "palette";
pub const SETTINGS_WINDOW: &str = "settings";

pub fn enforce_menu_bar_activation<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        app.set_activation_policy(tauri::ActivationPolicy::Accessory)
            .map_err(|error| error.to_string())?;
        app.set_dock_visibility(false)
            .map_err(|error| error.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
    }

    Ok(())
}

pub fn show_standard_window<R: Runtime>(app: &AppHandle<R>, label: &str) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        enforce_menu_bar_activation(app)?;
    }

    let window = app
        .get_webview_window(label)
        .ok_or_else(|| format!("{label} window not found"))?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;

    #[cfg(target_os = "macos")]
    {
        enforce_menu_bar_activation(app)?;
    }

    Ok(())
}

pub fn palette_window<R: Runtime>(app: &AppHandle<R>) -> Result<WebviewWindow<R>, String> {
    app.get_webview_window(PALETTE_WINDOW)
        .ok_or_else(|| "palette window not found".to_string())
}

pub fn standard_window_visible<R: Runtime>(app: &AppHandle<R>) -> bool {
    app.get_webview_window(SETTINGS_WINDOW)
        .and_then(|window| window.is_visible().ok())
        .unwrap_or(false)
}

pub fn hide_app_if_no_standard_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if !standard_window_visible(app) {
        app.hide().map_err(|error| error.to_string())?;
        enforce_menu_bar_activation(app)?;
    }

    Ok(())
}

pub fn handle_standard_window_close<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    if !is_standard_window_label(window.label()) {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let app = window.app_handle().clone();
        let _ = window.hide();
        let _ = hide_app_if_no_standard_window(&app);
    }
}

fn is_standard_window_label(label: &str) -> bool {
    label == SETTINGS_WINDOW
}
