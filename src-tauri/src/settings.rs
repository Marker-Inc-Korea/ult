use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::atomic_write::write_atomic;
use crate::config_lock::with_config_write_lock;
use crate::hotkeys::{
    DEFAULT_CONTEXT_PICKER_SHORTCUT, DEFAULT_OPEN_PALETTE_SHORTCUT,
    DEFAULT_SCRATCH_PROMPT_SHORTCUT, DEFAULT_SEARCH_SHORTCUT,
};

pub const DEFAULT_META_PROMPTING_PROVIDER: &str = "openai";
pub const DEFAULT_META_PROMPTING_MODEL: &str = "gpt-5-mini";
pub const DEFAULT_META_PROMPTING_TEMPLATE: &str = "Refine this rough coding-agent prompt for review and delivery. If it is vague, social, filler, or missing a concrete task, turn it into a concise instruction for the coding agent to pause and ask for the missing task, file path, command, or constraint instead of inventing work.\n\nRough prompt:\n{input}";
pub const DEFAULT_PALETTE_VISIBLE_COUNT: usize = 5;
pub const MIN_PALETTE_VISIBLE_COUNT: usize = 3;
pub const MAX_PALETTE_VISIBLE_COUNT: usize = 9;
pub const DEFAULT_APPEARANCE: &str = "dark";
const LEGACY_DEFAULT_OPEN_PALETTE_SHORTCUT: &str = "Cmd+Option+Control+Space";
const LEGACY_DEFAULT_SEARCH_SHORTCUT: &str = "Cmd+Option+Control+F";
// Short-lived default that collides with macOS Search/Finder symbolic hotkeys on common setups.
const RESERVED_DEFAULT_SEARCH_SHORTCUT: &str = "Cmd+Option+Space";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct AppSettings {
    pub appearance: String,
    pub palette_visible_count: usize,
    pub pinned_artifact_ids: Vec<String>,
    pub launch_at_login: bool,
    pub project_metadata_enabled: bool,
    pub open_palette_shortcut: String,
    pub search_shortcut: String,
    pub scratch_prompt_shortcut: String,
    pub meta_prompting_enabled: bool,
    #[serde(skip_serializing)]
    pub meta_prompting_api_key: String,
    pub meta_prompting_provider: String,
    pub meta_prompting_model: String,
    pub meta_prompting_template: String,
}

#[derive(Debug, Serialize)]
struct WritableAppSettings<'a> {
    appearance: &'a str,
    palette_visible_count: usize,
    pinned_artifact_ids: &'a [String],
    launch_at_login: bool,
    project_metadata_enabled: bool,
    open_palette_shortcut: &'a str,
    search_shortcut: &'a str,
    scratch_prompt_shortcut: &'a str,
    meta_prompting_enabled: bool,
    meta_prompting_api_key: &'a str,
    meta_prompting_provider: &'a str,
    meta_prompting_model: &'a str,
    meta_prompting_template: &'a str,
}

#[derive(Debug, Deserialize)]
struct RawAppSettings {
    appearance: Option<String>,
    palette_visible_count: Option<usize>,
    pinned_artifact_ids: Option<Vec<String>>,
    launch_at_login: Option<bool>,
    project_metadata_enabled: Option<bool>,
    open_palette_shortcut: Option<String>,
    search_shortcut: Option<String>,
    scratch_prompt_shortcut: Option<String>,
    meta_prompting_enabled: Option<bool>,
    meta_prompting_api_key: Option<String>,
    meta_prompting_provider: Option<String>,
    meta_prompting_model: Option<String>,
    meta_prompting_template: Option<String>,
}

pub fn load_app_settings_from_disk<R: Runtime>(app: &AppHandle<R>) -> AppSettings {
    let config_dir = match app.path().app_config_dir() {
        Ok(path) => path,
        Err(error) => {
            tracing::warn!(error = %error, "failed to resolve app config directory for settings");
            return default_app_settings();
        }
    };

    if let Err(error) = fs::create_dir_all(&config_dir) {
        tracing::warn!(error = %error, "failed to create settings config directory");
        return default_app_settings();
    }

    let settings_path = config_dir.join("settings.toml");
    if !settings_path.exists() {
        let settings = default_app_settings();
        if let Err(error) = write_app_settings_file(&settings_path, &settings) {
            tracing::warn!(error = %error, "failed to create settings.toml");
        }
        return settings;
    }

    let contents = match fs::read_to_string(&settings_path) {
        Ok(contents) => contents,
        Err(error) => {
            tracing::warn!(error = %error, "failed to read settings.toml");
            return default_app_settings();
        }
    };

    match parse_app_settings(&contents) {
        Ok(settings) => {
            if app_settings_file_needs_normalization(&contents, &settings) {
                if let Err(error) = write_app_settings_file(&settings_path, &settings) {
                    tracing::warn!(error = %error, "failed to normalize settings.toml");
                }
            }
            settings
        }
        Err(error) => {
            tracing::warn!(error = %error, "failed to parse settings.toml");
            default_app_settings()
        }
    }
}

