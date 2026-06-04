use std::collections::HashSet;
use std::str::FromStr;

use tauri::{plugin::TauriPlugin, Runtime};
use tauri_plugin_global_shortcut::Shortcut;

#[derive(Clone, Copy)]
pub enum ShortcutAction {
    Palette,
    Launcher,
    LauncherScratch,
    LauncherStack,
}

pub const DEFAULT_OPEN_PALETTE_SHORTCUT: &str = "Cmd+U";
pub const DEFAULT_SEARCH_SHORTCUT: &str = "Option+Space";
pub const DEFAULT_SCRATCH_PROMPT_SHORTCUT: &str = "Cmd+Option+Control+S";
pub const DEFAULT_CONTEXT_PICKER_SHORTCUT: &str = "Control+V";

pub fn plugin<R>() -> Result<TauriPlugin<R>, String>
where
    R: Runtime,
{
    Ok(tauri_plugin_global_shortcut::Builder::new().build())
}

pub fn normalize_shortcut(shortcut: &str) -> Result<String, String> {
    Shortcut::from_str(shortcut)
        .map(|shortcut| shortcut.to_string())
        .map_err(|error| error.to_string())
}

pub fn app_shortcut_set() -> HashSet<String> {
    [
        DEFAULT_OPEN_PALETTE_SHORTCUT,
        DEFAULT_SEARCH_SHORTCUT,
        DEFAULT_SCRATCH_PROMPT_SHORTCUT,
        DEFAULT_CONTEXT_PICKER_SHORTCUT,
    ]
    .into_iter()
    .filter_map(|shortcut| normalize_shortcut(shortcut).ok())
    .collect()
}
