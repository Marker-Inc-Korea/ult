use std::collections::{HashMap, HashSet};

use crate::hotkeys;

use super::lifecycle::{ephemeral_expires_at, timestamp_ms};
use super::model::{
    InputPrompt, PromptArtifactType, PromptDefinition, PromptScope, PromptTemplateArgument,
    PromptTemplateArgumentKind, PromptTemplateEnumSource,
};
use super::paths::LocalArtifactIdentity;
use super::template::analyze_template;

pub(crate) fn validate_prompt_definition(
    prompt: PromptDefinition,
) -> Result<PromptDefinition, String> {
    validate_prompt(
        InputPrompt {
            id: Some(prompt.id),
            title: prompt.title,
            artifact_type: Some(prompt.artifact_type),
            scope: Some(prompt.scope),
            pinned: prompt.pinned,
            prompt: prompt.prompt,
            contexts: prompt.contexts,
            description: prompt.description,
            shortcut: prompt.shortcut,
            confirm: prompt.confirm,
            template_arguments: prompt.template_arguments,
            created_at: prompt.created_at,
            expires_at: prompt.expires_at,
            source: prompt.source,
        },
        None,
    )
}

pub(crate) fn validate_prompt(
    prompt: InputPrompt,
    identity: Option<LocalArtifactIdentity>,
) -> Result<PromptDefinition, String> {
    let id = identity
        .as_ref()
        .map(|identity| identity.id.clone())
        .or(prompt.id)
        .unwrap_or_default()
        .trim()
        .to_string();
    if id.is_empty() {
        return Err("artifact handle is required".to_string());
    }
    if !id
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(format!(
            "artifact handle `{id}` must use letters, numbers, hyphen, or underscore"
        ));
    }

    let artifact_type = identity
        .as_ref()
        .map(|identity| identity.artifact_type)
        .or(prompt.artifact_type)
        .unwrap_or_default();
    let scope = identity
        .as_ref()
        .map(|identity| identity.scope)
        .or(prompt.scope)
        .unwrap_or_default();
    let title = prompt.title.trim().to_string();
    if title.is_empty() {
        return Err(format!("prompt `{id}` title is required"));
    }

    if artifact_type == PromptArtifactType::Skill && scope != PromptScope::Persistent {
        return Err(format!(
            "skill `{id}` is only supported as a persistent SKILL.md package"
        ));
    }

    if prompt.pinned
        && (artifact_type != PromptArtifactType::Prompt || scope != PromptScope::Persistent)
    {
        return Err(format!(
            "artifact `{id}` can only be pinned when it is a persistent prompt"
        ));
    }

    if prompt.prompt.trim().is_empty() {
        return Err(format!("prompt `{id}` text is required"));
    }
    let mut template_variables = Vec::new();
    if artifact_type == PromptArtifactType::Prompt {
        let template = analyze_template(&prompt.prompt);
        if !template.errors.is_empty() {
            return Err(format!(
                "prompt `{id}` has invalid template: {}",
                template.errors.join("; ")
            ));
        }
        template_variables = template.variables;
    }

    let shortcut = validate_prompt_shortcut(&id, prompt.shortcut)?;
    let contexts = validate_context_ids(&id, prompt.contexts)?;
    let template_arguments = validate_template_arguments(
        &id,
        artifact_type,
        &template_variables,
        prompt.template_arguments,
    )?;
    let (created_at, expires_at) = if scope == PromptScope::Ephemeral {
        let created_at = prompt.created_at.unwrap_or_else(timestamp_ms);
        let expires_at = prompt
            .expires_at
            .unwrap_or_else(|| ephemeral_expires_at(created_at));
        (Some(created_at), Some(expires_at))
    } else {
        (prompt.created_at, prompt.expires_at)
    };

    Ok(PromptDefinition {
        id,
        title,
        artifact_type,
        scope,
        pinned: prompt.pinned,
        description: prompt.description.trim().to_string(),
        prompt: prompt.prompt,
        contexts,
        shortcut,
        confirm: prompt.confirm,
        template_arguments,
        created_at,
        expires_at,
        source: prompt.source,
    })
}

