use std::collections::{BTreeMap, HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};

use crate::atomic_write::write_atomic;

use super::files::{
    load_local_prompt_file, split_markdown_front_matter, write_prompt_file_to_registry,
};
use super::lifecycle::{
    cleanup_expired_ephemeral_artifacts, is_expired_ephemeral_artifact, timestamp_ms,
};
use super::model::{
    InputLauncherCommand, InputPrompt, LauncherCommandAction, LauncherCommandDefinition,
    PromptArtifactSource, PromptArtifactType, PromptDefinition, PromptLoadResult,
    PromptRegistryEntry, PromptRegistrySource, PromptScope,
};
use super::paths::{
    command_package_dir, context_scope_dir, persistent_commands_dir, persistent_skills_dir,
    personal_library_dir, personal_library_readme_path, prompt_scope_dir, ult_home_dir,
    LocalArtifactClass, COMMAND_PACKAGE_FILE, CONTEXT_PACKAGE_FILE, PROMPT_PACKAGE_FILE,
    SKILL_PACKAGE_FILE,
};
use super::template::{analyze_template, TemplateAnalysis};
use super::validation::validate_prompt;

const PERSONAL_LIBRARY_README: &str = "# Ult Personal Library\n\n\
This folder is the local source of truth for your Ult prompts, contexts, skills, and Launcher commands.\n\n\
- `persistent/prompts/<handle>/PROMPT.md`: reusable prompts available through `#` search and optional Palette pinning\n\
- `persistent/contexts/<handle>/CONTEXT.md`: reusable context blocks available through `@` search\n\
- `persistent/skills/<handle>/SKILL.md`: agent workflow packages available through `$` search\n\
- `persistent/commands/<handle>/COMMAND.md`: reusable Launcher commands that bind prompts, contexts, and variable presets\n\
- `ephemeral/prompts/<opaque-id>/PROMPT.md`: scratch prompts kept for 7 days\n\
- `ephemeral/contexts/<opaque-id>/CONTEXT.md`: copied context blocks kept for 7 days\n\n\
Prompt and context artifacts are Markdown files with TOML front matter. Skills use the standard `SKILL.md` package format.\n";

pub fn load_intervention_library_from_disk<R: Runtime>(_app: &AppHandle<R>) -> PromptLoadResult {
    let ult_home = match ult_home_dir() {
        Ok(path) => path,
        Err(error) => {
            return PromptLoadResult {
                artifacts: Vec::new(),
                entries: Vec::new(),
                commands: Vec::new(),
                config_path: String::new(),
                registry_path: String::new(),
                editable_artifact_ids: Vec::new(),
                errors: vec![format!("failed to resolve Ult home: {error}")],
                warnings: Vec::new(),
            };
        }
    };
    load_intervention_library_from_home(&ult_home)
}

pub(crate) fn load_intervention_library_from_home(ult_home: &Path) -> PromptLoadResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    if let Err(error) = ensure_ult_home(ult_home) {
        errors.push(error);
    }
    if let Err(error) = cleanup_expired_ephemeral_artifacts(ult_home, timestamp_ms()) {
        errors.push(error);
    }
    if let Err(error) = bootstrap_personal_library(ult_home) {
        errors.push(error);
    }

    let mut registry = PromptRegistryBuilder::default();
    match bundled_prompt_entries() {
        Ok(entries) => {
            for entry in entries {
                registry.insert(entry, &mut warnings);
            }
        }
        Err(error) => errors.push(error),
    }

    load_local_prompt_files(
        &prompt_scope_dir(ult_home, PromptScope::Persistent),
        LocalArtifactClass::PersistentPrompt,
        &mut registry,
        &mut errors,
        &mut warnings,
    );
    load_local_prompt_files(
        &prompt_scope_dir(ult_home, PromptScope::Ephemeral),
        LocalArtifactClass::EphemeralPrompt,
        &mut registry,
        &mut errors,
        &mut warnings,
    );
    load_local_prompt_files(
        &context_scope_dir(ult_home, PromptScope::Persistent),
        LocalArtifactClass::PersistentContext,
        &mut registry,
        &mut errors,
        &mut warnings,
    );
    load_local_prompt_files(
        &context_scope_dir(ult_home, PromptScope::Ephemeral),
        LocalArtifactClass::EphemeralContext,
        &mut registry,
        &mut errors,
        &mut warnings,
    );
    load_local_skill_packages(
        &persistent_skills_dir(ult_home),
        &mut registry,
        &mut errors,
        &mut warnings,
    );
    let commands = load_local_command_packages(
        &persistent_commands_dir(ult_home),
        &registry.entries,
        &mut errors,
        &mut warnings,
    );

    let entries = registry.entries();
    let artifacts = entries
        .iter()
        .map(|entry| entry.prompt.clone())
        .collect::<Vec<_>>();
    let editable_artifact_ids = entries
        .iter()
        .filter(|entry| entry.editable)
        .map(|entry| entry.prompt.id.clone())
        .collect();

    PromptLoadResult {
        artifacts,
        entries,
        commands,
        config_path: ult_home.display().to_string(),
        registry_path: personal_library_dir(ult_home).display().to_string(),
        editable_artifact_ids,
        errors,
        warnings,
    }
}

