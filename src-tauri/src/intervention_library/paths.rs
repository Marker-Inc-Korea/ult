use std::path::{Path, PathBuf};

use super::model::{PromptArtifactType, PromptDefinition, PromptScope};

pub(crate) const PROMPT_PACKAGE_FILE: &str = "PROMPT.md";
pub(crate) const CONTEXT_PACKAGE_FILE: &str = "CONTEXT.md";
pub(crate) const SKILL_PACKAGE_FILE: &str = "SKILL.md";
pub(crate) const COMMAND_PACKAGE_FILE: &str = "COMMAND.md";

#[derive(Debug, Clone, Copy)]
pub(crate) enum LocalArtifactClass {
    PersistentPrompt,
    EphemeralPrompt,
    PersistentContext,
    EphemeralContext,
}

#[derive(Debug, Clone)]
pub(crate) struct LocalArtifactIdentity {
    pub(crate) id: String,
    pub(crate) artifact_type: PromptArtifactType,
    pub(crate) scope: PromptScope,
}

impl LocalArtifactClass {
    pub(crate) fn package_file_name(self) -> &'static str {
        match self {
            LocalArtifactClass::PersistentPrompt | LocalArtifactClass::EphemeralPrompt => {
                PROMPT_PACKAGE_FILE
            }
            LocalArtifactClass::PersistentContext | LocalArtifactClass::EphemeralContext => {
                CONTEXT_PACKAGE_FILE
            }
        }
    }

    pub(crate) fn identity_for_path(self, path: &Path) -> Result<LocalArtifactIdentity, String> {
        let expected_file_name = self.package_file_name();
        let file_name = path
            .file_name()
            .and_then(|file_name| file_name.to_str())
            .ok_or_else(|| format!("{}: artifact package file name is invalid", path.display()))?;
        if file_name != expected_file_name {
            return Err(format!(
                "{}: expected artifact package file `{expected_file_name}`",
                path.display()
            ));
        }
        let id = path
            .parent()
            .and_then(|parent| parent.file_name())
            .and_then(|file_name| file_name.to_str())
            .map(str::trim)
            .filter(|file_name| !file_name.is_empty())
            .ok_or_else(|| {
                format!(
                    "{}: artifact package directory name is invalid",
                    path.display()
                )
            })?
            .to_string();
        let (artifact_type, scope) = match self {
            LocalArtifactClass::PersistentPrompt => {
                (PromptArtifactType::Prompt, PromptScope::Persistent)
            }
            LocalArtifactClass::EphemeralPrompt => {
                (PromptArtifactType::Prompt, PromptScope::Ephemeral)
            }
            LocalArtifactClass::PersistentContext => {
                (PromptArtifactType::Context, PromptScope::Persistent)
            }
            LocalArtifactClass::EphemeralContext => {
                (PromptArtifactType::Context, PromptScope::Ephemeral)
            }
        };
        Ok(LocalArtifactIdentity {
            id,
            artifact_type,
            scope,
        })
    }
}

pub(crate) fn personal_library_dir(ult_home: &Path) -> PathBuf {
    ult_home.join("personal-library")
}

pub(crate) fn personal_library_readme_path(ult_home: &Path) -> PathBuf {
    personal_library_dir(ult_home).join("README.md")
}

pub(crate) fn persistent_dir(ult_home: &Path) -> PathBuf {
    personal_library_dir(ult_home).join("persistent")
}

pub(crate) fn ephemeral_dir(ult_home: &Path) -> PathBuf {
    personal_library_dir(ult_home).join("ephemeral")
}

pub(crate) fn lifecycle_dir(ult_home: &Path, scope: PromptScope) -> PathBuf {
    match scope {
        PromptScope::Persistent => persistent_dir(ult_home),
        PromptScope::Ephemeral => ephemeral_dir(ult_home),
    }
}

pub(crate) fn prompt_package_parent_dir(ult_home: &Path, scope: PromptScope) -> PathBuf {
    lifecycle_dir(ult_home, scope).join("prompts")
}

pub(crate) fn prompt_package_dir(ult_home: &Path, scope: PromptScope, handle: &str) -> PathBuf {
    prompt_package_parent_dir(ult_home, scope).join(handle)
}

pub(crate) fn prompt_scope_dir(ult_home: &Path, scope: PromptScope) -> PathBuf {
    prompt_package_parent_dir(ult_home, scope)
}

pub(crate) fn context_package_parent_dir(ult_home: &Path, scope: PromptScope) -> PathBuf {
    lifecycle_dir(ult_home, scope).join("contexts")
}

pub(crate) fn context_package_dir(ult_home: &Path, scope: PromptScope, handle: &str) -> PathBuf {
    context_package_parent_dir(ult_home, scope).join(handle)
}

pub(crate) fn context_scope_dir(ult_home: &Path, scope: PromptScope) -> PathBuf {
    context_package_parent_dir(ult_home, scope)
}

pub(crate) fn skill_package_parent_dir(ult_home: &Path) -> PathBuf {
    persistent_dir(ult_home).join("skills")
}

pub(crate) fn skill_package_dir(ult_home: &Path, handle: &str) -> PathBuf {
    skill_package_parent_dir(ult_home).join(handle)
}

pub(crate) fn persistent_skills_dir(ult_home: &Path) -> PathBuf {
    skill_package_parent_dir(ult_home)
}

pub(crate) fn command_package_parent_dir(ult_home: &Path) -> PathBuf {
    persistent_dir(ult_home).join("commands")
}

pub(crate) fn command_package_dir(ult_home: &Path, handle: &str) -> PathBuf {
    command_package_parent_dir(ult_home).join(handle)
}

pub(crate) fn persistent_commands_dir(ult_home: &Path) -> PathBuf {
    command_package_parent_dir(ult_home)
}

pub(crate) fn artifact_package_dir(ult_home: &Path, prompt: &PromptDefinition) -> PathBuf {
    match prompt.artifact_type {
        PromptArtifactType::Prompt => prompt_package_dir(ult_home, prompt.scope, &prompt.id),
        PromptArtifactType::Context => context_package_dir(ult_home, prompt.scope, &prompt.id),
        PromptArtifactType::Skill => skill_package_dir(ult_home, &prompt.id),
    }
}

pub(crate) fn prompt_file_path(
    ult_home: &Path,
    prompt: &PromptDefinition,
    _extension: &str,
) -> PathBuf {
    artifact_package_dir(ult_home, prompt).join(artifact_package_file_name(prompt.artifact_type))
}

pub(crate) fn export_package_dir(ult_home: &Path, prompt: &PromptDefinition) -> PathBuf {
    ult_home.join("exports").join(&prompt.id)
}

pub(crate) fn artifact_package_file_name(artifact_type: PromptArtifactType) -> &'static str {
    match artifact_type {
        PromptArtifactType::Prompt => PROMPT_PACKAGE_FILE,
        PromptArtifactType::Context => CONTEXT_PACKAGE_FILE,
        PromptArtifactType::Skill => SKILL_PACKAGE_FILE,
    }
}

pub(crate) fn ult_home_dir() -> Result<PathBuf, String> {
    ult_home_dir_from_env(std::env::var_os("HOME"), std::env::var_os("USERPROFILE"))
}

pub(crate) fn ult_home_dir_from_env(
    home: Option<std::ffi::OsString>,
    userprofile: Option<std::ffi::OsString>,
) -> Result<PathBuf, String> {
    let home = home
        .or(userprofile)
        .map(PathBuf::from)
        .ok_or_else(|| "HOME is not set".to_string())?;
    Ok(home.join(".ult"))
}
