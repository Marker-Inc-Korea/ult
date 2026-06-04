use super::catalog::{
    bootstrap_personal_library, ensure_ult_home, load_command_package_from_contents,
    load_intervention_library_from_home, load_local_prompt_files, parse_agent_workflow_packs_json,
    parse_bundled_prompts_json, parse_skill_metadata, prompt_ids, prompt_registry_entry,
    PromptRegistryBuilder,
};
use super::files::{
    load_local_prompt_file, parse_import_prompt_contents, prompt_file_to_markdown,
    prompt_file_to_toml, prompt_to_toml_entry, remove_artifact_package_source,
    write_prompt_file_to_path, write_prompt_file_to_registry,
};
use super::github_import::{
    import_github_library_pack_from_files, preview_github_library_import_from_files,
};
use super::lifecycle::{
    capture_ephemeral_context_artifact_unlocked, cleanup_expired_ephemeral_artifacts,
    first_available_opaque_id, save_workflow_input_context_artifact_unlocked,
};
use super::model::{
    GitHubLibraryImportAction, GitHubLibraryImportFile, GitHubLibraryImportSource, InputPrompt,
    LauncherCommandAction, LibraryPackageType, PromptArtifactSource, PromptArtifactType,
    PromptRegistrySource, PromptScope, PromptTemplateArgument, PromptTemplateArgumentKind,
    PromptTemplateEnumSource, EPHEMERAL_ARTIFACT_TTL_MS,
};
use super::operations::export_intervention_artifacts_from_registry;
use super::paths::{
    command_package_dir, context_package_dir, context_scope_dir, ephemeral_dir,
    persistent_commands_dir, persistent_dir, persistent_skills_dir, personal_library_dir,
    personal_library_readme_path, prompt_file_path, prompt_package_dir, prompt_scope_dir,
    skill_package_dir, ult_home_dir_from_env, LocalArtifactClass, COMMAND_PACKAGE_FILE,
    CONTEXT_PACKAGE_FILE, PROMPT_PACKAGE_FILE, SKILL_PACKAGE_FILE,
};
use super::project_write::{
    preview_project_artifact_write_from_registry, preview_project_setup_from_registry,
    write_project_artifact_from_registry, write_project_setup_from_registry_for_test,
    ProjectArtifactWriteAction, ProjectArtifactWriteKind, ProjectArtifactWriteRequest,
    ProjectSetupPreviewRequest, ProjectSetupWriteRequest, ProjectSetupWriteTarget,
};
use super::template::extract_template_variables;
use super::validation::validate_prompt;

mod bootstrap_tests;
mod catalog_tests;
mod command_catalog_tests;
mod github_import_tests;
mod legacy_path_tests;
mod lifecycle_tests;
mod malformed_catalog_tests;
mod package_file_tests;
mod project_write_tests;
mod skill_catalog_tests;
mod validation_tests;

fn input_prompt() -> InputPrompt {
    InputPrompt {
        id: Some("scope-lock".to_string()),
        title: "Scope Lock".to_string(),
        artifact_type: Some(PromptArtifactType::Prompt),
        scope: Some(PromptScope::Persistent),
        pinned: false,
        prompt: "Stay scoped.".to_string(),
        contexts: Vec::new(),
        description: "Constrain scope.".to_string(),
        shortcut: None,
        confirm: false,
        template_arguments: Vec::new(),
        created_at: None,
        expires_at: None,
        source: PromptArtifactSource::User,
    }
}

fn unique_temp_dir(label: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "{label}-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("time")
            .as_nanos()
    ))
}

fn github_source() -> GitHubLibraryImportSource {
    GitHubLibraryImportSource {
        owner: "not-agent".to_string(),
        repo: "ult-pack".to_string(),
        requested_ref: Some("main".to_string()),
        resolved_ref: "main".to_string(),
        commit: "abcdef1234567890".to_string(),
        source_url: "https://github.com/not-agent/ult-pack/tree/abcdef1234567890".to_string(),
    }
}

fn assert_opaque_artifact_id(id: &str) {
    assert_eq!(id.len(), 7);
    assert!(id.chars().all(|character| character.is_ascii_hexdigit()));
    assert_eq!(id, id.to_ascii_lowercase());
}

fn write_test_markdown_artifact(path: &std::path::Path, title: &str, body: &str) {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).expect("artifact parent");
    }
    std::fs::write(
        path,
        format!(
            "---\ntitle = \"{}\"\ndescription = \"test artifact\"\n---\n\n{}",
            title, body
        ),
    )
    .expect("artifact file");
}
