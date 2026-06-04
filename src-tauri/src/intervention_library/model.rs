use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptArtifactType {
    #[default]
    Prompt,
    Context,
    Skill,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptScope {
    #[default]
    Persistent,
    Ephemeral,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptArtifactSource {
    #[default]
    User,
    Clipboard,
    Scratch,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptTemplateArgumentKind {
    #[default]
    Text,
    Enum,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptTemplateEnumSource {
    #[default]
    Static,
    Dynamic,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq, Serialize)]
pub struct PromptTemplateArgument {
    pub name: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub description: String,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub default_value: String,
    #[serde(default, skip_serializing_if = "is_text_argument")]
    pub value_type: PromptTemplateArgumentKind,
    #[serde(default, skip_serializing_if = "is_static_enum_source")]
    pub enum_source: PromptTemplateEnumSource,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub enum_name: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub enum_values: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enum_dynamic_command: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub enum_dynamic_cwd: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PromptDefinition {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub artifact_type: PromptArtifactType,
    #[serde(default)]
    pub scope: PromptScope,
    #[serde(default)]
    pub pinned: bool,
    pub description: String,
    pub prompt: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub contexts: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shortcut: Option<String>,
    #[serde(default)]
    pub confirm: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub template_arguments: Vec<PromptTemplateArgument>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<u64>,
    #[serde(default, skip_serializing_if = "is_user_artifact_source")]
    pub source: PromptArtifactSource,
}

#[derive(Clone, Debug, Serialize)]
pub struct PromptLoadResult {
    pub artifacts: Vec<PromptDefinition>,
    pub entries: Vec<PromptRegistryEntry>,
    pub commands: Vec<LauncherCommandDefinition>,
    pub config_path: String,
    pub registry_path: String,
    pub editable_artifact_ids: Vec<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PromptRegistryEntry {
    pub prompt: PromptDefinition,
    pub source: PromptRegistrySource,
    pub source_path: Option<String>,
    pub source_created_ms: Option<u64>,
    pub source_modified_ms: Option<u64>,
    pub editable: bool,
    pub template_variables: Vec<String>,
    pub diagnostics: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PromptRegistrySource {
    Bundled,
    LocalFile,
    LocalOverride,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LibraryPackageType {
    #[default]
    Prompt,
    Context,
    Skill,
    Command,
}

impl From<PromptArtifactType> for LibraryPackageType {
    fn from(value: PromptArtifactType) -> Self {
        match value {
            PromptArtifactType::Prompt => Self::Prompt,
            PromptArtifactType::Context => Self::Context,
            PromptArtifactType::Skill => Self::Skill,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum LauncherCommandAction {
    #[default]
    Prepare,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LauncherCommandDefinition {
    pub id: String,
    pub title: String,
    pub description: String,
    pub prompt_id: String,
    pub contexts: Vec<String>,
    pub variable_values: BTreeMap<String, String>,
    pub keywords: Vec<String>,
    pub aliases: Vec<String>,
    pub actions: Vec<LauncherCommandAction>,
    pub home: bool,
    pub source_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct InputLauncherCommand {
    pub(crate) title: String,
    #[serde(default)]
    pub(crate) description: String,
    #[serde(default, alias = "prompt")]
    pub(crate) prompt_id: Option<String>,
    #[serde(default)]
    pub(crate) contexts: Vec<String>,
    #[serde(default, alias = "variables")]
    pub(crate) variable_values: BTreeMap<String, String>,
    #[serde(default)]
    pub(crate) keywords: Vec<String>,
    #[serde(default)]
    pub(crate) aliases: Vec<String>,
    #[serde(default)]
    pub(crate) actions: Vec<LauncherCommandAction>,
    #[serde(default = "default_true")]
    pub(crate) home: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct PromptImportSummary {
    pub imported_count: usize,
    pub updated_count: usize,
    pub imported_artifact_ids: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
pub struct PromptExportResult {
    pub file_path: String,
    pub artifact_count: usize,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GitHubLibraryImportRequest {
    pub url: String,
    #[serde(default)]
    pub reference: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GitHubLibraryImportSelection {
    pub url: String,
    #[serde(default)]
    pub reference: Option<String>,
    #[serde(default)]
    pub selected_paths: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct GitHubLibraryImportSource {
    pub owner: String,
    pub repo: String,
    pub requested_ref: Option<String>,
    pub resolved_ref: String,
    pub commit: String,
    pub source_url: String,
}

#[derive(Debug, Clone)]
pub struct GitHubLibraryImportFile {
    pub path: String,
    pub contents: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitHubLibraryImportPreview {
    pub owner: String,
    pub repo: String,
    pub requested_ref: Option<String>,
    pub resolved_ref: String,
    pub commit: String,
    pub source_url: String,
    pub entries: Vec<GitHubLibraryImportEntry>,
    pub ignored_files: Vec<GitHubLibraryImportIssue>,
    pub malformed_packages: Vec<GitHubLibraryImportIssue>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitHubLibraryImportEntry {
    pub artifact_id: String,
    pub artifact_type: LibraryPackageType,
    pub title: String,
    pub source_path: String,
    pub target_path: String,
    pub action: GitHubLibraryImportAction,
    pub diagnostics: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum GitHubLibraryImportAction {
    New,
    Overwrite,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitHubLibraryImportIssue {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitHubLibraryImportSummary {
    pub imported_count: usize,
    pub updated_count: usize,
    pub imported_artifact_ids: Vec<String>,
    pub commit: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct OutputPromptFile<'a> {
    pub(crate) id: &'a str,
    pub(crate) title: &'a str,
    pub(crate) artifact_type: PromptArtifactType,
    pub(crate) scope: PromptScope,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) pinned: bool,
    pub(crate) description: &'a str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) contexts: &'a Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) shortcut: Option<&'a String>,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) confirm: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) template_arguments: &'a Vec<PromptTemplateArgument>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) created_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) expires_at: Option<u64>,
    #[serde(skip_serializing_if = "is_user_artifact_source")]
    pub(crate) source: PromptArtifactSource,
    pub(crate) prompt: &'a str,
}

#[derive(Debug, Serialize)]
pub(crate) struct OutputPersonalLibraryMarkdownFile<'a> {
    pub(crate) title: &'a str,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) pinned: bool,
    pub(crate) description: &'a str,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) contexts: &'a Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) shortcut: Option<&'a String>,
    #[serde(skip_serializing_if = "is_false")]
    pub(crate) confirm: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(crate) template_arguments: &'a Vec<PromptTemplateArgument>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) created_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) expires_at: Option<u64>,
    #[serde(skip_serializing_if = "is_user_artifact_source")]
    pub(crate) source: PromptArtifactSource,
}

#[derive(Debug, Deserialize)]
pub(crate) struct InputPrompt {
    #[serde(default)]
    pub(crate) id: Option<String>,
    pub(crate) title: String,
    #[serde(default, alias = "type")]
    pub(crate) artifact_type: Option<PromptArtifactType>,
    #[serde(default)]
    pub(crate) scope: Option<PromptScope>,
    #[serde(default)]
    pub(crate) pinned: bool,
    #[serde(default)]
    pub(crate) prompt: String,
    #[serde(default)]
    pub(crate) contexts: Vec<String>,
    #[serde(default)]
    pub(crate) description: String,
    #[serde(default)]
    pub(crate) shortcut: Option<String>,
    #[serde(default)]
    pub(crate) confirm: bool,
    #[serde(default)]
    pub(crate) template_arguments: Vec<PromptTemplateArgument>,
    #[serde(default)]
    pub(crate) created_at: Option<u64>,
    #[serde(default)]
    pub(crate) expires_at: Option<u64>,
    #[serde(default)]
    pub(crate) source: PromptArtifactSource,
}

pub const EPHEMERAL_ARTIFACT_TTL_MS: u64 = 7 * 24 * 60 * 60 * 1000;

pub(crate) fn is_false(value: &bool) -> bool {
    !*value
}

pub(crate) fn is_user_artifact_source(value: &PromptArtifactSource) -> bool {
    *value == PromptArtifactSource::User
}

pub(crate) fn is_text_argument(value: &PromptTemplateArgumentKind) -> bool {
    *value == PromptTemplateArgumentKind::Text
}

pub(crate) fn is_static_enum_source(value: &PromptTemplateEnumSource) -> bool {
    *value == PromptTemplateEnumSource::Static
}

pub(crate) fn default_true() -> bool {
    true
}