pub fn update_app_settings<R: Runtime>(
    app: &AppHandle<R>,
    update: impl FnOnce(&mut AppSettings) -> Result<(), String>,
) -> Result<AppSettings, String> {
    with_config_write_lock(|| {
        let mut settings = load_app_settings_from_disk(app);
        update(&mut settings)?;
        write_app_settings_unlocked(app, &settings)?;
        Ok(settings)
    })
}

fn write_app_settings_unlocked<R: Runtime>(
    app: &AppHandle<R>,
    settings: &AppSettings,
) -> Result<(), String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("failed to resolve app config directory: {error}"))?;
    fs::create_dir_all(&config_dir)
        .map_err(|error| format!("failed to create settings config directory: {error}"))?;
    write_app_settings_file(&config_dir.join("settings.toml"), settings)
}

pub fn normalize_app_shortcut(shortcut: &str) -> Result<String, String> {
    crate::hotkeys::normalize_shortcut(shortcut)
}

fn parse_app_settings(contents: &str) -> Result<AppSettings, String> {
    let raw = toml::from_str::<RawAppSettings>(contents).map_err(|error| error.to_string())?;
    Ok(normalize_app_settings(raw))
}

pub fn default_app_settings() -> AppSettings {
    AppSettings {
        appearance: DEFAULT_APPEARANCE.to_string(),
        palette_visible_count: DEFAULT_PALETTE_VISIBLE_COUNT,
        pinned_artifact_ids: Vec::new(),
        launch_at_login: false,
        // Reserved schema field only until a privacy-safe resolver exists.
        project_metadata_enabled: false,
        open_palette_shortcut: DEFAULT_OPEN_PALETTE_SHORTCUT.to_string(),
        search_shortcut: DEFAULT_SEARCH_SHORTCUT.to_string(),
        scratch_prompt_shortcut: DEFAULT_SCRATCH_PROMPT_SHORTCUT.to_string(),
        meta_prompting_enabled: false,
        meta_prompting_api_key: String::new(),
        meta_prompting_provider: DEFAULT_META_PROMPTING_PROVIDER.to_string(),
        meta_prompting_model: DEFAULT_META_PROMPTING_MODEL.to_string(),
        meta_prompting_template: DEFAULT_META_PROMPTING_TEMPLATE.to_string(),
    }
}

