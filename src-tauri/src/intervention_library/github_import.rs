use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Runtime};

use crate::atomic_write::write_atomic;
use crate::config_lock::with_config_write_lock;

use super::catalog::{
    ensure_ult_home_for_app, load_command_package_from_contents, load_skill_package_from_contents,
};
use super::files::{load_prompt_markdown_file, write_prompt_file_to_registry};
use super::model::{
    GitHubLibraryImportAction, GitHubLibraryImportEntry, GitHubLibraryImportFile,
    GitHubLibraryImportIssue, GitHubLibraryImportPreview, GitHubLibraryImportSource,
    GitHubLibraryImportSummary, LauncherCommandDefinition, LibraryPackageType, PromptArtifactType,
    PromptDefinition, PromptScope,
};
use super::paths::{
    artifact_package_file_name, command_package_dir, prompt_file_path, skill_package_dir,
    LocalArtifactClass, LocalArtifactIdentity, COMMAND_PACKAGE_FILE, CONTEXT_PACKAGE_FILE,
    PROMPT_PACKAGE_FILE, SKILL_PACKAGE_FILE,
};

pub fn preview_github_library_import<R: Runtime>(
    app: &AppHandle<R>,
    source: GitHubLibraryImportSource,
    files: Vec<GitHubLibraryImportFile>,
    warnings: Vec<String>,
) -> Result<GitHubLibraryImportPreview, String> {
    let ult_home = ensure_ult_home_for_app(app)?;
    Ok(preview_github_library_import_from_files(
        &ult_home, source, files, warnings,
    ))
}

pub fn import_github_library_pack<R: Runtime>(
    app: &AppHandle<R>,
    source: GitHubLibraryImportSource,
    files: Vec<GitHubLibraryImportFile>,
    selected_paths: Vec<String>,
    warnings: Vec<String>,
) -> Result<GitHubLibraryImportSummary, String> {
    with_config_write_lock(|| {
        let ult_home = ensure_ult_home_for_app(app)?;
        import_github_library_pack_from_files(&ult_home, source, files, selected_paths, warnings)
    })
}

pub(crate) fn preview_github_library_import_from_files(
    ult_home: &Path,
    source: GitHubLibraryImportSource,
    mut files: Vec<GitHubLibraryImportFile>,
    mut warnings: Vec<String>,
) -> GitHubLibraryImportPreview {
    files.sort_by(|left, right| left.path.cmp(&right.path));
    let mut entries = Vec::new();
    let mut ignored_files = Vec::new();
    let mut malformed_packages = Vec::new();
    let mut seen_targets = HashSet::new();

    for file in files {
        match classify_github_import_path(&file.path) {
            GitHubImportPathDisposition::Package(package) => {
                let target_key =
                    format!("{}:{}", package.package_type as u8, package.handle.as_str());
                if !seen_targets.insert(target_key) {
                    malformed_packages.push(GitHubLibraryImportIssue {
                        path: file.path,
                        reason: format!(
                            "duplicate package target `{}` in this GitHub import",
                            package.handle
                        ),
                    });
                    continue;
                }

                let Some(contents) = file.contents else {
                    malformed_packages.push(GitHubLibraryImportIssue {
                        path: file.path,
                        reason: "recognized package file was not fetched".to_string(),
                    });
                    continue;
                };

                match parse_github_import_package(&package, &file.path, &contents) {
                    Ok(package) => {
                        let target_path = github_import_target_path(ult_home, &package);
                        let entry = GitHubLibraryImportEntry {
                            artifact_id: package.id().to_string(),
                            artifact_type: package.package_type(),
                            title: package.title().to_string(),
                            source_path: file.path,
                            target_path: target_path.display().to_string(),
                            action: if target_path.exists() {
                                GitHubLibraryImportAction::Overwrite
                            } else {
                                GitHubLibraryImportAction::New
                            },
                            diagnostics: Vec::new(),
                        };
                        entries.push(entry);
                    }
                    Err(error) => malformed_packages.push(GitHubLibraryImportIssue {
                        path: file.path,
                        reason: error,
                    }),
                }
            }
            GitHubImportPathDisposition::Ignored(reason) => {
                ignored_files.push(GitHubLibraryImportIssue {
                    path: file.path,
                    reason,
                });
            }
            GitHubImportPathDisposition::Unrelated => {}
        }
    }

    if entries.is_empty() && malformed_packages.is_empty() {
        warnings.push("no recognized Ult library packages were found".to_string());
    }

    GitHubLibraryImportPreview {
        owner: source.owner,
        repo: source.repo,
        requested_ref: source.requested_ref,
        resolved_ref: source.resolved_ref,
        commit: source.commit,
        source_url: source.source_url,
        entries,
        ignored_files,
        malformed_packages,
        warnings,
    }
}

