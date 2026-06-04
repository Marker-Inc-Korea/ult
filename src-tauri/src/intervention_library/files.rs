use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::atomic_write::write_atomic;

use super::model::{
    InputPrompt, OutputPersonalLibraryMarkdownFile, OutputPromptFile, PromptArtifactType,
    PromptDefinition,
};
use super::paths::{
    prompt_file_path, LocalArtifactClass, LocalArtifactIdentity, COMMAND_PACKAGE_FILE,
    CONTEXT_PACKAGE_FILE, PROMPT_PACKAGE_FILE, SKILL_PACKAGE_FILE,
};
use super::validation::validate_prompt;

pub(crate) fn load_local_prompt_file(
    path: &Path,
    expected_class: LocalArtifactClass,
) -> Result<PromptDefinition, String> {
    let identity = expected_class.identity_for_path(path)?;
    load_prompt_file_with_identity(path, Some(identity))
}

pub(crate) fn load_prompt_file_with_identity(
    path: &Path,
    identity: Option<LocalArtifactIdentity>,
) -> Result<PromptDefinition, String> {
    let contents = fs::read_to_string(path)
        .map_err(|error| format!("{}: failed to read file: {error}", path.display()))?;
    if path.extension().is_some_and(|extension| extension == "md") {
        return load_prompt_markdown_file(path, &contents, identity);
    }
    let prompt = toml::from_str::<InputPrompt>(&contents)
        .map_err(|error| format!("{}: invalid prompt TOML: {error}", path.display()))?;
    validate_prompt(prompt, identity).map_err(|error| format!("{}: {error}", path.display()))
}

pub(crate) fn load_prompt_markdown_file(
    path: &Path,
    contents: &str,
    identity: Option<LocalArtifactIdentity>,
) -> Result<PromptDefinition, String> {
    let (front_matter, body) = split_markdown_front_matter(contents)
        .map_err(|error| format!("{}: {error}", path.display()))?;
    let mut prompt = toml::from_str::<InputPrompt>(&front_matter)
        .map_err(|error| format!("{}: invalid markdown front matter: {error}", path.display()))?;
    prompt.prompt = body;
    validate_prompt(prompt, identity).map_err(|error| format!("{}: {error}", path.display()))
}

pub(crate) fn parse_import_prompt_contents(
    contents: &str,
) -> Result<Vec<PromptDefinition>, String> {
    if contents.starts_with("---\n") {
        let (front_matter, body) = split_markdown_front_matter(contents)?;
        let mut prompt = toml::from_str::<InputPrompt>(&front_matter)
            .map_err(|error| format!("imported markdown front matter is invalid: {error}"))?;
        prompt.prompt = body;
        return validate_prompt(prompt, None).map(|prompt| vec![prompt]);
    }

    let value = toml::from_str::<toml::Value>(contents)
        .map_err(|error| format!("imported artifact file has invalid TOML: {error}"))?;
    if value.get("prompts").is_some() {
        return Err(
            "prompt pack imports are no longer supported; import one artifact file".to_string(),
        );
    }

    let prompt = value
        .try_into::<InputPrompt>()
        .map_err(|error| format!("imported artifact file has invalid schema: {error}"))?;
    validate_prompt(prompt, None).map(|prompt| vec![prompt])
}

pub(crate) fn split_markdown_front_matter(contents: &str) -> Result<(String, String), String> {
    let Some(rest) = contents.strip_prefix("---\n") else {
        return Err(
            "markdown prompt files must start with TOML front matter delimited by `---`"
                .to_string(),
        );
    };
    let Some(end) = rest.find("\n---") else {
        return Err(
            "markdown prompt front matter is missing a closing `---` delimiter".to_string(),
        );
    };
    let front_matter = rest[..end].to_string();
    let body = rest[end + "\n---".len()..]
        .trim_start_matches(['\r', '\n'])
        .to_string();
    Ok((front_matter, body))
}

pub(crate) fn write_prompt_file_to_registry(
    ult_home: &Path,
    prompt: &PromptDefinition,
) -> Result<(), String> {
    let path = prompt_file_path(ult_home, prompt, "md");
    write_prompt_file_to_path(&path, prompt)
}