pub fn ensure_ult_home_for_app<R: Runtime>(_app: &AppHandle<R>) -> Result<PathBuf, String> {
    let ult_home = ult_home_dir()?;
    ensure_ult_home(&ult_home)?;
    Ok(ult_home)
}

pub fn persistent_skills_dir_for_app<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let ult_home = ensure_ult_home_for_app(app)?;
    Ok(persistent_skills_dir(&ult_home))
}

pub fn parse_bundled_prompts_json(contents: &str) -> Result<Vec<PromptDefinition>, String> {
    let raw = serde_json::from_str::<Vec<InputPrompt>>(contents).map_err(|error| {
        format!("bundled prompt schema is invalid JSON or incompatible: {error}")
    })?;
    raw.into_iter()
        .map(|prompt| validate_prompt(prompt, None))
        .collect()
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct AgentWorkflowPackDefinition {
    pub(crate) id: String,
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) keywords: Vec<String>,
    pub(crate) aliases: Vec<String>,
    pub(crate) prompt: String,
}

pub(crate) fn parse_agent_workflow_packs_json(
    contents: &str,
) -> Result<Vec<AgentWorkflowPackDefinition>, String> {
    let raw = serde_json::from_str::<Vec<AgentWorkflowPackDefinition>>(contents)
        .map_err(|error| format!("agent workflow pack schema is invalid JSON: {error}"))?;
    for pack in &raw {
        validate_package_handle("workflow prompt", &pack.id)?;
        if pack.title.trim().is_empty() {
            return Err(format!("workflow pack `{}` title is required", pack.id));
        }
        if pack.prompt.trim().is_empty() {
            return Err(format!("workflow pack `{}` prompt is required", pack.id));
        }
    }
    Ok(raw)
}

#[cfg(test)]
pub fn prompt_ids(prompts: &[PromptDefinition]) -> HashSet<&str> {
    prompts.iter().map(|prompt| prompt.id.as_str()).collect()
}

pub(crate) fn ensure_ult_home(ult_home: &Path) -> Result<(), String> {
    fs::create_dir_all(ult_home)
        .map_err(|error| format!("failed to create Ult home directory: {error}"))?;
    fs::create_dir_all(prompt_scope_dir(ult_home, PromptScope::Persistent))
        .map_err(|error| format!("failed to create persistent prompts directory: {error}"))?;
    fs::create_dir_all(prompt_scope_dir(ult_home, PromptScope::Ephemeral))
        .map_err(|error| format!("failed to create ephemeral prompts directory: {error}"))?;
    fs::create_dir_all(context_scope_dir(ult_home, PromptScope::Persistent))
        .map_err(|error| format!("failed to create persistent contexts directory: {error}"))?;
    fs::create_dir_all(context_scope_dir(ult_home, PromptScope::Ephemeral))
        .map_err(|error| format!("failed to create ephemeral contexts directory: {error}"))?;
    fs::create_dir_all(persistent_skills_dir(ult_home))
        .map_err(|error| format!("failed to create persistent skills directory: {error}"))?;
    fs::create_dir_all(persistent_commands_dir(ult_home))
        .map_err(|error| format!("failed to create persistent commands directory: {error}"))?;
    Ok(())
}