pub(crate) fn import_github_library_pack_from_files(
    ult_home: &Path,
    source: GitHubLibraryImportSource,
    files: Vec<GitHubLibraryImportFile>,
    selected_paths: Vec<String>,
    warnings: Vec<String>,
) -> Result<GitHubLibraryImportSummary, String> {
    let selected_paths = selected_paths
        .into_iter()
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .collect::<HashSet<_>>();
    if selected_paths.is_empty() {
        return Err("select at least one GitHub package to import".to_string());
    }

    let preview =
        preview_github_library_import_from_files(ult_home, source.clone(), files.clone(), warnings);
    let valid_selected = preview
        .entries
        .iter()
        .filter(|entry| selected_paths.contains(entry.source_path.as_str()))
        .map(|entry| entry.source_path.clone())
        .collect::<HashSet<_>>();
    let unknown_selected = selected_paths
        .difference(&valid_selected)
        .cloned()
        .collect::<Vec<_>>();
    if !unknown_selected.is_empty() {
        return Err(format!(
            "selected GitHub package path is not importable: {}",
            unknown_selected.join(", ")
        ));
    }

    let entry_actions = preview
        .entries
        .iter()
        .map(|entry| (entry.source_path.as_str(), entry.action))
        .collect::<HashMap<_, _>>();
    let mut imported_count = 0;
    let mut updated_count = 0;
    let mut imported_artifact_ids = Vec::new();

    for file in files {
        if !selected_paths.contains(file.path.as_str()) {
            continue;
        }
        let GitHubImportPathDisposition::Package(package) = classify_github_import_path(&file.path)
        else {
            continue;
        };
        let contents = file
            .contents
            .ok_or_else(|| format!("{}: recognized package file was not fetched", file.path))?;
        let parsed_package = parse_github_import_package(&package, &file.path, &contents)?;

        imported_artifact_ids.push(parsed_package.id().to_string());
        match entry_actions.get(file.path.as_str()).copied() {
            Some(GitHubLibraryImportAction::Overwrite) => updated_count += 1,
            _ => imported_count += 1,
        }

        match parsed_package {
            ParsedGitHubImportPackage::Artifact(artifact)
                if artifact.artifact_type == PromptArtifactType::Skill =>
            {
                write_github_skill_package(ult_home, &artifact.id, &contents)?;
            }
            ParsedGitHubImportPackage::Artifact(artifact) => {
                write_prompt_file_to_registry(ult_home, &artifact)?;
            }
            ParsedGitHubImportPackage::Command(command) => {
                write_github_command_package(ult_home, &command.id, &contents)?;
            }
        }
    }

    Ok(GitHubLibraryImportSummary {
        imported_count,
        updated_count,
        imported_artifact_ids,
        commit: source.commit,
    })
}

#[derive(Debug, Clone)]
pub(crate) struct GitHubImportPackage {
    pub(crate) handle: String,
    pub(crate) package_type: LibraryPackageType,
    pub(crate) class: Option<LocalArtifactClass>,
}

