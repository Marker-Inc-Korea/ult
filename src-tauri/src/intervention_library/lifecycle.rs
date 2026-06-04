use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Runtime};

use crate::config_lock::with_config_write_lock;

use super::catalog::{bundled_prompt_entries, ensure_ult_home_for_app};
use super::files::{load_local_prompt_file, write_prompt_file_to_registry};
use super::model::{
    InputPrompt, PromptArtifactSource, PromptArtifactType, PromptDefinition, PromptScope,
    EPHEMERAL_ARTIFACT_TTL_MS,
};
use super::paths::{
    context_scope_dir, persistent_skills_dir, prompt_scope_dir, LocalArtifactClass,
    CONTEXT_PACKAGE_FILE, PROMPT_PACKAGE_FILE, SKILL_PACKAGE_FILE,
};
use super::validation::validate_prompt;

const OPAQUE_ARTIFACT_ID_HEX_LEN: usize = 7;
const OPAQUE_ARTIFACT_ID_ATTEMPTS: usize = 64;

pub fn cleanup_expired_ephemeral_artifacts_for_app<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<usize, String> {
    let ult_home = ensure_ult_home_for_app(app)?;
    with_config_write_lock(|| cleanup_expired_ephemeral_artifacts(&ult_home, timestamp_ms()))
}

pub fn capture_ephemeral_context_artifact<R: Runtime>(
    app: &AppHandle<R>,
    text: String,
    created_at: u64,
) -> Result<PromptDefinition, String> {
    let ult_home = ensure_ult_home_for_app(app)?;
    with_config_write_lock(|| {
        capture_ephemeral_context_artifact_unlocked(&ult_home, text, created_at)
    })
}

pub fn save_workflow_input_context_artifact<R: Runtime>(
    app: &AppHandle<R>,
    text: String,
    workflow_title: String,
    created_at: u64,
) -> Result<PromptDefinition, String> {
    let ult_home = ensure_ult_home_for_app(app)?;
    with_config_write_lock(|| {
        save_workflow_input_context_artifact_unlocked(&ult_home, text, workflow_title, created_at)
    })
}

pub(crate) fn capture_ephemeral_context_artifact_unlocked(
    ult_home: &Path,
    text: String,
    created_at: u64,
) -> Result<PromptDefinition, String> {
    cleanup_expired_ephemeral_artifacts(ult_home, created_at)?;
    let prompt = text.trim().to_string();
    if prompt.is_empty() {
        return Err("ephemeral context is empty".to_string());
    }

    let id = unique_ephemeral_context_id(ult_home)?;
    let context = validate_prompt(
        InputPrompt {
            id: Some(id),
            title: clipboard_context_title(&prompt),
            artifact_type: Some(PromptArtifactType::Context),
            scope: Some(PromptScope::Ephemeral),
            pinned: false,
            prompt,
            contexts: Vec::new(),
            description: clipboard_context_description(&text),
            shortcut: None,
            confirm: false,
            template_arguments: Vec::new(),
            created_at: Some(created_at),
            expires_at: Some(ephemeral_expires_at(created_at)),
            source: PromptArtifactSource::Clipboard,
        },
        None,
    )?;
    write_prompt_file_to_registry(ult_home, &context)?;
    Ok(context)
}

pub(crate) fn save_workflow_input_context_artifact_unlocked(
    ult_home: &Path,
    text: String,
    workflow_title: String,
    created_at: u64,
) -> Result<PromptDefinition, String> {
    cleanup_expired_ephemeral_artifacts(ult_home, created_at)?;
    let prompt = text.trim().to_string();
    if prompt.is_empty() {
        return Err("workflow input context is empty".to_string());
    }

    let id = unique_ephemeral_context_id(ult_home)?;
    let context = validate_prompt(
        InputPrompt {
            id: Some(id),
            title: workflow_context_title(&workflow_title),
            artifact_type: Some(PromptArtifactType::Context),
            scope: Some(PromptScope::Ephemeral),
            pinned: false,
            prompt,
            contexts: Vec::new(),
            description: workflow_context_description(&workflow_title),
            shortcut: None,
            confirm: false,
            template_arguments: Vec::new(),
            created_at: Some(created_at),
            expires_at: Some(ephemeral_expires_at(created_at)),
            source: PromptArtifactSource::User,
        },
        None,
    )?;
    write_prompt_file_to_registry(ult_home, &context)?;
    Ok(context)
}

pub(crate) fn cleanup_expired_ephemeral_artifacts(
    ult_home: &Path,
    now_ms: u64,
) -> Result<usize, String> {
    let mut removed = 0;
    for (path, class) in [
        (
            prompt_scope_dir(ult_home, PromptScope::Ephemeral),
            LocalArtifactClass::EphemeralPrompt,
        ),
        (
            context_scope_dir(ult_home, PromptScope::Ephemeral),
            LocalArtifactClass::EphemeralContext,
        ),
    ] {
        let Ok(entries) = fs::read_dir(&path) else {
            continue;
        };
        for entry in entries.filter_map(Result::ok) {
            let package_dir = entry.path();
            if !package_dir.is_dir() {
                continue;
            }
            let artifact_path = package_dir.join(class.package_file_name());
            if !artifact_path.is_file() {
                continue;
            }
            let Ok(prompt) = load_local_prompt_file(&artifact_path, class) else {
                continue;
            };
            if !is_expired_ephemeral_artifact(&prompt, now_ms) {
                continue;
            }
            fs::remove_dir_all(&package_dir)
                .map_err(|error| format!("failed to remove {}: {error}", package_dir.display()))?;
            removed += 1;
        }
    }
    Ok(removed)
}