pub(crate) fn bootstrap_personal_library(ult_home: &Path) -> Result<(), String> {
    let readme_path = personal_library_readme_path(ult_home);
    if readme_path.exists() || personal_library_has_local_artifact_files(ult_home) {
        return Ok(());
    }

    for prompt in
        parse_bundled_prompts_json(include_str!("../../../src/data/bundled-prompts.json"))?
    {
        write_prompt_file_to_registry(ult_home, &prompt)?;
    }
    bootstrap_agent_workflow_packages(ult_home)?;

    write_atomic(
        &readme_path,
        PERSONAL_LIBRARY_README.as_bytes(),
        "personal-library-readme.md",
    )
}

fn bootstrap_agent_workflow_packages(ult_home: &Path) -> Result<(), String> {
    for pack in parse_agent_workflow_packs_json(include_str!(
        "../../../src/data/agent-workflow-packs.json"
    ))? {
        let prompt = workflow_pack_prompt(&pack)?;
        write_prompt_file_to_registry(ult_home, &prompt)?;
        write_workflow_command_package(ult_home, &pack)?;
    }
    Ok(())
}

fn workflow_pack_prompt(pack: &AgentWorkflowPackDefinition) -> Result<PromptDefinition, String> {
    validate_prompt(
        InputPrompt {
            id: Some(pack.id.clone()),
            title: pack.title.clone(),
            artifact_type: Some(PromptArtifactType::Prompt),
            scope: Some(PromptScope::Persistent),
            pinned: false,
            prompt: pack.prompt.clone(),
            contexts: Vec::new(),
            description: pack.description.clone(),
            shortcut: None,
            confirm: false,
            template_arguments: Vec::new(),
            created_at: None,
            expires_at: None,
            source: PromptArtifactSource::User,
        },
        None,
    )
}

#[derive(Serialize)]
struct BootstrapLauncherCommandMarkdown<'a> {
    title: &'a str,
    description: &'a str,
    prompt: &'a str,
    keywords: &'a [String],
    aliases: &'a [String],
    actions: &'a [LauncherCommandAction],
    home: bool,
}

fn write_workflow_command_package(
    ult_home: &Path,
    pack: &AgentWorkflowPackDefinition,
) -> Result<(), String> {
    let command_dir = command_package_dir(ult_home, &pack.id);
    fs::create_dir_all(&command_dir)
        .map_err(|error| format!("failed to create {}: {error}", command_dir.display()))?;
    let command_path = command_dir.join(COMMAND_PACKAGE_FILE);
    let actions = [LauncherCommandAction::Prepare];
    let front_matter = toml::to_string_pretty(&BootstrapLauncherCommandMarkdown {
        title: &pack.title,
        description: &pack.description,
        prompt: &pack.id,
        keywords: &pack.keywords,
        aliases: &pack.aliases,
        actions: &actions,
        home: false,
    })
    .map_err(|error| format!("failed to serialize workflow command package: {error}"))?;
    let contents = format!(
        "---\n{front_matter}\n---\n\n# {}\n\nEditable workflow command package for `#{}`.\n",
        pack.title, pack.id
    );
    write_atomic(&command_path, contents.as_bytes(), COMMAND_PACKAGE_FILE)
}

pub(crate) fn personal_library_has_local_artifact_files(ult_home: &Path) -> bool {
    [
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
    ]
    .iter()
    .any(|(path, package_file)| directory_has_artifact_package(path, package_file))
        || directory_has_skill_package(&persistent_skills_dir(ult_home))
        || directory_has_command_package(&persistent_commands_dir(ult_home))
}

pub(crate) fn directory_has_artifact_package(path: &Path, package_file: &str) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    entries.filter_map(Result::ok).any(|entry| {
        let path = entry.path();
        path.is_dir() && path.join(package_file).is_file()
    })
}

