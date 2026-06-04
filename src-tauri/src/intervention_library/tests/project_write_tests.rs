use super::*;

#[test]
fn project_prompt_export_requires_explicit_target_and_overwrite_confirmation() {
    let root = unique_temp_dir("ult-project-export-library");
    let project = unique_temp_dir("ult-project-export-target");
    super::ensure_ult_home(&root).expect("library");
    std::fs::create_dir_all(&project).expect("project dir");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");
    let registry = super::load_intervention_library_from_home(&root);
    let request = super::ProjectArtifactWriteRequest {
        artifact_id: "scope-lock".to_string(),
        write_kind: super::ProjectArtifactWriteKind::Prompt,
        target_directory: project.display().to_string(),
        overwrite: false,
    };

    let preview =
        super::preview_project_artifact_write_from_registry(registry.clone(), request.clone())
            .expect("preview");

    assert!(preview.ready_to_write);
    assert!(!preview.requires_overwrite_confirmation);
    assert_eq!(preview.files.len(), 1);
    assert!(preview.files[0]
        .relative_path
        .ends_with(".ult/prompts/scope-lock/PROMPT.md"));
    assert_eq!(
        preview.files[0].action,
        super::ProjectArtifactWriteAction::Create
    );

    let write = super::write_project_artifact_from_registry(registry.clone(), request.clone())
        .expect("write");
    assert_eq!(write.written_files.len(), 1);
    let exported = project.join(".ult/prompts/scope-lock/PROMPT.md");
    assert!(exported.is_file());
    assert!(std::fs::read_to_string(&exported)
        .expect("project export")
        .contains("Stay scoped."));

    let blocked_preview =
        super::preview_project_artifact_write_from_registry(registry.clone(), request.clone())
            .expect("blocked preview");
    assert!(!blocked_preview.ready_to_write);
    assert!(blocked_preview.requires_overwrite_confirmation);
    assert_eq!(
        blocked_preview.files[0].action,
        super::ProjectArtifactWriteAction::Blocked
    );
    assert!(
        super::write_project_artifact_from_registry(registry.clone(), request.clone())
            .expect_err("overwrite confirmation")
            .contains("confirm overwrite")
    );

    let overwrite = super::ProjectArtifactWriteRequest {
        overwrite: true,
        ..request
    };
    let overwrite_preview =
        super::preview_project_artifact_write_from_registry(registry.clone(), overwrite.clone())
            .expect("overwrite preview");
    assert!(overwrite_preview.ready_to_write);
    assert_eq!(
        overwrite_preview.files[0].action,
        super::ProjectArtifactWriteAction::Overwrite
    );
    super::write_project_artifact_from_registry(registry, overwrite).expect("overwrite");

    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn project_write_paths_are_kind_specific_and_agents_snippet_is_explicit() {
    let root = unique_temp_dir("ult-project-kind-library");
    let project = unique_temp_dir("ult-project-kind-target");
    let prompt_project = unique_temp_dir("ult-project-kind-prompt-target");
    super::ensure_ult_home(&root).expect("library");
    std::fs::create_dir_all(&project).expect("project dir");
    std::fs::create_dir_all(&prompt_project).expect("prompt project dir");

    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");

    let mut context = input_prompt();
    context.id = Some("repo-policy".to_string());
    context.title = "Repo Policy".to_string();
    context.artifact_type = Some(super::PromptArtifactType::Context);
    context.prompt = "Never read terminal contents by default.".to_string();
    let context = validate_prompt(context, None).expect("context");
    super::write_prompt_file_to_registry(&root, &context).expect("write context");

    let mut skill = input_prompt();
    skill.id = Some("diagnose".to_string());
    skill.title = "Diagnose".to_string();
    skill.description = "Debug failures.".to_string();
    skill.artifact_type = Some(super::PromptArtifactType::Skill);
    skill.prompt = "---\nname: Diagnose\n---\n\nInspect logs.".to_string();
    let skill = validate_prompt(skill, None).expect("skill");
    super::write_prompt_file_to_registry(&root, &skill).expect("write skill");

    let registry = super::load_intervention_library_from_home(&root);
    let context_preview = super::preview_project_artifact_write_from_registry(
        registry.clone(),
        super::ProjectArtifactWriteRequest {
            artifact_id: "repo-policy".to_string(),
            write_kind: super::ProjectArtifactWriteKind::Context,
            target_directory: project.display().to_string(),
            overwrite: false,
        },
    )
    .expect("context preview");
    assert!(context_preview.files[0]
        .relative_path
        .ends_with(".ult/contexts/repo-policy/CONTEXT.md"));

    let skill_preview = super::preview_project_artifact_write_from_registry(
        registry.clone(),
        super::ProjectArtifactWriteRequest {
            artifact_id: "diagnose".to_string(),
            write_kind: super::ProjectArtifactWriteKind::Skill,
            target_directory: project.display().to_string(),
            overwrite: false,
        },
    )
    .expect("skill preview");
    assert!(skill_preview.files[0]
        .relative_path
        .ends_with(".codex/skills/diagnose/SKILL.md"));

    let snippet = super::write_project_artifact_from_registry(
        registry.clone(),
        super::ProjectArtifactWriteRequest {
            artifact_id: "repo-policy".to_string(),
            write_kind: super::ProjectArtifactWriteKind::AgentsSnippet,
            target_directory: project.display().to_string(),
            overwrite: false,
        },
    )
    .expect("agents snippet");
    assert!(snippet.written_files[0].ends_with("AGENTS.md"));
    let agents = std::fs::read_to_string(project.join("AGENTS.md")).expect("agents");
    assert!(agents.contains("Ult Context: @repo-policy"));
    assert!(agents.contains("Never read terminal contents by default."));

    let prompt_snippet = super::write_project_artifact_from_registry(
        registry,
        super::ProjectArtifactWriteRequest {
            artifact_id: "scope-lock".to_string(),
            write_kind: super::ProjectArtifactWriteKind::AgentsSnippet,
            target_directory: prompt_project.display().to_string(),
            overwrite: false,
        },
    )
    .expect("prompt agents snippet");
    assert!(prompt_snippet.written_files[0].ends_with("AGENTS.md"));
    let prompt_agents =
        std::fs::read_to_string(prompt_project.join("AGENTS.md")).expect("prompt agents");
    assert!(prompt_agents.contains("Ult Prompt: #scope-lock"));
    assert!(prompt_agents.contains("workflow calls for `#scope-lock`"));
    assert!(!prompt_agents.contains("Ult Prompt: /scope-lock"));
    assert!(!prompt_agents.contains("`/scope-lock`"));

    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(project);
    let _ = std::fs::remove_dir_all(prompt_project);
}

#[test]
fn project_setup_bulk_preview_and_write_use_plan_hash() {
    let root = unique_temp_dir("ult-project-setup-library");
    let project = unique_temp_dir("ult-project-setup-target");
    super::ensure_ult_home(&root).expect("library");
    std::fs::create_dir_all(&project).expect("project dir");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");

    let mut context = input_prompt();
    context.id = Some("repo-policy".to_string());
    context.title = "Repo Policy".to_string();
    context.artifact_type = Some(super::PromptArtifactType::Context);
    context.prompt = "Follow repo policy.".to_string();
    let context = validate_prompt(context, None).expect("context");
    super::write_prompt_file_to_registry(&root, &context).expect("write context");

    let registry = super::load_intervention_library_from_home(&root);
    let targets = vec![
        super::ProjectSetupWriteTarget {
            artifact_id: "scope-lock".to_string(),
            write_kind: super::ProjectArtifactWriteKind::Prompt,
        },
        super::ProjectSetupWriteTarget {
            artifact_id: "repo-policy".to_string(),
            write_kind: super::ProjectArtifactWriteKind::Context,
        },
        super::ProjectSetupWriteTarget {
            artifact_id: "scope-lock".to_string(),
            write_kind: super::ProjectArtifactWriteKind::AgentsSnippet,
        },
    ];
    let preview = super::preview_project_setup_from_registry(
        registry.clone(),
        super::ProjectSetupPreviewRequest {
            target_directory: project.display().to_string(),
            targets: targets.clone(),
            overwrite: false,
        },
    )
    .expect("preview");

    assert_eq!(preview.entries.len(), 3);
    assert!(preview.ready_to_write);
    assert!(!preview.requires_overwrite_confirmation);
    assert!(preview.plan_hash.starts_with("fnv1a64:"));

    let result = super::write_project_setup_from_registry_for_test(
        registry,
        super::ProjectSetupWriteRequest {
            target_directory: project.display().to_string(),
            targets,
            overwrite: false,
            plan_hash: preview.plan_hash,
        },
    )
    .expect("write");
    assert!(result.ok);
    assert_eq!(result.entries.len(), 3);
    assert_eq!(result.written_files.len(), 3);
    assert!(result.failed_files.is_empty());
    assert!(project.join(".ult/prompts/scope-lock/PROMPT.md").is_file());
    assert!(project
        .join(".ult/contexts/repo-policy/CONTEXT.md")
        .is_file());
    assert!(project.join("AGENTS.md").is_file());

    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn project_setup_write_rejects_changed_target_directory() {
    let root = unique_temp_dir("ult-project-setup-stale-library");
    let project = unique_temp_dir("ult-project-setup-stale-target");
    let other_project = unique_temp_dir("ult-project-setup-other-target");
    super::ensure_ult_home(&root).expect("library");
    std::fs::create_dir_all(&project).expect("project dir");
    std::fs::create_dir_all(&other_project).expect("other project dir");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");
    let registry = super::load_intervention_library_from_home(&root);
    let targets = vec![super::ProjectSetupWriteTarget {
        artifact_id: "scope-lock".to_string(),
        write_kind: super::ProjectArtifactWriteKind::Prompt,
    }];
    let preview = super::preview_project_setup_from_registry(
        registry.clone(),
        super::ProjectSetupPreviewRequest {
            target_directory: project.display().to_string(),
            targets: targets.clone(),
            overwrite: false,
        },
    )
    .expect("preview");

    let error = super::write_project_setup_from_registry_for_test(
        registry,
        super::ProjectSetupWriteRequest {
            target_directory: other_project.display().to_string(),
            targets,
            overwrite: false,
            plan_hash: preview.plan_hash,
        },
    )
    .expect_err("changed target should be stale");
    assert!(error.contains("stale"));

    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(project);
    let _ = std::fs::remove_dir_all(other_project);
}

#[test]
fn project_setup_overwrite_confirmation_is_tied_to_previewed_file_set() {
    let root = unique_temp_dir("ult-project-setup-overwrite-library");
    let project = unique_temp_dir("ult-project-setup-overwrite-target");
    super::ensure_ult_home(&root).expect("library");
    std::fs::create_dir_all(project.join(".ult/prompts/scope-lock")).expect("project dirs");
    std::fs::write(
        project.join(".ult/prompts/scope-lock/PROMPT.md"),
        "old prompt",
    )
    .expect("existing project prompt");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");
    let registry = super::load_intervention_library_from_home(&root);
    let targets = vec![super::ProjectSetupWriteTarget {
        artifact_id: "scope-lock".to_string(),
        write_kind: super::ProjectArtifactWriteKind::Prompt,
    }];
    let preview = super::preview_project_setup_from_registry(
        registry.clone(),
        super::ProjectSetupPreviewRequest {
            target_directory: project.display().to_string(),
            targets: targets.clone(),
            overwrite: false,
        },
    )
    .expect("preview");

    assert!(!preview.ready_to_write);
    assert!(preview.requires_overwrite_confirmation);
    assert_eq!(
        preview.entries[0].preview.as_ref().expect("entry").files[0].action,
        super::ProjectArtifactWriteAction::Blocked,
    );

    let blocked = super::write_project_setup_from_registry_for_test(
        registry.clone(),
        super::ProjectSetupWriteRequest {
            target_directory: project.display().to_string(),
            targets: targets.clone(),
            overwrite: false,
            plan_hash: preview.plan_hash.clone(),
        },
    )
    .expect_err("overwrite confirmation");
    assert!(blocked.contains("confirm overwrite"));

    let result = super::write_project_setup_from_registry_for_test(
        registry,
        super::ProjectSetupWriteRequest {
            target_directory: project.display().to_string(),
            targets,
            overwrite: true,
            plan_hash: preview.plan_hash,
        },
    )
    .expect("overwrite");
    assert!(result.ok);
    assert!(
        std::fs::read_to_string(project.join(".ult/prompts/scope-lock/PROMPT.md"))
            .expect("project prompt")
            .contains("Stay scoped.")
    );

    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(project);
}

#[test]
fn project_setup_reports_partial_write_failures() {
    let root = unique_temp_dir("ult-project-setup-partial-library");
    let project = unique_temp_dir("ult-project-setup-partial-target");
    super::ensure_ult_home(&root).expect("library");
    std::fs::create_dir_all(&project).expect("project dir");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");

    let mut context = input_prompt();
    context.id = Some("repo-policy".to_string());
    context.title = "Repo Policy".to_string();
    context.artifact_type = Some(super::PromptArtifactType::Context);
    context.prompt = "Follow repo policy.".to_string();
    let context = validate_prompt(context, None).expect("context");
    super::write_prompt_file_to_registry(&root, &context).expect("write context");

    let registry = super::load_intervention_library_from_home(&root);
    let targets = vec![
        super::ProjectSetupWriteTarget {
            artifact_id: "scope-lock".to_string(),
            write_kind: super::ProjectArtifactWriteKind::Prompt,
        },
        super::ProjectSetupWriteTarget {
            artifact_id: "repo-policy".to_string(),
            write_kind: super::ProjectArtifactWriteKind::Context,
        },
    ];
    let preview = super::preview_project_setup_from_registry(
        registry.clone(),
        super::ProjectSetupPreviewRequest {
            target_directory: project.display().to_string(),
            targets: targets.clone(),
            overwrite: false,
        },
    )
    .expect("preview");
    std::fs::create_dir_all(project.join(".ult/contexts")).expect("context parent");
    std::fs::write(project.join(".ult/contexts/repo-policy"), "not a directory")
        .expect("blocking parent path");

    let result = super::write_project_setup_from_registry_for_test(
        registry,
        super::ProjectSetupWriteRequest {
            target_directory: project.display().to_string(),
            targets,
            overwrite: false,
            plan_hash: preview.plan_hash,
        },
    )
    .expect("partial result");
    assert!(!result.ok);
    assert_eq!(result.written_files.len(), 1);
    assert_eq!(result.failed_files.len(), 1);
    assert!(result.written_files[0].ends_with(".ult/prompts/scope-lock/PROMPT.md"));
    assert!(result.failed_files[0].ends_with(".ult/contexts/repo-policy/CONTEXT.md"));
    assert!(result.entries.iter().any(|entry| entry.error.is_some()));

    let _ = std::fs::remove_dir_all(root);
    let _ = std::fs::remove_dir_all(project);
}