pub(crate) enum GitHubImportPathDisposition {
    Package(GitHubImportPackage),
    Ignored(String),
    Unrelated,
}

pub(crate) fn classify_github_import_path(path: &str) -> GitHubImportPathDisposition {
    let normalized = path.trim_matches('/');
    let segments = normalized.split('/').collect::<Vec<_>>();
    match segments.as_slice() {
        ["persistent", "prompts", handle, PROMPT_PACKAGE_FILE] => {
            github_import_prompt_package(handle, LocalArtifactClass::PersistentPrompt)
        }
        ["persistent", "contexts", handle, CONTEXT_PACKAGE_FILE] => {
            github_import_prompt_package(handle, LocalArtifactClass::PersistentContext)
        }
        ["persistent", "skills", handle, SKILL_PACKAGE_FILE] => github_import_skill_package(handle),
        ["persistent", "commands", handle, COMMAND_PACKAGE_FILE] => {
            github_import_command_package(handle)
        }
        ["prompts", handle, PROMPT_PACKAGE_FILE] => {
            github_import_prompt_package(handle, LocalArtifactClass::PersistentPrompt)
        }
        ["contexts", handle, CONTEXT_PACKAGE_FILE] => {
            github_import_prompt_package(handle, LocalArtifactClass::PersistentContext)
        }
        ["skills", handle, SKILL_PACKAGE_FILE] => github_import_skill_package(handle),
        ["commands", handle, COMMAND_PACKAGE_FILE] => github_import_command_package(handle),
        _ if is_related_github_import_path(&segments) => {
            GitHubImportPathDisposition::Ignored("not a recognized Ult package file".to_string())
        }
        _ => GitHubImportPathDisposition::Unrelated,
    }
}

pub(crate) fn github_import_prompt_package(
    handle: &str,
    class: LocalArtifactClass,
) -> GitHubImportPathDisposition {
    let artifact_type = match class {
        LocalArtifactClass::PersistentPrompt => PromptArtifactType::Prompt,
        LocalArtifactClass::PersistentContext => PromptArtifactType::Context,
        LocalArtifactClass::EphemeralPrompt | LocalArtifactClass::EphemeralContext => {
            return GitHubImportPathDisposition::Ignored(
                "GitHub imports only support persistent packages".to_string(),
            )
        }
    };
    GitHubImportPathDisposition::Package(GitHubImportPackage {
        handle: handle.to_string(),
        package_type: LibraryPackageType::from(artifact_type),
        class: Some(class),
    })
}

pub(crate) fn github_import_skill_package(handle: &str) -> GitHubImportPathDisposition {
    GitHubImportPathDisposition::Package(GitHubImportPackage {
        handle: handle.to_string(),
        package_type: LibraryPackageType::Skill,
        class: None,
    })
}

pub(crate) fn github_import_command_package(handle: &str) -> GitHubImportPathDisposition {
    GitHubImportPathDisposition::Package(GitHubImportPackage {
        handle: handle.to_string(),
        package_type: LibraryPackageType::Command,
        class: None,
    })
}

pub(crate) fn is_related_github_import_path(segments: &[&str]) -> bool {
    matches!(
        segments,
        ["persistent", "prompts", ..]
            | ["persistent", "contexts", ..]
            | ["persistent", "skills", ..]
            | ["persistent", "commands", ..]
            | ["prompts", ..]
            | ["contexts", ..]
            | ["skills", ..]
            | ["commands", ..]
    )
}