pub(crate) fn directory_has_skill_package(path: &Path) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    entries.filter_map(Result::ok).any(|entry| {
        let path = entry.path();
        path.is_dir() && path.join(SKILL_PACKAGE_FILE).is_file()
    })
}

pub(crate) fn directory_has_command_package(path: &Path) -> bool {
    let Ok(entries) = fs::read_dir(path) else {
        return false;
    };
    entries.filter_map(Result::ok).any(|entry| {
        let path = entry.path();
        path.is_dir() && path.join(COMMAND_PACKAGE_FILE).is_file()
    })
}

#[derive(Default)]
pub(crate) struct PromptRegistryBuilder {
    pub(crate) order: Vec<String>,
    pub(crate) entries: HashMap<String, PromptRegistryEntry>,
}

impl PromptRegistryBuilder {
    pub(crate) fn insert(&mut self, mut entry: PromptRegistryEntry, warnings: &mut Vec<String>) {
        let id = entry.prompt.id.clone();
        if let Some(previous) = self.entries.get(&id) {
            if previous.source == PromptRegistrySource::Bundled && entry.editable {
                entry.source = PromptRegistrySource::LocalOverride;
            } else if previous.source != PromptRegistrySource::Bundled {
                warnings.push(format!(
                    "{}: artifact `{}` overrides an artifact loaded earlier from {}",
                    entry.source_path.as_deref().unwrap_or("registry"),
                    id,
                    previous.source_path.as_deref().unwrap_or("registry")
                ));
            }
        } else {
            self.order.push(id.clone());
        }
        self.entries.insert(id, entry);
    }

    pub(crate) fn entries(self) -> Vec<PromptRegistryEntry> {
        self.order
            .into_iter()
            .filter_map(|id| self.entries.get(&id).cloned())
            .collect()
    }
}

pub(crate) fn bundled_prompt_entries() -> Result<Vec<PromptRegistryEntry>, String> {
    parse_bundled_prompts_json(include_str!("../../../src/data/bundled-prompts.json")).map(
        |prompts| {
            prompts
                .into_iter()
                .map(|prompt| {
                    prompt_registry_entry(prompt, PromptRegistrySource::Bundled, None, false)
                })
                .collect()
        },
    )
}

pub(crate) fn load_local_prompt_files(
    path: &Path,
    expected_class: LocalArtifactClass,
    registry: &mut PromptRegistryBuilder,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };
    let now_ms = timestamp_ms();
    let package_file_name = expected_class.package_file_name();
    let mut paths = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .map(|path| path.join(package_file_name))
        .filter(|path| path.is_file())
        .collect::<Vec<_>>();
    paths.sort();

    for path in paths {
        match load_local_prompt_file(&path, expected_class) {
            Ok(prompt) => {
                if is_expired_ephemeral_artifact(&prompt, now_ms) {
                    continue;
                }
                registry.insert(
                    prompt_registry_entry(
                        prompt,
                        PromptRegistrySource::LocalFile,
                        Some(path.display().to_string()),
                        true,
                    ),
                    warnings,
                );
            }
            Err(error) => errors.push(error),
        }
    }
}

pub(crate) fn load_local_skill_packages(
    path: &Path,
    registry: &mut PromptRegistryBuilder,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };
    let mut paths = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join(SKILL_PACKAGE_FILE).is_file())
        .collect::<Vec<_>>();
    paths.sort();

    for package_dir in paths {
        let skill_path = package_dir.join(SKILL_PACKAGE_FILE);
        match load_local_skill_package(&package_dir, &skill_path) {
            Ok(package) => {
                warnings.extend(package.warnings);
                registry.insert(
                    prompt_registry_entry(
                        package.prompt,
                        PromptRegistrySource::LocalFile,
                        Some(skill_path.display().to_string()),
                        true,
                    ),
                    warnings,
                );
            }
            Err(error) => errors.push(error),
        }
    }
}