fn normalize_app_settings(settings: RawAppSettings) -> AppSettings {
    let defaults = default_app_settings();
    let mut open_palette_shortcut = settings
        .open_palette_shortcut
        .as_deref()
        .and_then(|shortcut| normalize_app_shortcut(shortcut).ok())
        .unwrap_or_else(|| defaults.open_palette_shortcut.clone());
    let mut scratch_prompt_shortcut = settings
        .scratch_prompt_shortcut
        .as_deref()
        .and_then(|shortcut| normalize_app_shortcut(shortcut).ok())
        .unwrap_or_else(|| defaults.scratch_prompt_shortcut.clone());
    let mut search_shortcut = settings
        .search_shortcut
        .as_deref()
        .and_then(|shortcut| normalize_app_shortcut(shortcut).ok())
        .unwrap_or_else(|| defaults.search_shortcut.clone());

    let legacy_open_palette_shortcut =
        normalized_shortcut_or_raw(LEGACY_DEFAULT_OPEN_PALETTE_SHORTCUT);
    let legacy_search_shortcut = normalized_shortcut_or_raw(LEGACY_DEFAULT_SEARCH_SHORTCUT);
    let reserved_search_shortcut = normalized_shortcut_or_raw(RESERVED_DEFAULT_SEARCH_SHORTCUT);
    let default_open_palette_shortcut = normalized_shortcut_or_raw(DEFAULT_OPEN_PALETTE_SHORTCUT);
    let default_search_shortcut = normalized_shortcut_or_raw(DEFAULT_SEARCH_SHORTCUT);
    let default_scratch_prompt_shortcut =
        normalized_shortcut_or_raw(DEFAULT_SCRATCH_PROMPT_SHORTCUT);

    if open_palette_shortcut == legacy_open_palette_shortcut
        || open_palette_shortcut == default_open_palette_shortcut
    {
        open_palette_shortcut = defaults.open_palette_shortcut.clone();
    }
    if search_shortcut == legacy_search_shortcut
        || search_shortcut == reserved_search_shortcut
        || search_shortcut == default_search_shortcut
    {
        search_shortcut = defaults.search_shortcut.clone();
    }
    if scratch_prompt_shortcut == default_scratch_prompt_shortcut {
        scratch_prompt_shortcut = defaults.scratch_prompt_shortcut.clone();
    }

    if app_shortcuts_have_duplicates([
        open_palette_shortcut.as_str(),
        search_shortcut.as_str(),
        scratch_prompt_shortcut.as_str(),
        DEFAULT_CONTEXT_PICKER_SHORTCUT,
    ]) {
        open_palette_shortcut = defaults.open_palette_shortcut;
        search_shortcut = defaults.search_shortcut;
        scratch_prompt_shortcut = defaults.scratch_prompt_shortcut;
    }

    let _reserved_project_metadata_enabled = settings.project_metadata_enabled;

    AppSettings {
        appearance: normalize_appearance(settings.appearance.as_deref()),
        palette_visible_count: normalize_palette_visible_count(settings.palette_visible_count),
        pinned_artifact_ids: normalize_artifact_id_list(settings.pinned_artifact_ids),
        launch_at_login: settings.launch_at_login.unwrap_or(false),
        // Ignore manual true values until a privacy-safe resolver and opt-in flow exist.
        project_metadata_enabled: false,
        open_palette_shortcut,
        search_shortcut,
        scratch_prompt_shortcut,
        meta_prompting_enabled: settings.meta_prompting_enabled.unwrap_or(false),
        meta_prompting_api_key: settings
            .meta_prompting_api_key
            .map(|value| value.trim().to_string())
            .unwrap_or_default(),
        meta_prompting_provider: normalize_meta_prompting_provider(
            settings.meta_prompting_provider.as_deref(),
        ),
        meta_prompting_model: normalize_meta_prompting_model(
            settings.meta_prompting_model.as_deref(),
        ),
        meta_prompting_template: normalize_meta_prompting_template(
            settings.meta_prompting_template.as_deref(),
        ),
    }
}

pub fn normalize_palette_visible_count(value: Option<usize>) -> usize {
    value
        .unwrap_or(DEFAULT_PALETTE_VISIBLE_COUNT)
        .clamp(MIN_PALETTE_VISIBLE_COUNT, MAX_PALETTE_VISIBLE_COUNT)
}

pub fn normalize_artifact_id_list(values: Option<Vec<String>>) -> Vec<String> {
    let Some(values) = values else {
        return Vec::new();
    };

    let mut normalized = Vec::new();
    for value in values {
        let value = value.trim().to_string();
        if value.is_empty() || normalized.iter().any(|entry| entry == &value) {
            continue;
        }
        normalized.push(value);
    }
    normalized
}

pub fn normalize_appearance(value: Option<&str>) -> String {
    match value.map(|entry| entry.trim().to_lowercase()) {
        Some(entry) if matches!(entry.as_str(), "system" | "light" | "dark") => entry,
        _ => DEFAULT_APPEARANCE.to_string(),
    }
}

pub fn normalize_meta_prompting_provider(value: Option<&str>) -> String {
    match value {
        Some(entry) => entry.trim().to_lowercase(),
        None => DEFAULT_META_PROMPTING_PROVIDER.to_string(),
    }
}

pub fn normalize_meta_prompting_model(value: Option<&str>) -> String {
    match value {
        Some(entry) => entry.trim().to_string(),
        None => DEFAULT_META_PROMPTING_MODEL.to_string(),
    }
}

pub fn normalize_meta_prompting_template(value: Option<&str>) -> String {
    match value {
        Some(entry) => entry.trim().to_string(),
        None => DEFAULT_META_PROMPTING_TEMPLATE.to_string(),
    }
}

fn app_shortcuts_have_duplicates<const N: usize>(shortcuts: [&str; N]) -> bool {
    let mut seen = std::collections::HashSet::new();
    shortcuts
        .into_iter()
        .map(normalized_shortcut_or_raw)
        .any(|shortcut| !seen.insert(shortcut))
}

fn normalized_shortcut_or_raw(shortcut: &str) -> String {
    normalize_app_shortcut(shortcut).unwrap_or_else(|_| shortcut.to_string())
}

fn write_app_settings_file(path: &Path, settings: &AppSettings) -> Result<(), String> {
    let contents = serialize_app_settings(settings)?;
    write_atomic(path, contents.as_bytes(), "settings.toml")
}

