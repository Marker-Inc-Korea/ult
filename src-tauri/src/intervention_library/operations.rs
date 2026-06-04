use std::collections::HashSet;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Runtime};

use crate::atomic_write::write_atomic;
use crate::config_lock::with_config_write_lock;

use super::catalog::{ensure_ult_home_for_app, load_intervention_library_from_disk};
use super::files::{
    parse_import_prompt_contents, prompt_file_to_markdown, remove_artifact_package_source,
    write_prompt_file_to_path, write_prompt_file_to_registry,
};
use super::model::{PromptDefinition, PromptExportResult, PromptImportSummary, PromptLoadResult};
use super::paths::{artifact_package_file_name, export_package_dir, prompt_file_path};
use super::validation::validate_prompt_definition;

pub fn add_intervention_artifact<R: Runtime>(
    app: &AppHandle<R>,
    prompt: PromptDefinition,
) -> Result<PromptDefinition, String> {
    with_config_write_lock(|| add_intervention_artifact_unlocked(app, prompt))
}

pub(crate) fn add_intervention_artifact_unlocked<R: Runtime>(
    app: &AppHandle<R>,
    prompt: PromptDefinition,
) -> Result<PromptDefinition, String> {
    let ult_home = ensure_ult_home_for_app(app)?;

    let prompt = validate_prompt_definition(prompt)?;

    let existing = load_intervention_library_from_disk(app);
    if existing.artifacts.iter().any(|entry| entry.id == prompt.id) {
        return Err(format!(
            "artifact `{}` already exists in the library",
            prompt.id
        ));
    }

    write_prompt_file_to_registry(&ult_home, &prompt)?;

    Ok(prompt)
}

pub fn update_intervention_artifact<R: Runtime>(
    app: &AppHandle<R>,
    original_id: String,
    prompt: PromptDefinition,
) -> Result<PromptDefinition, String> {
    with_config_write_lock(|| update_intervention_artifact_unlocked(app, original_id, prompt))
}

pub(crate) fn update_intervention_artifact_unlocked<R: Runtime>(
    app: &AppHandle<R>,
    original_id: String,
    prompt: PromptDefinition,
) -> Result<PromptDefinition, String> {
    let ult_home = ensure_ult_home_for_app(app)?;

    let prompt = validate_prompt_definition(prompt)?;

    let existing = load_intervention_library_from_disk(app);
    let current_entry = existing
        .entries
        .iter()
        .find(|entry| entry.prompt.id == original_id && entry.editable)
        .ok_or_else(|| format!("artifact `{original_id}` is not editable in the library"))?;

    if prompt.id != original_id && existing.artifacts.iter().any(|entry| entry.id == prompt.id) {
        return Err(format!(
            "artifact `{}` already exists in the library",
            prompt.id
        ));
    }

    let old_path = current_entry
        .source_path
        .as_ref()
        .map(PathBuf::from)
        .ok_or_else(|| format!("artifact `{original_id}` does not have an editable source file"))?;
    let new_path = prompt_file_path(&ult_home, &prompt, "md");
    write_prompt_file_to_path(&new_path, &prompt)?;
    if old_path != new_path && old_path.exists() {
        remove_artifact_package_source(&old_path)?;
    }
    Ok(prompt)
}

pub fn delete_intervention_artifact<R: Runtime>(
    app: &AppHandle<R>,
    prompt_id: String,
) -> Result<(), String> {
    with_config_write_lock(|| delete_intervention_artifact_unlocked(app, prompt_id))
}

pub(crate) fn delete_intervention_artifact_unlocked<R: Runtime>(
    app: &AppHandle<R>,
    prompt_id: String,
) -> Result<(), String> {
    ensure_ult_home_for_app(app)?;

    let existing = load_intervention_library_from_disk(app);
    let entry = existing
        .entries
        .iter()
        .find(|entry| entry.prompt.id == prompt_id && entry.editable)
        .ok_or_else(|| format!("artifact `{prompt_id}` is not editable in the library"))?;
    let path = entry
        .source_path
        .as_ref()
        .map(PathBuf::from)
        .ok_or_else(|| format!("artifact `{prompt_id}` does not have an editable source file"))?;
    remove_artifact_package_source(&path)
}