pub(crate) fn load_local_command_packages(
    path: &Path,
    artifact_entries: &HashMap<String, PromptRegistryEntry>,
    errors: &mut Vec<String>,
    warnings: &mut Vec<String>,
) -> Vec<LauncherCommandDefinition> {
    let Ok(entries) = fs::read_dir(path) else {
        return Vec::new();
    };
    let mut paths = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir() && path.join(COMMAND_PACKAGE_FILE).is_file())
        .collect::<Vec<_>>();
    paths.sort();

    let mut commands = Vec::new();
    let mut seen = HashSet::new();
    for package_dir in paths {
        let command_path = package_dir.join(COMMAND_PACKAGE_FILE);
        match load_local_command_package(&package_dir, &command_path, artifact_entries) {
            Ok(command) => {
                if !seen.insert(command.id.clone()) {
                    warnings.push(format!(
                        "{}: command `{}` overrides a command loaded earlier",
                        command.source_path.as_deref().unwrap_or("COMMAND.md"),
                        command.id
                    ));
                    commands.retain(|entry: &LauncherCommandDefinition| entry.id != command.id);
                }
                commands.push(command);
            }
            Err(error) => errors.push(error),
        }
    }
    commands
}

pub(crate) fn load_local_command_package(
    package_dir: &Path,
    command_path: &Path,
    artifact_entries: &HashMap<String, PromptRegistryEntry>,
) -> Result<LauncherCommandDefinition, String> {
    let id = package_dir
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .map(str::trim)
        .filter(|file_name| !file_name.is_empty())
        .ok_or_else(|| {
            format!(
                "{}: command package directory name is invalid",
                package_dir.display()
            )
        })?
        .to_string();
    let contents = fs::read_to_string(command_path).map_err(|error| {
        format!(
            "{}: failed to read command file: {error}",
            command_path.display()
        )
    })?;
    let command =
        load_command_package_from_contents(&id, &command_path.display().to_string(), &contents)?;
    validate_command_references(command, artifact_entries)
}

pub(crate) fn load_command_package_from_contents(
    id: &str,
    command_path: &str,
    contents: &str,
) -> Result<LauncherCommandDefinition, String> {
    let path = Path::new(command_path);
    let (front_matter, _body) = split_markdown_front_matter(contents)
        .map_err(|error| format!("{}: {error}", path.display()))?;
    let input = toml::from_str::<InputLauncherCommand>(&front_matter)
        .map_err(|error| format!("{}: invalid command front matter: {error}", path.display()))?;
    validate_command_package(id, Some(path.display().to_string()), input)
        .map_err(|error| format!("{}: {error}", path.display()))
}

pub(crate) fn validate_command_package(
    id: &str,
    source_path: Option<String>,
    input: InputLauncherCommand,
) -> Result<LauncherCommandDefinition, String> {
    let id = id.trim().to_string();
    validate_package_handle("command", &id)?;

    let title = input.title.trim().to_string();
    if title.is_empty() {
        return Err(format!("command `{id}` title is required"));
    }
    let prompt_id = input.prompt_id.unwrap_or_default().trim().to_string();
    if prompt_id.is_empty() {
        return Err(format!("command `{id}` prompt is required"));
    }
    validate_package_handle("prompt reference", &prompt_id)?;

    let contexts = normalize_id_list(&id, "context", input.contexts)?;
    let variable_values = normalize_variable_values(&id, input.variable_values)?;
    let keywords = normalize_text_list(input.keywords);
    let aliases = normalize_text_list(input.aliases);
    let actions = normalize_command_actions(input.actions);

    Ok(LauncherCommandDefinition {
        id,
        title,
        description: input.description.trim().to_string(),
        prompt_id,
        contexts,
        variable_values,
        keywords,
        aliases,
        actions,
        home: input.home,
        source_path,
    })
}