pub(crate) fn remove_artifact_package_source(path: &Path) -> Result<(), String> {
    if is_canonical_package_file(path) {
        if let Some(package_dir) = path.parent() {
            return fs::remove_dir_all(package_dir)
                .map_err(|error| format!("failed to remove {}: {error}", package_dir.display()));
        }
    }
    fs::remove_file(path).map_err(|error| format!("failed to remove {}: {error}", path.display()))
}

pub(crate) fn is_canonical_package_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|file_name| file_name.to_str())
        .is_some_and(|file_name| {
            file_name == PROMPT_PACKAGE_FILE
                || file_name == CONTEXT_PACKAGE_FILE
                || file_name == SKILL_PACKAGE_FILE
                || file_name == COMMAND_PACKAGE_FILE
        })
}

pub(crate) fn write_prompt_file_to_path(
    path: &Path,
    prompt: &PromptDefinition,
) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {}: {error}", parent.display()))?;
    }
    let contents = if path.extension().is_some_and(|extension| extension == "md") {
        if prompt.artifact_type == PromptArtifactType::Skill {
            skill_file_to_markdown(prompt)?
        } else {
            prompt_file_to_markdown(prompt)?
        }
    } else {
        prompt_file_to_toml(prompt)?
    };
    let label = path
        .file_name()
        .and_then(|file_name| file_name.to_str())
        .unwrap_or("prompt.toml");
    write_atomic(path, contents.as_bytes(), label)
}

pub(crate) fn prompt_file_to_toml(prompt: &PromptDefinition) -> Result<String, String> {
    toml::to_string_pretty(&OutputPromptFile {
        id: &prompt.id,
        title: &prompt.title,
        artifact_type: prompt.artifact_type,
        scope: prompt.scope,
        pinned: prompt.pinned,
        description: &prompt.description,
        contexts: &prompt.contexts,
        shortcut: prompt.shortcut.as_ref(),
        confirm: prompt.confirm,
        template_arguments: &prompt.template_arguments,
        created_at: prompt.created_at,
        expires_at: prompt.expires_at,
        source: prompt.source,
        prompt: &prompt.prompt,
    })
    .map_err(|error| format!("failed to serialize prompt file: {error}"))
}

pub(crate) fn prompt_file_to_markdown(prompt: &PromptDefinition) -> Result<String, String> {
    let front_matter = toml::to_string_pretty(&OutputPersonalLibraryMarkdownFile {
        title: &prompt.title,
        pinned: prompt.pinned,
        description: &prompt.description,
        contexts: &prompt.contexts,
        shortcut: prompt.shortcut.as_ref(),
        confirm: prompt.confirm,
        template_arguments: &prompt.template_arguments,
        created_at: prompt.created_at,
        expires_at: prompt.expires_at,
        source: prompt.source,
    })
    .map_err(|error| format!("failed to serialize prompt markdown front matter: {error}"))?;
    Ok(format!("---\n{front_matter}\n---\n\n{}", prompt.prompt))
}

#[derive(Serialize)]
struct OutputSkillMarkdownFile<'a> {
    name: &'a str,
    description: &'a str,
}

pub(crate) fn skill_file_to_markdown(prompt: &PromptDefinition) -> Result<String, String> {
    let front_matter = serde_yaml::to_string(&OutputSkillMarkdownFile {
        name: &prompt.title,
        description: &prompt.description,
    })
    .map_err(|error| format!("failed to serialize skill metadata: {error}"))?;
    let body = split_markdown_front_matter(&prompt.prompt)
        .map(|(_front_matter, body)| body)
        .unwrap_or_else(|_| prompt.prompt.clone());
    Ok(format!("---\n{front_matter}---\n\n{}", body.trim_start()))
}

#[cfg(test)]
pub(crate) fn prompt_to_toml_entry(prompt: &PromptDefinition) -> Result<String, String> {
    prompt_file_to_toml(prompt).map_err(|error| format!("failed to serialize artifact: {error}"))
}