pub(crate) fn parse_github_import_package(
    package: &GitHubImportPackage,
    source_path: &str,
    contents: &str,
) -> Result<ParsedGitHubImportPackage, String> {
    if package.package_type == LibraryPackageType::Command {
        return load_command_package_from_contents(&package.handle, source_path, contents)
            .map(ParsedGitHubImportPackage::Command);
    }
    if package.package_type == LibraryPackageType::Skill {
        return load_skill_package_from_contents(
            &package.handle,
            source_path,
            contents.to_string(),
        )
        .map(|package| ParsedGitHubImportPackage::Artifact(package.prompt));
    }

    let class = package
        .class
        .ok_or_else(|| "prompt/context package class is missing".to_string())?;
    let artifact_type = match package.package_type {
        LibraryPackageType::Prompt => PromptArtifactType::Prompt,
        LibraryPackageType::Context => PromptArtifactType::Context,
        LibraryPackageType::Skill | LibraryPackageType::Command => {
            return Err("prompt/context package class is missing".to_string())
        }
    };
    let identity = LocalArtifactIdentity {
        id: package.handle.clone(),
        artifact_type,
        scope: PromptScope::Persistent,
    };
    load_prompt_markdown_file(Path::new(source_path), contents, Some(identity)).and_then(
        |artifact| {
            if artifact.scope != PromptScope::Persistent {
                return Err(format!(
                    "{source_path}: GitHub imports only support persistent artifacts"
                ));
            }
            if class.package_file_name() != artifact_package_file_name(artifact.artifact_type) {
                return Err(format!(
                    "{source_path}: package file type does not match imported artifact type"
                ));
            }
            Ok(ParsedGitHubImportPackage::Artifact(artifact))
        },
    )
}

#[derive(Debug, Clone)]
pub(crate) enum ParsedGitHubImportPackage {
    Artifact(PromptDefinition),
    Command(LauncherCommandDefinition),
}

impl ParsedGitHubImportPackage {
    fn id(&self) -> &str {
        match self {
            Self::Artifact(artifact) => &artifact.id,
            Self::Command(command) => &command.id,
        }
    }

    fn title(&self) -> &str {
        match self {
            Self::Artifact(artifact) => &artifact.title,
            Self::Command(command) => &command.title,
        }
    }

    fn package_type(&self) -> LibraryPackageType {
        match self {
            Self::Artifact(artifact) => LibraryPackageType::from(artifact.artifact_type),
            Self::Command(_) => LibraryPackageType::Command,
        }
    }
}

pub(crate) fn github_import_target_path(
    ult_home: &Path,
    package: &ParsedGitHubImportPackage,
) -> PathBuf {
    match package {
        ParsedGitHubImportPackage::Artifact(artifact) => match artifact.artifact_type {
            PromptArtifactType::Prompt | PromptArtifactType::Context => {
                prompt_file_path(ult_home, artifact, "md")
            }
            PromptArtifactType::Skill => {
                skill_package_dir(ult_home, &artifact.id).join(SKILL_PACKAGE_FILE)
            }
        },
        ParsedGitHubImportPackage::Command(command) => {
            command_package_dir(ult_home, &command.id).join(COMMAND_PACKAGE_FILE)
        }
    }
}

pub(crate) fn write_github_skill_package(
    ult_home: &Path,
    handle: &str,
    contents: &str,
) -> Result<(), String> {
    let package_dir = skill_package_dir(ult_home, handle);
    let path = package_dir.join(SKILL_PACKAGE_FILE);
    let _ = load_skill_package_from_contents(
        handle,
        &path.display().to_string(),
        contents.to_string(),
    )?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    write_atomic(&path, contents.as_bytes(), SKILL_PACKAGE_FILE)
}

pub(crate) fn write_github_command_package(
    ult_home: &Path,
    handle: &str,
    contents: &str,
) -> Result<(), String> {
    let package_dir = command_package_dir(ult_home, handle);
    let path = package_dir.join(COMMAND_PACKAGE_FILE);
    let _ = load_command_package_from_contents(handle, &path.display().to_string(), contents)?;
    fs::create_dir_all(&package_dir)
        .map_err(|error| format!("failed to create {}: {error}", package_dir.display()))?;
    write_atomic(&path, contents.as_bytes(), COMMAND_PACKAGE_FILE)
}
