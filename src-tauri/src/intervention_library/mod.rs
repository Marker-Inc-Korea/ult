mod catalog;
mod files;
mod github_import;
mod lifecycle;
mod model;
mod operations;
mod paths;
mod project_write;
mod template;
mod validation;

pub(crate) use catalog::{
    ensure_ult_home_for_app, load_intervention_library_from_disk, persistent_skills_dir_for_app,
};
pub(crate) use github_import::{import_github_library_pack, preview_github_library_import};
pub(crate) use lifecycle::{
    capture_ephemeral_context_artifact, cleanup_expired_ephemeral_artifacts_for_app,
    save_workflow_input_context_artifact,
};
pub(crate) use model::{
    GitHubLibraryImportFile, GitHubLibraryImportPreview, GitHubLibraryImportRequest,
    GitHubLibraryImportSelection, GitHubLibraryImportSource, GitHubLibraryImportSummary,
    PromptArtifactSource, PromptArtifactType, PromptDefinition, PromptExportResult,
    PromptImportSummary, PromptLoadResult, PromptScope,
};
pub(crate) use operations::{
    add_intervention_artifact, delete_intervention_artifact, export_intervention_artifacts,
    import_intervention_artifacts, prompt_source_path_for_app, update_intervention_artifact,
};
pub(crate) use project_write::{
    preview_project_artifact_write, preview_project_setup, write_project_artifact,
    write_project_setup, ProjectArtifactWritePreview, ProjectArtifactWriteRequest,
    ProjectArtifactWriteResult, ProjectSetupPreview, ProjectSetupPreviewRequest,
    ProjectSetupResult, ProjectSetupWriteRequest,
};

#[cfg(test)]
mod tests;
