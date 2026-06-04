use tauri::menu::{Menu, MenuBuilder, MenuItem, MenuItemBuilder};
use tauri::{AppHandle, Runtime};

use crate::logging::error_event;
use crate::overlay_events::LauncherMode;
use crate::overlay_runtime::show_launcher_window;
use crate::settings::{load_app_settings_from_disk, AppSettings};
use crate::windows::{show_standard_window, SETTINGS_WINDOW};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WindowAction {
    pub id: &'static str,
    pub label: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrayMenuModel {
    pub launcher_shortcut: String,
    pub window_actions: Vec<WindowAction>,
    pub app_version_label: String,
}

impl TrayMenuModel {
    fn from_app<R: Runtime>(app: &AppHandle<R>) -> Self {
        let settings = load_app_settings_from_disk(app);
        tray_menu_model_from_parts(&settings)
    }
}

pub fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let model = TrayMenuModel::from_app(app);
    let open_launcher = menu_item_with_accelerator(
        app,
        "open-launcher",
        "Open Launcher...",
        &model.launcher_shortcut,
        true,
    )?;
    let version_item = disabled_menu_item(app, "version", &model.app_version_label)?;

    let mut builder = MenuBuilder::new(app).item(&open_launcher).separator();

    for action in &model.window_actions {
        builder = builder.text(action.id, action.label);
    }

    builder
        .separator()
        .item(&version_item)
        .separator()
        .text("quit", "Quit Ult")
        .build()
}

pub fn handle_tray_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        "open-launcher" => {
            if let Err(error) = show_launcher_window(app, LauncherMode::Search) {
                error_event(app, "tray-menu", "failed to open launcher from tray menu");
                tracing::debug!(error = %error, "launcher menu action failed");
            }
        }
        "open-settings" => {
            if let Err(error) = show_standard_window(app, SETTINGS_WINDOW) {
                error_event(
                    app,
                    "tray-menu",
                    "failed to open settings window from tray menu",
                );
                tracing::debug!(error = %error, "settings window menu action failed");
            }
        }
        "quit" => app.exit(0),
        _ => {}
    }
}

pub fn refresh_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("ult") else {
        return Ok(());
    };
    let menu = build_tray_menu(app).map_err(|error| error.to_string())?;
    tray.set_menu(Some(menu)).map_err(|error| error.to_string())
}

fn disabled_menu_item<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    text: &str,
) -> tauri::Result<MenuItem<R>> {
    MenuItemBuilder::with_id(id, text).enabled(false).build(app)
}

fn menu_item_with_accelerator<R: Runtime>(
    app: &AppHandle<R>,
    id: &str,
    text: &str,
    accelerator: &str,
    enabled: bool,
) -> tauri::Result<MenuItem<R>> {
    let with_accelerator = MenuItemBuilder::with_id(id, text)
        .accelerator(accelerator)
        .enabled(enabled)
        .build(app);
    match with_accelerator {
        Ok(item) => Ok(item),
        Err(_) => MenuItemBuilder::with_id(id, text)
            .enabled(enabled)
            .build(app),
    }
}

fn tray_menu_model_from_parts(settings: &AppSettings) -> TrayMenuModel {
    TrayMenuModel {
        launcher_shortcut: settings.search_shortcut.clone(),
        window_actions: standard_window_actions(),
        app_version_label: format!("Version {}", env!("CARGO_PKG_VERSION")),
    }
}

fn standard_window_actions() -> Vec<WindowAction> {
    vec![WindowAction {
        id: "open-settings",
        label: "Preferences...",
    }]
}

#[cfg(test)]
mod tests {
    use super::tray_menu_model_from_parts;
    use crate::settings::default_app_settings;

    #[test]
    fn menu_model_reports_launcher_first_items() {
        let settings = default_app_settings();
        let ready = tray_menu_model_from_parts(&settings);

        assert_eq!(ready.launcher_shortcut, settings.search_shortcut);
        assert_eq!(ready.window_actions.len(), 1);
        assert_eq!(ready.window_actions[0].label, "Preferences...");
        assert!(ready.app_version_label.starts_with("Version "));
    }

    #[test]
    fn menu_model_does_not_expose_permission_actions() {
        let settings = default_app_settings();
        let model = tray_menu_model_from_parts(&settings);

        assert!(model
            .window_actions
            .iter()
            .all(|action| !action.label.contains("Accessibility")));
    }
}