pub(crate) fn unique_ephemeral_context_id(ult_home: &Path) -> Result<String, String> {
    let existing = personal_library_artifact_ids(ult_home)?;
    first_available_opaque_id(
        &existing,
        (0..OPAQUE_ARTIFACT_ID_ATTEMPTS).map(|_| random_opaque_artifact_id()),
        "ephemeral context",
    )
}

pub(crate) fn first_available_opaque_id<I>(
    existing: &HashSet<String>,
    candidates: I,
    label: &str,
) -> Result<String, String>
where
    I: IntoIterator<Item = Result<String, String>>,
{
    for candidate in candidates {
        let candidate = candidate?;
        if !existing.contains(candidate.as_str()) {
            return Ok(candidate);
        }
    }
    Err(format!("failed to allocate a unique {label} handle"))
}

pub(crate) fn random_opaque_artifact_id() -> Result<String, String> {
    let mut bytes = [0u8; 4];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("failed to generate opaque artifact id: {error}"))?;
    Ok(format!("{:08x}", u32::from_be_bytes(bytes))
        .chars()
        .take(OPAQUE_ARTIFACT_ID_HEX_LEN)
        .collect())
}

pub(crate) fn personal_library_artifact_ids(ult_home: &Path) -> Result<HashSet<String>, String> {
    let mut ids = bundled_prompt_entries()?
        .into_iter()
        .map(|entry| entry.prompt.id)
        .collect::<HashSet<_>>();
    for (path, package_file) in [
        (
            prompt_scope_dir(ult_home, PromptScope::Persistent),
            PROMPT_PACKAGE_FILE,
        ),
        (
            prompt_scope_dir(ult_home, PromptScope::Ephemeral),
            PROMPT_PACKAGE_FILE,
        ),
        (
            context_scope_dir(ult_home, PromptScope::Persistent),
            CONTEXT_PACKAGE_FILE,
        ),
        (
            context_scope_dir(ult_home, PromptScope::Ephemeral),
            CONTEXT_PACKAGE_FILE,
        ),
    ] {
        let Ok(entries) = fs::read_dir(path) else {
            continue;
        };
        ids.extend(
            entries
                .filter_map(Result::ok)
                .filter_map(|entry| artifact_id_from_package_dir(&entry.path(), package_file)),
        );
    }
    if let Ok(entries) = fs::read_dir(persistent_skills_dir(ult_home)) {
        ids.extend(
            entries
                .filter_map(Result::ok)
                .filter_map(|entry| artifact_id_from_skill_dir(&entry.path())),
        );
    }
    Ok(ids)
}

pub(crate) fn artifact_id_from_package_dir(path: &Path, package_file: &str) -> Option<String> {
    if !path.is_dir() || !path.join(package_file).is_file() {
        return None;
    }
    path.file_name()
        .and_then(|file_name| file_name.to_str())
        .map(str::trim)
        .filter(|file_name| !file_name.is_empty())
        .map(ToString::to_string)
}

pub(crate) fn artifact_id_from_skill_dir(path: &Path) -> Option<String> {
    if !path.is_dir() || !path.join(SKILL_PACKAGE_FILE).is_file() {
        return None;
    }
    path.file_name()
        .and_then(|file_name| file_name.to_str())
        .map(str::trim)
        .filter(|file_name| !file_name.is_empty())
        .map(ToString::to_string)
}

pub(crate) fn clipboard_context_title(text: &str) -> String {
    let preview = clipboard_context_description(text);
    if preview.is_empty() {
        "Clipboard Context".to_string()
    } else {
        preview
    }
}

pub(crate) fn clipboard_context_description(text: &str) -> String {
    let first_line = text
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("");
    let mut chars = first_line.chars();
    let preview = chars.by_ref().take(96).collect::<String>();
    if chars.next().is_some() {
        format!("{preview}...")
    } else {
        preview
    }
}

fn workflow_context_title(workflow_title: &str) -> String {
    let title = workflow_title.trim();
    if title.is_empty() {
        return "Workflow Input".to_string();
    }
    let title = format!("{title} Input");
    let mut chars = title.chars();
    let preview = chars.by_ref().take(48).collect::<String>();
    if chars.next().is_some() {
        format!("{preview}...")
    } else {
        preview
    }
}

fn workflow_context_description(workflow_title: &str) -> String {
    let title = workflow_title.trim();
    if title.is_empty() {
        return "Explicit workflow input context.".to_string();
    }
    let description = format!("Explicit input for {title}.");
    let mut chars = description.chars();
    let preview = chars.by_ref().take(96).collect::<String>();
    if chars.next().is_some() {
        format!("{preview}...")
    } else {
        preview
    }
}

pub(crate) fn timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

pub(crate) fn ephemeral_expires_at(created_at: u64) -> u64 {
    created_at.saturating_add(EPHEMERAL_ARTIFACT_TTL_MS)
}

pub(crate) fn is_expired_ephemeral_artifact(prompt: &PromptDefinition, now_ms: u64) -> bool {
    prompt.scope == PromptScope::Ephemeral
        && prompt
            .expires_at
            .is_some_and(|expires_at| expires_at <= now_ms)
}
