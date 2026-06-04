use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};

use crate::atomic_write::write_atomic;
use crate::config_lock::with_config_write_lock;

use super::catalog::load_intervention_library_from_disk;
use super::files::{prompt_file_to_markdown, skill_file_to_markdown, split_markdown_front_matter};
use super::model::{PromptArtifactType, PromptDefinition, PromptLoadResult};
use super::paths::{CONTEXT_PACKAGE_FILE, PROMPT_PACKAGE_FILE, SKILL_PACKAGE_FILE};

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectArtifactWriteKind {
    Prompt,
    Context,
    Skill,
    AgentsSnippet,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectArtifactWriteRequest {
    pub artifact_id: String,
    pub write_kind: ProjectArtifactWriteKind,
    pub target_directory: String,
    #[serde(default)]
    pub overwrite: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProjectArtifactWriteAction {
    Create,
    Overwrite,
    Blocked,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectArtifactWriteFile {
    pub relative_path: String,
    pub path: String,
    pub exists: bool,
    pub action: ProjectArtifactWriteAction,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectArtifactWritePreview {
    pub artifact_id: String,
    pub artifact_type: PromptArtifactType,
    pub write_kind: ProjectArtifactWriteKind,
    pub target_directory: String,
    pub files: Vec<ProjectArtifactWriteFile>,
    pub requires_overwrite_confirmation: bool,
    pub ready_to_write: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectArtifactWriteResult {
    pub artifact_id: String,
    pub write_kind: ProjectArtifactWriteKind,
    pub target_directory: String,
    pub written_files: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ProjectSetupWriteTarget {
    pub artifact_id: String,
    pub write_kind: ProjectArtifactWriteKind,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectSetupPreviewRequest {
    pub target_directory: String,
    pub targets: Vec<ProjectSetupWriteTarget>,
    #[serde(default)]
    pub overwrite: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectSetupWriteRequest {
    pub target_directory: String,
    pub targets: Vec<ProjectSetupWriteTarget>,
    #[serde(default)]
    pub overwrite: bool,
    pub plan_hash: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSetupPreviewEntry {
    pub artifact_id: String,
    pub write_kind: ProjectArtifactWriteKind,
    pub preview: Option<ProjectArtifactWritePreview>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSetupPreview {
    pub target_directory: String,
    pub entries: Vec<ProjectSetupPreviewEntry>,
    pub requires_overwrite_confirmation: bool,
    pub ready_to_write: bool,
    pub plan_hash: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSetupResultEntry {
    pub artifact_id: String,
    pub write_kind: ProjectArtifactWriteKind,
    pub result: Option<ProjectArtifactWriteResult>,
    pub error: Option<String>,
    pub files: Vec<ProjectArtifactWriteFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectSetupResult {
    pub target_directory: String,
    pub plan_hash: String,
    pub entries: Vec<ProjectSetupResultEntry>,
    pub written_files: Vec<String>,
    pub failed_files: Vec<String>,
    pub ok: bool,
}

#[derive(Debug, Clone)]
struct ProjectArtifactWritePlan {
    preview: ProjectArtifactWritePreview,
    contents: String,
    target_path: PathBuf,
}

struct ProjectSetupPlanEntry {
    target: ProjectSetupWriteTarget,
    plan: Option<ProjectArtifactWritePlan>,
    error: Option<String>,
}

struct ProjectSetupPlan {
    preview: ProjectSetupPreview,
    entries: Vec<ProjectSetupPlanEntry>,
}

pub fn preview_project_artifact_write<R: Runtime>(
    app: &AppHandle<R>,
    request: ProjectArtifactWriteRequest,
) -> Result<ProjectArtifactWritePreview, String> {
    let registry = load_intervention_library_from_disk(app);
    project_artifact_write_plan(registry, request).map(|plan| plan.preview)
}

pub fn write_project_artifact<R: Runtime>(
    app: &AppHandle<R>,
    request: ProjectArtifactWriteRequest,
) -> Result<ProjectArtifactWriteResult, String> {
    with_config_write_lock(|| {
        let registry = load_intervention_library_from_disk(app);
        write_project_artifact_from_registry(registry, request)
    })
}

pub fn preview_project_setup<R: Runtime>(
    app: &AppHandle<R>,
    request: ProjectSetupPreviewRequest,
) -> Result<ProjectSetupPreview, String> {
    let registry = load_intervention_library_from_disk(app);
    project_setup_plan(registry, request).map(|plan| plan.preview)
}

pub fn write_project_setup<R: Runtime>(
    app: &AppHandle<R>,
    request: ProjectSetupWriteRequest,
) -> Result<ProjectSetupResult, String> {
    with_config_write_lock(|| {
        let registry = load_intervention_library_from_disk(app);
        write_project_setup_from_registry(registry, request)
    })
}

pub(crate) fn write_project_artifact_from_registry(
    registry: PromptLoadResult,
    request: ProjectArtifactWriteRequest,
) -> Result<ProjectArtifactWriteResult, String> {
    let overwrite = request.overwrite;
    let plan = project_artifact_write_plan(registry, request)?;
    if plan
        .preview
        .files
        .iter()
        .any(|file| file.exists && !overwrite)
    {
        return Err("project file already exists; confirm overwrite before writing".to_string());
    }

    write_atomic(
        &plan.target_path,
        plan.contents.as_bytes(),
        "project artifact export",
    )?;
    Ok(ProjectArtifactWriteResult {
        artifact_id: plan.preview.artifact_id,
        write_kind: plan.preview.write_kind,
        target_directory: plan.preview.target_directory,
        written_files: plan
            .preview
            .files
            .into_iter()
            .map(|file| file.path)
            .collect(),
    })
}

#[cfg(test)]
pub(crate) fn preview_project_artifact_write_from_registry(
    registry: PromptLoadResult,
    request: ProjectArtifactWriteRequest,
) -> Result<ProjectArtifactWritePreview, String> {
    project_artifact_write_plan(registry, request).map(|plan| plan.preview)
}

#[cfg(test)]
pub(crate) fn preview_project_setup_from_registry(
    registry: PromptLoadResult,
    request: ProjectSetupPreviewRequest,
) -> Result<ProjectSetupPreview, String> {
    project_setup_plan(registry, request).map(|plan| plan.preview)
}

#[cfg(test)]
pub(crate) fn write_project_setup_from_registry_for_test(
    registry: PromptLoadResult,
    request: ProjectSetupWriteRequest,
) -> Result<ProjectSetupResult, String> {
    write_project_setup_from_registry(registry, request)
}

pub(crate) fn write_project_setup_from_registry(
    registry: PromptLoadResult,
    request: ProjectSetupWriteRequest,
) -> Result<ProjectSetupResult, String> {
    let expected_hash = request.plan_hash.trim();
    if expected_hash.is_empty() {
        return Err("project setup preview is required before writing".to_string());
    }

    let plan = project_setup_plan(
        registry,
        ProjectSetupPreviewRequest {
            target_directory: request.target_directory,
            targets: request.targets,
            overwrite: request.overwrite,
        },
    )?;
    if plan.preview.plan_hash != expected_hash {
        return Err("project setup preview is stale; preview project files again".to_string());
    }
    if plan
        .preview
        .entries
        .iter()
        .any(|entry| entry.error.is_some())
    {
        return Err("resolve project setup preview errors before writing".to_string());
    }
    if plan.preview.requires_overwrite_confirmation && !request.overwrite {
        return Err("confirm overwrite before writing existing project files".to_string());
    }

    let target_directory = plan.preview.target_directory.clone();
    let plan_hash = plan.preview.plan_hash.clone();
    let mut entries = Vec::new();
    let mut written_files = Vec::new();
    let mut failed_files = Vec::new();

    for entry in plan.entries {
        match entry.plan {
            Some(write_plan) => {
                let files = write_plan.preview.files.clone();
                let write_result = write_atomic(
                    &write_plan.target_path,
                    write_plan.contents.as_bytes(),
                    "project setup file",
                );
                match write_result {
                    Ok(()) => {
                        let result = ProjectArtifactWriteResult {
                            artifact_id: write_plan.preview.artifact_id.clone(),
                            write_kind: write_plan.preview.write_kind,
                            target_directory: write_plan.preview.target_directory.clone(),
                            written_files: write_plan
                                .preview
                                .files
                                .iter()
                                .map(|file| file.path.clone())
                                .collect(),
                        };
                        written_files.extend(result.written_files.clone());
                        entries.push(ProjectSetupResultEntry {
                            artifact_id: entry.target.artifact_id,
                            write_kind: entry.target.write_kind,
                            result: Some(result),
                            error: None,
                            files,
                        });
                    }
                    Err(error) => {
                        failed_files.extend(files.iter().map(|file| file.path.clone()));
                        entries.push(ProjectSetupResultEntry {
                            artifact_id: entry.target.artifact_id,
                            write_kind: entry.target.write_kind,
                            result: None,
                            error: Some(error),
                            files,
                        });
                    }
                }
            }
            None => {
                entries.push(ProjectSetupResultEntry {
                    artifact_id: entry.target.artifact_id,
                    write_kind: entry.target.write_kind,
                    result: None,
                    error: entry.error,
                    files: Vec::new(),
                });
            }
        }
    }

    Ok(ProjectSetupResult {
        target_directory,
        plan_hash,
        ok: failed_files.is_empty(),
        entries,
        written_files,
        failed_files,
    })
}

fn project_artifact_write_plan(
    registry: PromptLoadResult,
    request: ProjectArtifactWriteRequest,
) -> Result<ProjectArtifactWritePlan, String> {
    let artifact_id = request.artifact_id.trim();
    if artifact_id.is_empty() {
        return Err("artifact id is required".to_string());
    }
    let artifact = registry
        .artifacts
        .iter()
        .find(|artifact| artifact.id == artifact_id)
        .ok_or_else(|| format!("artifact `{artifact_id}` was not found in the library"))?;
    validate_project_write_kind(artifact, request.write_kind)?;

    let target_directory = project_target_directory(&request.target_directory)?;
    let relative_path = project_relative_path(artifact, request.write_kind);
    let target_path = target_directory.join(&relative_path);
    let exists = target_path.exists();
    let action = if exists {
        if request.overwrite {
            ProjectArtifactWriteAction::Overwrite
        } else {
            ProjectArtifactWriteAction::Blocked
        }
    } else {
        ProjectArtifactWriteAction::Create
    };
    let file = ProjectArtifactWriteFile {
        relative_path: path_label(&relative_path),
        path: path_label(&target_path),
        exists,
        action,
    };
    let contents = project_write_contents(artifact, request.write_kind)?;
    let ready_to_write = !exists || request.overwrite;
    let preview = ProjectArtifactWritePreview {
        artifact_id: artifact.id.clone(),
        artifact_type: artifact.artifact_type,
        write_kind: request.write_kind,
        target_directory: path_label(&target_directory),
        files: vec![file],
        requires_overwrite_confirmation: exists,
        ready_to_write,
    };

    Ok(ProjectArtifactWritePlan {
        preview,
        contents,
        target_path,
    })
}

fn project_setup_plan(
    registry: PromptLoadResult,
    request: ProjectSetupPreviewRequest,
) -> Result<ProjectSetupPlan, String> {
    if request.targets.is_empty() {
        return Err("select at least one project setup item".to_string());
    }
    let target_directory = project_target_directory(&request.target_directory)?;
    let target_directory_label = path_label(&target_directory);
    let mut entries = Vec::new();
    let mut preview_entries = Vec::new();

    for target in request.targets {
        let artifact_id = target.artifact_id.trim().to_string();
        let normalized_target = ProjectSetupWriteTarget {
            artifact_id,
            write_kind: target.write_kind,
        };
        let artifact_request = ProjectArtifactWriteRequest {
            artifact_id: normalized_target.artifact_id.clone(),
            write_kind: normalized_target.write_kind,
            target_directory: target_directory_label.clone(),
            overwrite: request.overwrite,
        };
        match project_artifact_write_plan(registry.clone(), artifact_request) {
            Ok(plan) => {
                preview_entries.push(ProjectSetupPreviewEntry {
                    artifact_id: normalized_target.artifact_id.clone(),
                    write_kind: normalized_target.write_kind,
                    preview: Some(plan.preview.clone()),
                    error: None,
                });
                entries.push(ProjectSetupPlanEntry {
                    target: normalized_target,
                    plan: Some(plan),
                    error: None,
                });
            }
            Err(error) => {
                preview_entries.push(ProjectSetupPreviewEntry {
                    artifact_id: normalized_target.artifact_id.clone(),
                    write_kind: normalized_target.write_kind,
                    preview: None,
                    error: Some(error.clone()),
                });
                entries.push(ProjectSetupPlanEntry {
                    target: normalized_target,
                    plan: None,
                    error: Some(error),
                });
            }
        }
    }

    let requires_overwrite_confirmation = preview_entries.iter().any(|entry| {
        entry
            .preview
            .as_ref()
            .map(|preview| preview.requires_overwrite_confirmation)
            .unwrap_or(false)
    });
    let ready_to_write = preview_entries.iter().all(|entry| {
        entry.error.is_none()
            && entry
                .preview
                .as_ref()
                .map(|preview| preview.ready_to_write)
                .unwrap_or(false)
    });
    let plan_hash = project_setup_plan_hash(&target_directory_label, &entries);
    Ok(ProjectSetupPlan {
        preview: ProjectSetupPreview {
            target_directory: target_directory_label,
            entries: preview_entries,
            requires_overwrite_confirmation,
            ready_to_write,
            plan_hash,
        },
        entries,
    })
}

fn project_target_directory(input: &str) -> Result<PathBuf, String> {
    let value = input.trim();
    if value.is_empty() {
        return Err("project target directory is required".to_string());
    }
    let path = expand_home_path(value);
    if !path.is_dir() {
        return Err(format!(
            "project target directory does not exist: {}",
            path.display()
        ));
    }
    fs::canonicalize(&path)
        .map_err(|error| format!("failed to resolve project target directory: {error}"))
}

fn expand_home_path(input: &str) -> PathBuf {
    if input == "~" {
        if let Some(home) = home_dir() {
            return home;
        }
    }
    if let Some(rest) = input.strip_prefix("~/") {
        if let Some(home) = home_dir() {
            return home.join(rest);
        }
    }
    PathBuf::from(input)
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .filter(|home| !home.is_empty())
        .map(PathBuf::from)
}

fn validate_project_write_kind(
    artifact: &PromptDefinition,
    write_kind: ProjectArtifactWriteKind,
) -> Result<(), String> {
    match write_kind {
        ProjectArtifactWriteKind::Prompt
            if artifact.artifact_type != PromptArtifactType::Prompt =>
        {
            Err("Export Prompt to Project requires a prompt artifact".to_string())
        }
        ProjectArtifactWriteKind::Context
            if artifact.artifact_type != PromptArtifactType::Context =>
        {
            Err("Export Context to Project requires a context artifact".to_string())
        }
        ProjectArtifactWriteKind::Skill if artifact.artifact_type != PromptArtifactType::Skill => {
            Err("Install Skill to Project requires a skill artifact".to_string())
        }
        _ => Ok(()),
    }
}

fn project_relative_path(
    artifact: &PromptDefinition,
    write_kind: ProjectArtifactWriteKind,
) -> PathBuf {
    match write_kind {
        ProjectArtifactWriteKind::Prompt => PathBuf::from(".ult")
            .join("prompts")
            .join(&artifact.id)
            .join(PROMPT_PACKAGE_FILE),
        ProjectArtifactWriteKind::Context => PathBuf::from(".ult")
            .join("contexts")
            .join(&artifact.id)
            .join(CONTEXT_PACKAGE_FILE),
        ProjectArtifactWriteKind::Skill => PathBuf::from(".codex")
            .join("skills")
            .join(&artifact.id)
            .join(SKILL_PACKAGE_FILE),
        ProjectArtifactWriteKind::AgentsSnippet => PathBuf::from("AGENTS.md"),
    }
}

fn project_write_contents(
    artifact: &PromptDefinition,
    write_kind: ProjectArtifactWriteKind,
) -> Result<String, String> {
    match write_kind {
        ProjectArtifactWriteKind::Prompt | ProjectArtifactWriteKind::Context => {
            prompt_file_to_markdown(artifact)
        }
        ProjectArtifactWriteKind::Skill => skill_file_to_markdown(artifact),
        ProjectArtifactWriteKind::AgentsSnippet => Ok(agents_snippet_markdown(artifact)),
    }
}

fn agents_snippet_markdown(artifact: &PromptDefinition) -> String {
    let handle = match artifact.artifact_type {
        PromptArtifactType::Prompt => format!("#{}", artifact.id),
        PromptArtifactType::Context => format!("@{}", artifact.id),
        PromptArtifactType::Skill => format!("${}", artifact.id),
    };
    let kind = match artifact.artifact_type {
        PromptArtifactType::Prompt => "Prompt",
        PromptArtifactType::Context => "Context",
        PromptArtifactType::Skill => "Skill",
    };
    let body = artifact_body_for_agents(artifact);
    let description = artifact.description.trim();
    let description_block = if description.is_empty() {
        String::new()
    } else {
        format!("{description}\n\n")
    };

    format!(
        "# Project Agent Instructions\n\n## Ult {kind}: {handle} {title}\n\n{description_block}Use this explicit project-local snippet when the workflow calls for `{handle}`.\n\n```text\n{body}\n```\n",
        title = artifact.title.trim(),
        body = body.trim(),
    )
}

fn artifact_body_for_agents(artifact: &PromptDefinition) -> String {
    if artifact.artifact_type == PromptArtifactType::Skill {
        return split_markdown_front_matter(&artifact.prompt)
            .map(|(_front_matter, body)| body)
            .unwrap_or_else(|_| artifact.prompt.clone());
    }
    artifact.prompt.clone()
}

fn path_label(path: &Path) -> String {
    path.display().to_string()
}

fn project_setup_plan_hash(target_directory: &str, entries: &[ProjectSetupPlanEntry]) -> String {
    let mut hasher = StablePlanHasher::new();
    hasher.feed("project-setup-v1");
    hasher.feed(target_directory);
    for entry in entries {
        hasher.feed(&entry.target.artifact_id);
        hasher.feed(project_write_kind_token(entry.target.write_kind));
        if let Some(error) = &entry.error {
            hasher.feed("error");
            hasher.feed(error);
        }
        if let Some(plan) = &entry.plan {
            hasher.feed("plan");
            hasher.feed(&plan.preview.artifact_id);
            hasher.feed(prompt_artifact_type_token(plan.preview.artifact_type));
            hasher.feed(project_write_kind_token(plan.preview.write_kind));
            hasher.feed(&plan.preview.target_directory);
            for file in &plan.preview.files {
                hasher.feed(&file.relative_path);
                hasher.feed(&file.path);
                hasher.feed(if file.exists { "exists" } else { "missing" });
            }
            hasher.feed(&plan.contents);
        }
    }
    hasher.finish()
}

struct StablePlanHasher {
    value: u64,
}

impl StablePlanHasher {
    fn new() -> Self {
        Self {
            value: 0xcbf29ce484222325,
        }
    }

    fn feed(&mut self, value: &str) {
        self.feed_bytes(value.len().to_string().as_bytes());
        self.feed_bytes(b":");
        self.feed_bytes(value.as_bytes());
        self.feed_bytes(b";");
    }

    fn feed_bytes(&mut self, bytes: &[u8]) {
        for byte in bytes {
            self.value ^= u64::from(*byte);
            self.value = self.value.wrapping_mul(0x100000001b3);
        }
    }

    fn finish(self) -> String {
        format!("fnv1a64:{:016x}", self.value)
    }
}

fn project_write_kind_token(kind: ProjectArtifactWriteKind) -> &'static str {
    match kind {
        ProjectArtifactWriteKind::Prompt => "prompt",
        ProjectArtifactWriteKind::Context => "context",
        ProjectArtifactWriteKind::Skill => "skill",
        ProjectArtifactWriteKind::AgentsSnippet => "agents-snippet",
    }
}

fn prompt_artifact_type_token(kind: PromptArtifactType) -> &'static str {
    match kind {
        PromptArtifactType::Prompt => "prompt",
        PromptArtifactType::Context => "context",
        PromptArtifactType::Skill => "skill",
    }
}