fn app_settings_file_needs_normalization(contents: &str, settings: &AppSettings) -> bool {
    serialize_app_settings(settings)
        .map(|normalized| normalized != contents)
        .unwrap_or(false)
}

fn serialize_app_settings(settings: &AppSettings) -> Result<String, String> {
    let writable = WritableAppSettings {
        appearance: &settings.appearance,
        palette_visible_count: settings.palette_visible_count,
        pinned_artifact_ids: &settings.pinned_artifact_ids,
        launch_at_login: settings.launch_at_login,
        // Reserved schema marker only; do not persist accidental internal true values.
        project_metadata_enabled: false,
        open_palette_shortcut: &settings.open_palette_shortcut,
        search_shortcut: &settings.search_shortcut,
        scratch_prompt_shortcut: &settings.scratch_prompt_shortcut,
        meta_prompting_enabled: settings.meta_prompting_enabled,
        meta_prompting_api_key: &settings.meta_prompting_api_key,
        meta_prompting_provider: &settings.meta_prompting_provider,
        meta_prompting_model: &settings.meta_prompting_model,
        meta_prompting_template: &settings.meta_prompting_template,
    };
    toml::to_string_pretty(&writable)
        .map_err(|error| format!("failed to serialize settings: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        default_app_settings, normalize_appearance, parse_app_settings, write_app_settings_file,
    };
    use crate::hotkeys::{
        DEFAULT_OPEN_PALETTE_SHORTCUT, DEFAULT_SCRATCH_PROMPT_SHORTCUT, DEFAULT_SEARCH_SHORTCUT,
    };
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn missing_settings_use_product_defaults() {
        let settings = parse_app_settings("").expect("settings");
        assert_eq!(settings.appearance, "dark");
        assert_eq!(settings.palette_visible_count, 5);
        assert!(settings.pinned_artifact_ids.is_empty());
        assert!(!settings.launch_at_login);
        assert!(!settings.project_metadata_enabled);
        assert!(!settings.open_palette_shortcut.is_empty());
        assert!(!settings.search_shortcut.is_empty());
        assert!(!settings.scratch_prompt_shortcut.is_empty());
        assert!(!settings.meta_prompting_enabled);
        assert!(settings.meta_prompting_api_key.is_empty());
        assert_eq!(settings.meta_prompting_provider, "openai");
        assert_eq!(settings.meta_prompting_model, "gpt-5-mini");
        assert!(settings.meta_prompting_template.contains("{input}"));
    }

    #[test]
    fn palette_visible_count_is_clamped() {
        let low = parse_app_settings(r#"palette_visible_count = 1"#).expect("settings");
        let high = parse_app_settings(r#"palette_visible_count = 42"#).expect("settings");
        let valid = parse_app_settings(r#"palette_visible_count = 7"#).expect("settings");

        assert_eq!(low.palette_visible_count, 3);
        assert_eq!(high.palette_visible_count, 9);
        assert_eq!(valid.palette_visible_count, 7);
    }

    #[test]
    fn appearance_is_normalized() {
        assert_eq!(normalize_appearance(Some("system")), "system");
        assert_eq!(normalize_appearance(Some("Light")), "light");
        assert_eq!(normalize_appearance(Some("dark")), "dark");
        assert_eq!(normalize_appearance(Some("sepia")), "dark");
        assert_eq!(normalize_appearance(None), "dark");

        let settings = parse_app_settings(r#"appearance = "light""#).expect("settings");
        assert_eq!(settings.appearance, "light");
    }

    #[test]
    fn pinned_artifact_ids_are_normalized() {
        let settings = parse_app_settings(
            r#"
            pinned_artifact_ids = ["review", "context", "review", "", "  scratch  "]
            "#,
        )
        .expect("settings");

        assert_eq!(
            settings.pinned_artifact_ids,
            vec!["review", "context", "scratch"]
        );
    }

    #[test]
    fn meta_prompting_settings_are_normalized() {
        let settings = parse_app_settings(
            r#"
            meta_prompting_enabled = true
            meta_prompting_api_key = "  sk-local  "
            meta_prompting_provider = "  OPENAI  "
            meta_prompting_model = "  gpt-5.1  "
            meta_prompting_template = "  Rewrite: {input}  "
            "#,
        )
        .expect("settings");
        assert!(settings.meta_prompting_enabled);
        assert_eq!(settings.meta_prompting_api_key, "sk-local");
        assert_eq!(settings.meta_prompting_provider, "openai");
        assert_eq!(settings.meta_prompting_model, "gpt-5.1");
        assert_eq!(settings.meta_prompting_template, "Rewrite: {input}");
    }

    #[test]
    fn project_metadata_setting_is_reserved_and_normalized_off() {
        let defaults = parse_app_settings("").expect("settings");
        let reserved = parse_app_settings(r#"project_metadata_enabled = true"#).expect("settings");

        assert!(!defaults.project_metadata_enabled);
        assert!(!reserved.project_metadata_enabled);
    }

    #[test]
    fn project_metadata_setting_is_written_off_even_if_internal_state_sets_true() {
        let mut settings = default_app_settings();
        settings.project_metadata_enabled = true;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "ult-settings-project-metadata-reserved-{}-{nonce}.toml",
            std::process::id()
        ));

        write_app_settings_file(&path, &settings).expect("write settings");
        let contents = std::fs::read_to_string(&path).expect("read settings");
        let _ = std::fs::remove_file(&path);

        assert!(contents.contains("project_metadata_enabled = false"));
        assert!(!contents.contains("project_metadata_enabled = true"));
        assert!(
            !parse_app_settings(&contents)
                .expect("parse written settings")
                .project_metadata_enabled
        );
    }

    #[test]
    fn explicit_empty_meta_prompting_values_are_preserved() {
        let settings = parse_app_settings(
            r#"
            meta_prompting_provider = ""
            meta_prompting_model = ""
            meta_prompting_template = ""
            "#,
        )
        .expect("settings");
        assert_eq!(settings.meta_prompting_provider, "");
        assert_eq!(settings.meta_prompting_model, "");
        assert_eq!(settings.meta_prompting_template, "");
    }

    #[test]
    fn app_settings_serialization_does_not_expose_meta_prompting_key() {
        let settings =
            parse_app_settings(r#"meta_prompting_api_key = "sk-local""#).expect("settings");
        let value = serde_json::to_value(settings).expect("json");
        assert!(value.get("meta_prompting_api_key").is_none());
    }

    #[test]
    fn invalid_shortcuts_fall_back_to_defaults() {
        let settings = parse_app_settings(
            r#"
            open_palette_shortcut = "not-a-shortcut"
            search_shortcut = "bad-search-shortcut"
            scratch_prompt_shortcut = "bad-scratch-shortcut"
            "#,
        )
        .expect("settings");
        assert_eq!(
            settings.open_palette_shortcut,
            DEFAULT_OPEN_PALETTE_SHORTCUT
        );
        assert_eq!(settings.search_shortcut, DEFAULT_SEARCH_SHORTCUT);
        assert_eq!(
            settings.scratch_prompt_shortcut,
            DEFAULT_SCRATCH_PROMPT_SHORTCUT
        );
    }

    #[test]
    fn legacy_default_shortcuts_migrate_to_current_defaults() {
        let settings = parse_app_settings(
            r#"
            open_palette_shortcut = "Cmd+Option+Control+Space"
            search_shortcut = "Cmd+Option+Control+F"
            scratch_prompt_shortcut = "Cmd+Option+Control+S"
            "#,
        )
        .expect("settings");
        assert_eq!(settings.open_palette_shortcut, "Cmd+U");
        assert_eq!(settings.search_shortcut, "Option+Space");
        assert_eq!(settings.scratch_prompt_shortcut, "Cmd+Option+Control+S");
    }

    #[test]
    fn reserved_default_launcher_shortcut_migrates_to_current_default() {
        let settings = parse_app_settings(
            r#"
            open_palette_shortcut = "Cmd+U"
            search_shortcut = "Cmd+Option+Space"
            scratch_prompt_shortcut = "Cmd+Option+Control+S"
            "#,
        )
        .expect("settings");
        assert_eq!(settings.open_palette_shortcut, "Cmd+U");
        assert_eq!(settings.search_shortcut, "Option+Space");
        assert_eq!(settings.scratch_prompt_shortcut, "Cmd+Option+Control+S");
    }

    #[test]
    fn duplicate_app_shortcuts_fall_back_to_defaults() {
        let settings = parse_app_settings(
            r#"
            open_palette_shortcut = "Cmd+U"
            search_shortcut = "Cmd+U"
            scratch_prompt_shortcut = "Cmd+Option+Control+S"
            "#,
        )
        .expect("settings");
        assert_eq!(settings.open_palette_shortcut, "Cmd+U");
        assert_eq!(settings.search_shortcut, "Option+Space");
        assert_eq!(settings.scratch_prompt_shortcut, "Cmd+Option+Control+S");
    }
}
