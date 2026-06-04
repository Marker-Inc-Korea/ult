use super::*;

#[test]
fn creates_personal_library_structure() {
    let root = unique_temp_dir("ult-library");
    super::ensure_ult_home(&root).expect("library");

    assert!(super::prompt_scope_dir(&root, super::PromptScope::Persistent).is_dir());
    assert!(super::prompt_scope_dir(&root, super::PromptScope::Ephemeral).is_dir());
    assert!(super::context_scope_dir(&root, super::PromptScope::Persistent).is_dir());
    assert!(super::context_scope_dir(&root, super::PromptScope::Ephemeral).is_dir());
    assert!(super::persistent_skills_dir(&root).is_dir());
    assert!(root.join("personal-library").is_dir());
    assert!(!root.join("prompts").exists());
    assert!(root
        .join("personal-library")
        .join("ephemeral")
        .join("prompts")
        .is_dir());
    assert!(!root
        .join("personal-library")
        .join("ephemeral")
        .join("skills")
        .exists());
    assert!(!root.join("personal-library").join("prompts").exists());
    assert!(!root.join("personal-library").join("contexts").exists());
    assert!(!root.join("personal-library").join("skills").exists());
    assert!(!root.join("personal-library").join("scratch").exists());
    assert!(!root.join("contexts").exists());

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn skill_package_directory_names_reserve_artifact_ids() {
    let root = unique_temp_dir("ult-skill-id-reservation");
    super::ensure_ult_home(&root).expect("library");
    let skill_dir = super::persistent_skills_dir(&root).join("75ac6db");
    std::fs::create_dir_all(&skill_dir).expect("skill dir");
    std::fs::write(
        skill_dir.join("SKILL.md"),
        "---\nname: Clip Skill\ndescription: Reserve this id.\n---\n\nUse logs.",
    )
    .expect("skill");

    let context =
        super::capture_ephemeral_context_artifact_unlocked(&root, "Copied text".to_string(), 1234)
            .expect("context");

    assert_opaque_artifact_id(&context.id);
    assert_ne!(context.id, "75ac6db");

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn resolves_ult_home_under_visible_user_dot_ult() {
    let home = unique_temp_dir("ult-home");
    assert_eq!(
        super::ult_home_dir_from_env(Some(home.clone().into_os_string()), None).expect("home"),
        home.join(".ult"),
    );

    let userprofile = unique_temp_dir("ult-userprofile");
    assert_eq!(
        super::ult_home_dir_from_env(None, Some(userprofile.clone().into_os_string()))
            .expect("userprofile"),
        userprofile.join(".ult"),
    );

    assert!(super::ult_home_dir_from_env(None, None)
        .expect_err("missing home")
        .contains("HOME is not set"));
}

#[test]
fn stores_artifacts_in_class_specific_library_dirs() {
    let root = unique_temp_dir("ult-artifact-paths");
    let mut prompt = validate_prompt(input_prompt(), None).expect("prompt");
    assert!(super::prompt_file_path(&root, &prompt, "md")
        .ends_with("personal-library/persistent/prompts/scope-lock/PROMPT.md"));

    prompt.scope = super::PromptScope::Ephemeral;
    assert!(super::prompt_file_path(&root, &prompt, "md")
        .ends_with("personal-library/ephemeral/prompts/scope-lock/PROMPT.md"));

    prompt.artifact_type = super::PromptArtifactType::Context;
    prompt.scope = super::PromptScope::Persistent;
    assert!(super::prompt_file_path(&root, &prompt, "md")
        .ends_with("personal-library/persistent/contexts/scope-lock/CONTEXT.md"));

    prompt.scope = super::PromptScope::Ephemeral;
    assert!(super::prompt_file_path(&root, &prompt, "md")
        .ends_with("personal-library/ephemeral/contexts/scope-lock/CONTEXT.md"));
}

#[test]
fn lifecycle_path_helpers_point_to_package_directories() {
    let root = unique_temp_dir("ult-package-helpers");

    assert!(super::persistent_dir(&root).ends_with("personal-library/persistent"));
    assert!(super::ephemeral_dir(&root).ends_with("personal-library/ephemeral"));
    assert!(
        super::prompt_package_dir(&root, super::PromptScope::Persistent, "scope-lock")
            .ends_with("personal-library/persistent/prompts/scope-lock")
    );
    assert!(
        super::context_package_dir(&root, super::PromptScope::Ephemeral, "89abcde")
            .ends_with("personal-library/ephemeral/contexts/89abcde")
    );
    assert!(super::skill_package_dir(&root, "diagnose")
        .ends_with("personal-library/persistent/skills/diagnose"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn captures_ephemeral_context_as_library_file() {
    let root = unique_temp_dir("ult-captured-context");
    super::ensure_ult_home(&root).expect("library");

    let context = super::capture_ephemeral_context_artifact_unlocked(
        &root,
        "  Copied selection\nwith details  ".to_string(),
        1234,
    )
    .expect("captured context");

    assert_opaque_artifact_id(&context.id);
    assert_eq!(context.title, "Copied selection");
    assert_eq!(context.artifact_type, super::PromptArtifactType::Context);
    assert_eq!(context.scope, super::PromptScope::Ephemeral);
    assert_eq!(context.source, super::PromptArtifactSource::Clipboard);
    assert_eq!(context.created_at, Some(1234));
    assert_eq!(
        context.expires_at,
        Some(1234 + super::EPHEMERAL_ARTIFACT_TTL_MS)
    );
    assert_eq!(context.prompt, "Copied selection\nwith details");

    let path = super::prompt_file_path(&root, &context, "md");
    assert!(path.ends_with(format!(
        "personal-library/ephemeral/contexts/{}/CONTEXT.md",
        context.id
    )));
    let contents = std::fs::read_to_string(path).expect("context file");
    assert!(contents.contains("title = \"Copied selection\""));
    assert!(contents.contains("source = \"clipboard\""));
    assert!(contents.contains("created_at = 1234"));
    assert!(contents.contains("Copied selection\nwith details"));

    let next = super::capture_ephemeral_context_artifact_unlocked(
        &root,
        "Another copied selection".to_string(),
        2234,
    )
    .expect("next context");
    assert_opaque_artifact_id(&next.id);
    assert_ne!(next.id, context.id);

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn saves_workflow_input_as_explicit_ephemeral_context() {
    let root = unique_temp_dir("ult-workflow-input-context");
    super::ensure_ult_home(&root).expect("library");

    let context = super::save_workflow_input_context_artifact_unlocked(
        &root,
        "  PRIVATE failing command output\nstack trace  ".to_string(),
        "Fix Failing Tests".to_string(),
        3456,
    )
    .expect("workflow input context");

    assert_opaque_artifact_id(&context.id);
    assert_eq!(context.title, "Fix Failing Tests Input");
    assert_eq!(context.description, "Explicit input for Fix Failing Tests.");
    assert_eq!(context.artifact_type, super::PromptArtifactType::Context);
    assert_eq!(context.scope, super::PromptScope::Ephemeral);
    assert_eq!(context.source, super::PromptArtifactSource::User);
    assert_eq!(context.created_at, Some(3456));
    assert_eq!(
        context.expires_at,
        Some(3456 + super::EPHEMERAL_ARTIFACT_TTL_MS)
    );
    assert_eq!(
        context.prompt,
        "PRIVATE failing command output\nstack trace"
    );

    let path = super::prompt_file_path(&root, &context, "md");
    assert!(path.ends_with(format!(
        "personal-library/ephemeral/contexts/{}/CONTEXT.md",
        context.id
    )));
    let contents = std::fs::read_to_string(path).expect("context file");
    assert!(contents.contains("title = \"Fix Failing Tests Input\""));
    assert!(contents.contains("description = \"Explicit input for Fix Failing Tests.\""));
    assert!(contents.contains("created_at = 3456"));
    assert!(!contents.contains("source = \"clipboard\""));
    assert!(contents.contains("PRIVATE failing command output\nstack trace"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn opaque_ephemeral_context_id_allocator_skips_existing_artifact_ids() {
    let existing = ["75ac6db".to_string(), "89abcde".to_string()]
        .into_iter()
        .collect::<std::collections::HashSet<_>>();

    let id = super::first_available_opaque_id(
        &existing,
        [
            Ok("75ac6db".to_string()),
            Ok("89abcde".to_string()),
            Ok("c001234".to_string()),
        ],
        "ephemeral context",
    )
    .expect("opaque id");

    assert_eq!(id, "c001234");
}

#[test]
fn expired_ephemeral_artifacts_are_skipped_on_catalog_load() {
    let root = unique_temp_dir("ult-expired-context");
    super::ensure_ult_home(&root).expect("library");
    let mut input = input_prompt();
    input.id = Some("89abcde".to_string());
    input.title = "Expired Clip".to_string();
    input.artifact_type = Some(super::PromptArtifactType::Context);
    input.scope = Some(super::PromptScope::Ephemeral);
    input.created_at = Some(1);
    input.expires_at = Some(2);
    input.source = super::PromptArtifactSource::Clipboard;
    let expired = validate_prompt(input, None).expect("expired context");
    super::write_prompt_file_to_registry(&root, &expired).expect("write expired context");

    let mut registry = super::PromptRegistryBuilder::default();
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    super::load_local_prompt_files(
        &super::context_scope_dir(&root, super::PromptScope::Ephemeral),
        super::LocalArtifactClass::EphemeralContext,
        &mut registry,
        &mut errors,
        &mut warnings,
    );

    assert!(errors.is_empty(), "{errors:?}");
    assert!(warnings.is_empty(), "{warnings:?}");
    assert!(registry.entries().is_empty());

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn cleanup_removes_expired_ephemeral_artifact_files() {
    let root = unique_temp_dir("ult-clean-expired");
    super::ensure_ult_home(&root).expect("library");

    let mut prompt_input = input_prompt();
    prompt_input.id = Some("75ac6db".to_string());
    prompt_input.title = "Expired Scratch".to_string();
    prompt_input.scope = Some(super::PromptScope::Ephemeral);
    prompt_input.created_at = Some(1);
    prompt_input.expires_at = Some(2);
    prompt_input.source = super::PromptArtifactSource::Scratch;
    let prompt = validate_prompt(prompt_input, None).expect("expired prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write expired prompt");

    let mut context_input = input_prompt();
    context_input.id = Some("89abcde".to_string());
    context_input.title = "Expired Clip".to_string();
    context_input.artifact_type = Some(super::PromptArtifactType::Context);
    context_input.scope = Some(super::PromptScope::Ephemeral);
    context_input.created_at = Some(1);
    context_input.expires_at = Some(2);
    context_input.source = super::PromptArtifactSource::Clipboard;
    let context = validate_prompt(context_input, None).expect("expired context");
    super::write_prompt_file_to_registry(&root, &context).expect("write expired context");

    let removed = super::cleanup_expired_ephemeral_artifacts(&root, 3).expect("cleanup");
    assert_eq!(removed, 2);
    assert!(!super::prompt_file_path(&root, &prompt, "md").exists());
    assert!(!super::prompt_file_path(&root, &context, "md").exists());

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn package_delete_removes_the_directory() {
    let root = unique_temp_dir("ult-package-delete");
    super::ensure_ult_home(&root).expect("library");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");
    let package_file = super::prompt_file_path(&root, &prompt, "md");
    let package_dir = package_file.parent().expect("package dir").to_path_buf();
    std::fs::write(package_dir.join("notes.txt"), "sidecar").expect("sidecar");

    super::remove_artifact_package_source(&package_file).expect("remove package");

    assert!(!package_file.exists());
    assert!(!package_dir.exists());

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn package_delete_removes_prompt_context_and_skill_directories() {
    let root = unique_temp_dir("ult-package-delete-all");
    super::ensure_ult_home(&root).expect("library");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");

    let mut context_input = input_prompt();
    context_input.id = Some("repo-policy".to_string());
    context_input.title = "Repo Policy".to_string();
    context_input.artifact_type = Some(super::PromptArtifactType::Context);
    let context = validate_prompt(context_input, None).expect("context");
    super::write_prompt_file_to_registry(&root, &context).expect("write context");

    let skill_dir = super::persistent_skills_dir(&root).join("diagnose");
    std::fs::create_dir_all(&skill_dir).expect("skill dir");
    let skill_path = skill_dir.join(super::SKILL_PACKAGE_FILE);
    std::fs::write(
        &skill_path,
        "---\nname: diagnose\ndescription: Debug failures.\n---\n\nInspect logs.",
    )
    .expect("skill");

    for package_file in [
        super::prompt_file_path(&root, &prompt, "md"),
        super::prompt_file_path(&root, &context, "md"),
        skill_path,
    ] {
        let package_dir = package_file.parent().expect("package dir").to_path_buf();
        assert!(package_dir.is_dir());
        super::remove_artifact_package_source(&package_file).expect("remove package");
        assert!(!package_file.exists());
        assert!(!package_dir.exists());
    }

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn imported_artifacts_are_written_as_package_directories() {
    let root = unique_temp_dir("ult-package-import");
    super::ensure_ult_home(&root).expect("library");
    let mut input = input_prompt();
    input.id = Some("imported-context".to_string());
    input.title = "Imported Context".to_string();
    input.artifact_type = Some(super::PromptArtifactType::Context);
    let context = validate_prompt(input, None).expect("context");
    let contents = super::prompt_file_to_toml(&context).expect("import toml");
    let parsed = super::parse_import_prompt_contents(&contents).expect("parse import");

    for prompt in parsed {
        super::write_prompt_file_to_registry(&root, &prompt).expect("write import");
    }

    assert!(
        super::context_package_dir(&root, super::PromptScope::Persistent, "imported-context")
            .join(super::CONTEXT_PACKAGE_FILE)
            .is_file()
    );

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn export_writes_a_package_directory_with_the_canonical_file() {
    let root = unique_temp_dir("ult-package-export");
    super::ensure_ult_home(&root).expect("library");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");
    let registry = super::load_intervention_library_from_home(&root);

    let export = super::export_intervention_artifacts_from_registry(
        &root,
        registry,
        vec!["scope-lock".to_string()],
    )
    .expect("export");
    let export_path = std::path::PathBuf::from(export.file_path);

    assert!(export_path.ends_with("exports/scope-lock/PROMPT.md"));
    assert!(export_path.is_file());
    assert!(export_path.parent().expect("export package dir").is_dir());
    assert!(std::fs::read_to_string(&export_path)
        .expect("export contents")
        .contains("Stay scoped."));

    let _ = std::fs::remove_dir_all(root);
}