pub fn import_intervention_artifacts<R: Runtime>(
    app: &AppHandle<R>,
    contents: String,
) -> Result<PromptImportSummary, String> {
    with_config_write_lock(|| import_intervention_artifacts_unlocked(app, contents))
}

pub(crate) fn import_intervention_artifacts_unlocked<R: Runtime>(
    app: &AppHandle<R>,
    contents: String,
) -> Result<PromptImportSummary, String> {
    let ult_home = ensure_ult_home_for_app(app)?;
    let imported_prompts = parse_import_prompt_contents(&contents)?;
    if imported_prompts.is_empty() {
        return Err("imported artifact file does not contain an artifact".to_string());
    }

    let mut seen_ids = HashSet::new();
    for prompt in &imported_prompts {
        if !seen_ids.insert(prompt.id.clone()) {
            return Err(format!(
                "imported artifact file contains duplicate artifact id `{}`",
                prompt.id
            ));
        }
    }

    let existing = load_intervention_library_from_disk(app);
    let editable_ids = existing
        .entries
        .iter()
        .filter(|entry| entry.editable)
        .map(|entry| entry.prompt.id.as_str())
        .collect::<HashSet<_>>();
    let mut imported_count = 0;
    let mut updated_count = 0;
    let mut imported_artifact_ids = Vec::new();

    for prompt in imported_prompts {
        imported_artifact_ids.push(prompt.id.clone());
        if editable_ids.contains(prompt.id.as_str()) {
            updated_count += 1;
        } else {
            imported_count += 1;
        }
        write_prompt_file_to_registry(&ult_home, &prompt)?;
    }

    Ok(PromptImportSummary {
        imported_count,
        updated_count,
        imported_artifact_ids,
    })
}

pub fn export_intervention_artifacts<R: Runtime>(
    app: &AppHandle<R>,
    artifact_ids: Vec<String>,
) -> Result<PromptExportResult, String> {
    let ult_home = ensure_ult_home_for_app(app)?;
    let registry = load_intervention_library_from_disk(app);
    export_intervention_artifacts_from_registry(&ult_home, registry, artifact_ids)
}

pub(crate) fn export_intervention_artifacts_from_registry(
    ult_home: &Path,
    registry: PromptLoadResult,
    artifact_ids: Vec<String>,
) -> Result<PromptExportResult, String> {
    let artifact_ids = normalize_prompt_id_filter(artifact_ids);
    let mut selected_prompts = registry
        .entries
        .into_iter()
        .filter(|entry| entry.editable)
        .filter(|entry| artifact_ids.is_empty() || artifact_ids.contains(&entry.prompt.id))
        .map(|entry| entry.prompt)
        .collect::<Vec<_>>();

    if selected_prompts.is_empty() {
        return Err("no editable local artifacts matched the export selection".to_string());
    }
    if selected_prompts.len() > 1 {
        return Err("export one artifact at a time".to_string());
    }

    let prompt = selected_prompts.remove(0);
    let export_path = export_package_dir(ult_home, &prompt)
        .join(artifact_package_file_name(prompt.artifact_type));
    let contents = prompt_file_to_markdown(&prompt)?;
    write_atomic(&export_path, contents.as_bytes(), "artifact-export.md")?;
    Ok(PromptExportResult {
        file_path: export_path.display().to_string(),
        artifact_count: 1,
    })
}

pub fn prompt_source_path_for_app<R: Runtime>(
    app: &AppHandle<R>,
    prompt_id: &str,
) -> Result<PathBuf, String> {
    let registry = load_intervention_library_from_disk(app);
    let entry = registry
        .entries
        .iter()
        .find(|entry| entry.prompt.id == prompt_id)
        .ok_or_else(|| format!("artifact `{prompt_id}` was not found in the library"))?;
    entry
        .source_path
        .as_ref()
        .map(PathBuf::from)
        .ok_or_else(|| format!("artifact `{prompt_id}` is bundled and has no local source file"))
}

pub(crate) fn normalize_prompt_id_filter(prompt_ids: Vec<String>) -> HashSet<String> {
    prompt_ids
        .into_iter()
        .map(|prompt_id| prompt_id.trim().to_string())
        .filter(|prompt_id| !prompt_id.is_empty())
        .collect()
}