fn validate_command_references(
    command: LauncherCommandDefinition,
    artifact_entries: &HashMap<String, PromptRegistryEntry>,
) -> Result<LauncherCommandDefinition, String> {
    let prompt = artifact_entries.get(&command.prompt_id).ok_or_else(|| {
        format!(
            "{}: command `{}` references missing prompt `{}`",
            command.source_path.as_deref().unwrap_or("COMMAND.md"),
            command.id,
            command.prompt_id
        )
    })?;
    if prompt.prompt.artifact_type != PromptArtifactType::Prompt {
        return Err(format!(
            "{}: command `{}` prompt reference `{}` must be a prompt artifact",
            command.source_path.as_deref().unwrap_or("COMMAND.md"),
            command.id,
            command.prompt_id
        ));
    }
    for context_id in &command.contexts {
        let context = artifact_entries.get(context_id).ok_or_else(|| {
            format!(
                "{}: command `{}` references missing context `{}`",
                command.source_path.as_deref().unwrap_or("COMMAND.md"),
                command.id,
                context_id
            )
        })?;
        if context.prompt.artifact_type != PromptArtifactType::Context {
            return Err(format!(
                "{}: command `{}` context reference `{}` must be a context artifact",
                command.source_path.as_deref().unwrap_or("COMMAND.md"),
                command.id,
                context_id
            ));
        }
    }
    Ok(command)
}

pub(crate) fn validate_package_handle(label: &str, id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err(format!("{label} handle is required"));
    }
    if !id
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(format!(
            "{label} handle `{id}` must use letters, numbers, hyphen, or underscore"
        ));
    }
    Ok(())
}

fn normalize_id_list(
    command_id: &str,
    label: &str,
    values: Vec<String>,
) -> Result<Vec<String>, String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for value in values {
        let value = value.trim().to_string();
        if value.is_empty() {
            continue;
        }
        validate_package_handle(label, &value)
            .map_err(|error| format!("command `{command_id}` {error}"))?;
        if seen.insert(value.clone()) {
            normalized.push(value);
        }
    }
    Ok(normalized)
}

fn normalize_variable_values(
    command_id: &str,
    values: BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>, String> {
    let mut normalized = BTreeMap::new();
    for (name, value) in values {
        let name = name.trim().to_string();
        if name.is_empty() {
            continue;
        }
        if !name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
        {
            return Err(format!(
                "command `{command_id}` variable `{name}` must use letters, numbers, or underscore"
            ));
        }
        let value = value.trim().to_string();
        if !value.is_empty() {
            normalized.insert(name, value);
        }
    }
    Ok(normalized)
}

fn normalize_text_list(values: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    values
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && seen.insert(value.to_lowercase()))
        .collect()
}

fn normalize_command_actions(actions: Vec<LauncherCommandAction>) -> Vec<LauncherCommandAction> {
    let actions = if actions.is_empty() {
        vec![LauncherCommandAction::Prepare]
    } else {
        actions
    };
    let mut seen = HashSet::new();
    actions
        .into_iter()
        .filter(|action| seen.insert(*action))
        .collect()
}

pub(crate) struct LoadedSkillPackage {
    pub(crate) prompt: PromptDefinition,
    pub(crate) warnings: Vec<String>,
}

pub(crate) fn load_local_skill_package(
    package_dir: &Path,
    skill_path: &Path,
) -> Result<LoadedSkillPackage, String> {
    let id = package_dir
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .map(str::trim)
        .filter(|file_name| !file_name.is_empty())
        .ok_or_else(|| {
            format!(
                "{}: skill package directory name is invalid",
                package_dir.display()
            )
        })?
        .to_string();
    let contents = fs::read_to_string(skill_path).map_err(|error| {
        format!(
            "{}: failed to read skill file: {error}",
            skill_path.display()
        )
    })?;
    load_skill_package_from_contents(&id, &skill_path.display().to_string(), contents)
}