pub(crate) fn validate_template_arguments(
    id: &str,
    artifact_type: PromptArtifactType,
    variables: &[String],
    arguments: Vec<PromptTemplateArgument>,
) -> Result<Vec<PromptTemplateArgument>, String> {
    if artifact_type != PromptArtifactType::Prompt {
        return Ok(Vec::new());
    }

    let mut by_name = HashMap::new();
    for argument in arguments {
        let name = argument.name.trim().to_string();
        if name.is_empty() {
            continue;
        }
        if !name
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
        {
            return Err(format!(
                "prompt `{id}` template argument `{name}` must use letters, numbers, or underscore"
            ));
        }
        if by_name.insert(name.clone(), argument).is_some() {
            return Err(format!(
                "prompt `{id}` template argument `{name}` is duplicated"
            ));
        }
    }

    let mut normalized = Vec::new();
    for variable in variables {
        let mut argument = by_name
            .remove(variable)
            .unwrap_or_else(|| PromptTemplateArgument {
                name: variable.clone(),
                ..Default::default()
            });
        argument.name = variable.clone();
        argument.description = argument.description.trim().to_string();
        argument.default_value = argument.default_value.trim().to_string();
        argument.enum_name = argument.enum_name.trim().to_string();

        if argument.value_type == PromptTemplateArgumentKind::Text {
            argument.enum_source = PromptTemplateEnumSource::Static;
            argument.enum_name.clear();
            argument.enum_values.clear();
            argument.enum_dynamic_command = None;
            argument.enum_dynamic_cwd = None;
        } else if argument.enum_source == PromptTemplateEnumSource::Dynamic {
            argument.enum_values.clear();
            argument.enum_dynamic_command = argument.enum_dynamic_command.and_then(|command| {
                let command = command.trim().to_string();
                if command.is_empty() {
                    None
                } else {
                    Some(command)
                }
            });
            argument.enum_dynamic_cwd = argument.enum_dynamic_cwd.and_then(|cwd| {
                let cwd = cwd.trim().to_string();
                if cwd.is_empty() {
                    None
                } else {
                    Some(cwd)
                }
            });
        } else {
            let mut seen = HashSet::new();
            argument.enum_values = argument
                .enum_values
                .into_iter()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty() && seen.insert(value.clone()))
                .collect();
            argument.enum_dynamic_command = None;
            argument.enum_dynamic_cwd = None;
        }

        normalized.push(argument);
    }

    Ok(normalized)
}

pub(crate) fn validate_context_ids(id: &str, contexts: Vec<String>) -> Result<Vec<String>, String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for context_id in contexts {
        let context_id = context_id.trim().to_string();
        if context_id.is_empty() {
            continue;
        }
        if context_id == id {
            return Err(format!("prompt `{id}` cannot reference itself as context"));
        }
        if !context_id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '-' || character == '_'
        }) {
            return Err(format!(
                "prompt `{id}` context id `{context_id}` must use letters, numbers, hyphen, or underscore"
            ));
        }
        if seen.insert(context_id.clone()) {
            normalized.push(context_id);
        }
    }
    Ok(normalized)
}

pub(crate) fn validate_prompt_shortcut(
    id: &str,
    shortcut: Option<String>,
) -> Result<Option<String>, String> {
    let Some(shortcut) = shortcut else {
        return Ok(None);
    };
    let shortcut = shortcut.trim();
    if shortcut.is_empty() {
        return Ok(None);
    }

    let normalized = hotkeys::normalize_shortcut(shortcut)
        .map_err(|error| format!("prompt `{id}` has invalid shortcut `{shortcut}`: {error}"))?;
    if hotkeys::app_shortcut_set().contains(&normalized) {
        return Err(format!(
            "prompt `{id}` shortcut `{shortcut}` collides with a Ult app shortcut"
        ));
    }
    Ok(Some(normalized))
}