pub(crate) fn load_skill_package_from_contents(
    id: &str,
    skill_path: &str,
    contents: String,
) -> Result<LoadedSkillPackage, String> {
    let skill_path = Path::new(skill_path);
    let metadata = parse_skill_metadata(&contents, skill_path);
    let prompt = validate_prompt(
        InputPrompt {
            id: Some(id.to_string()),
            title: metadata.name.unwrap_or_else(|| {
                if id.is_empty() {
                    "skill".to_string()
                } else {
                    id.to_string()
                }
            }),
            artifact_type: Some(PromptArtifactType::Skill),
            scope: Some(PromptScope::Persistent),
            pinned: false,
            prompt: contents,
            contexts: Vec::new(),
            description: metadata
                .description
                .unwrap_or_else(|| "Agent workflow skill.".to_string()),
            shortcut: None,
            confirm: false,
            template_arguments: Vec::new(),
            created_at: None,
            expires_at: None,
            source: PromptArtifactSource::User,
        },
        None,
    )
    .map_err(|error| format!("{}: {error}", skill_path.display()))?;
    Ok(LoadedSkillPackage {
        prompt,
        warnings: metadata.warnings,
    })
}

#[derive(Default)]
pub(crate) struct SkillMetadata {
    pub(crate) name: Option<String>,
    pub(crate) description: Option<String>,
    pub(crate) warnings: Vec<String>,
}

pub(crate) fn parse_skill_metadata(contents: &str, skill_path: &Path) -> SkillMetadata {
    let Ok((front_matter, _body)) = split_markdown_front_matter(contents) else {
        return SkillMetadata::default();
    };
    let mut metadata = SkillMetadata::default();
    let value = match serde_yaml::from_str::<serde_yaml::Value>(&front_matter) {
        Ok(value) => value,
        Err(error) => {
            metadata.warnings.push(format!(
                "{}: invalid SKILL.md YAML front matter: {error}",
                skill_path.display()
            ));
            return metadata;
        }
    };
    let Some(mapping) = value.as_mapping() else {
        metadata.warnings.push(format!(
            "{}: SKILL.md YAML front matter must be a mapping",
            skill_path.display()
        ));
        return metadata;
    };
    metadata.name = skill_metadata_string(mapping, "name", skill_path, &mut metadata.warnings);
    metadata.description =
        skill_metadata_string(mapping, "description", skill_path, &mut metadata.warnings);
    metadata
}

pub(crate) fn skill_metadata_string(
    mapping: &serde_yaml::Mapping,
    key: &str,
    skill_path: &Path,
    warnings: &mut Vec<String>,
) -> Option<String> {
    let value = mapping.get(serde_yaml::Value::String(key.to_string()))?;
    if let Some(text) = value.as_str() {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return None;
        }
        return Some(trimmed.to_string());
    }
    if !value.is_null() {
        warnings.push(format!(
            "{}: SKILL.md YAML front matter `{key}` must be a string",
            skill_path.display()
        ));
    }
    None
}

pub(crate) fn prompt_registry_entry(
    prompt: PromptDefinition,
    source: PromptRegistrySource,
    source_path: Option<String>,
    editable: bool,
) -> PromptRegistryEntry {
    let source_times = source_path
        .as_deref()
        .and_then(|path| source_file_times(Path::new(path)).ok())
        .unwrap_or_default();
    let template = if prompt.artifact_type == PromptArtifactType::Prompt {
        analyze_template(&prompt.prompt)
    } else {
        TemplateAnalysis::default()
    };
    let diagnostics = template
        .duplicate_variables
        .iter()
        .map(|variable| format!("template variable `{variable}` is used more than once"))
        .collect();
    PromptRegistryEntry {
        prompt,
        source,
        source_path,
        source_created_ms: source_times.created_ms,
        source_modified_ms: source_times.modified_ms,
        editable,
        template_variables: template.variables,
        diagnostics,
    }
}

#[derive(Default)]
pub(crate) struct SourceFileTimes {
    pub(crate) created_ms: Option<u64>,
    pub(crate) modified_ms: Option<u64>,
}

pub(crate) fn source_file_times(path: &Path) -> Result<SourceFileTimes, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("{}: failed to read file metadata: {error}", path.display()))?;
    Ok(SourceFileTimes {
        created_ms: metadata.created().ok().and_then(system_time_to_ms),
        modified_ms: metadata.modified().ok().and_then(system_time_to_ms),
    })
}

pub(crate) fn system_time_to_ms(time: SystemTime) -> Option<u64> {
    time.duration_since(UNIX_EPOCH)
        .ok()
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}
