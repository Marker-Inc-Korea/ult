use super::*;

#[test]
fn loads_only_artifacts_matching_their_library_class() {
    let root = unique_temp_dir("ult-class-load");
    super::ensure_ult_home(&root).expect("library");
    let mut persistent = validate_prompt(input_prompt(), None).expect("prompt");
    persistent.pinned = true;
    super::write_prompt_file_to_registry(&root, &persistent).expect("write persistent");

    let mut ephemeral_input = input_prompt();
    ephemeral_input.id = Some("75ac6db".to_string());
    ephemeral_input.title = "Scratch Note".to_string();
    ephemeral_input.scope = Some(super::PromptScope::Ephemeral);
    let ephemeral = validate_prompt(ephemeral_input, None).expect("ephemeral");
    super::write_prompt_file_to_registry(&root, &ephemeral).expect("write ephemeral");

    let mut context_input = input_prompt();
    context_input.id = Some("repo-policy".to_string());
    context_input.title = "Repo Policy".to_string();
    context_input.artifact_type = Some(super::PromptArtifactType::Context);
    let context = validate_prompt(context_input, None).expect("context");
    super::write_prompt_file_to_registry(&root, &context).expect("write context");

    let mut registry = super::PromptRegistryBuilder::default();
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    super::load_local_prompt_files(
        &super::prompt_scope_dir(&root, super::PromptScope::Persistent),
        super::LocalArtifactClass::PersistentPrompt,
        &mut registry,
        &mut errors,
        &mut warnings,
    );
    super::load_local_prompt_files(
        &super::prompt_scope_dir(&root, super::PromptScope::Ephemeral),
        super::LocalArtifactClass::EphemeralPrompt,
        &mut registry,
        &mut errors,
        &mut warnings,
    );
    super::load_local_prompt_files(
        &super::context_scope_dir(&root, super::PromptScope::Persistent),
        super::LocalArtifactClass::PersistentContext,
        &mut registry,
        &mut errors,
        &mut warnings,
    );

    let entries = registry.entries();
    assert!(errors.is_empty(), "{errors:?}");
    assert!(warnings.is_empty(), "{warnings:?}");
    assert_eq!(
        entries
            .iter()
            .map(|entry| entry.prompt.id.as_str())
            .collect::<Vec<_>>(),
        vec!["scope-lock", "75ac6db", "repo-policy"],
    );

    let wrong_path =
        super::prompt_scope_dir(&root, super::PromptScope::Persistent).join("wrong-context.md");
    super::write_prompt_file_to_path(&wrong_path, &context).expect("write wrong context");
    super::load_local_prompt_files(
        &super::prompt_scope_dir(&root, super::PromptScope::Persistent),
        super::LocalArtifactClass::PersistentPrompt,
        &mut super::PromptRegistryBuilder::default(),
        &mut errors,
        &mut warnings,
    );
    assert!(!errors
        .iter()
        .any(|error| error.contains("wrong Personal Library folder")));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn loose_artifact_files_inside_package_parent_dirs_are_ignored() {
    let root = unique_temp_dir("ult-loose-artifacts");
    super::ensure_ult_home(&root).expect("library");
    write_test_markdown_artifact(
        &super::prompt_scope_dir(&root, super::PromptScope::Persistent).join("loose.md"),
        "Loose Prompt",
        "This should not load.",
    );
    std::fs::write(
        super::context_scope_dir(&root, super::PromptScope::Persistent).join("loose.toml"),
        "id = \"loose-context\"\ntitle = \"Loose Context\"\ndescription = \"Loose\"\nprompt = \"Nope\"",
    )
    .expect("loose toml");

    let result = super::load_intervention_library_from_home(&root);
    let ids = result
        .artifacts
        .iter()
        .map(|prompt| prompt.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.warnings.is_empty(), "{:?}", result.warnings);
    assert!(!ids.contains("loose"));
    assert!(!ids.contains("loose-context"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn package_source_paths_point_to_canonical_package_files() {
    let root = unique_temp_dir("ult-source-paths");
    super::ensure_ult_home(&root).expect("library");
    let mut prompt_input = input_prompt();
    prompt_input.id = Some("review-change".to_string());
    prompt_input.title = "Review Change".to_string();
    let prompt = validate_prompt(prompt_input, None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");

    let mut context_input = input_prompt();
    context_input.id = Some("repo-policy".to_string());
    context_input.title = "Repo Policy".to_string();
    context_input.artifact_type = Some(super::PromptArtifactType::Context);
    let context = validate_prompt(context_input, None).expect("context");
    super::write_prompt_file_to_registry(&root, &context).expect("write context");

    let prompt_path = super::prompt_file_path(&root, &prompt, "md")
        .to_string_lossy()
        .to_string();
    let context_path = super::prompt_file_path(&root, &context, "md")
        .to_string_lossy()
        .to_string();
    let skill_dir = super::persistent_skills_dir(&root).join("diagnose");
    std::fs::create_dir_all(&skill_dir).expect("skill dir");
    let skill_path = skill_dir.join(super::SKILL_PACKAGE_FILE);
    std::fs::write(
        &skill_path,
        "---\nname: diagnose\ndescription: Debug failures.\n---\n\nInspect logs.",
    )
    .expect("skill");
    let skill_path_string = skill_path.to_string_lossy().to_string();
    let result = super::load_intervention_library_from_home(&root);

    assert!(result.entries.iter().any(|entry| {
        entry.prompt.id == "review-change"
            && entry.source_path.as_deref() == Some(prompt_path.as_str())
    }));
    assert!(result.entries.iter().any(|entry| {
        entry.prompt.id == "repo-policy"
            && entry.source_path.as_deref() == Some(context_path.as_str())
    }));
    assert!(result.entries.iter().any(|entry| {
        entry.prompt.id == "diagnose"
            && entry.prompt.artifact_type == super::PromptArtifactType::Skill
            && entry.source_path.as_deref() == Some(skill_path_string.as_str())
    }));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn serializes_artifact_file_entry() {
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    let entry = super::prompt_to_toml_entry(&prompt).expect("toml");
    assert!(!entry.contains("[[prompts]]"));
    assert!(entry.contains("id = \"scope-lock\""));
    assert!(entry.contains("artifact_type = \"prompt\""));
    assert!(entry.contains("scope = \"persistent\""));
    assert!(!entry.contains("delivery = "));
    assert!(entry.contains("prompt = \"Stay scoped.\""));
}

#[test]
fn serializes_single_prompt_file_entry() {
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    let entry = super::prompt_file_to_toml(&prompt).expect("toml");
    assert!(!entry.contains("[[prompts]]"));
    assert!(entry.contains("id = \"scope-lock\""));
    assert!(entry.contains("artifact_type = \"prompt\""));
    assert!(!entry.contains("delivery = "));
    assert!(entry.contains("prompt = \"Stay scoped.\""));
}

#[test]
fn serializes_library_markdown_without_derived_identity_fields() {
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    let entry = super::prompt_file_to_markdown(&prompt).expect("markdown");

    assert!(entry.starts_with("---\n"));
    assert!(!entry.contains("id = "));
    assert!(!entry.contains("artifact_type = "));
    assert!(!entry.contains("scope = "));
    assert!(!entry.contains("delivery = "));
    assert!(entry.contains("title = \"Scope Lock\""));
    assert!(entry.contains("Stay scoped."));
}

#[test]
fn parses_markdown_context_prompt_file() {
    let root = unique_temp_dir("ult-context-package");
    let path = root.join("repo-policy").join(super::CONTEXT_PACKAGE_FILE);
    std::fs::create_dir_all(path.parent().expect("context package dir")).expect("package");
    std::fs::write(
        &path,
        concat!(
            "---\n",
            "id = \"wrong-id\"\n",
            "title = \"Repo Policy\"\n",
            "artifact_type = \"prompt\"\n",
            "scope = \"ephemeral\"\n",
            "description = \"Repository operating policy.\"\n",
            "---\n\n",
            "Do not read terminal output by default.\n",
        ),
    )
    .expect("write");

    let prompt = super::load_local_prompt_file(&path, super::LocalArtifactClass::PersistentContext)
        .expect("context");
    assert_eq!(prompt.id, "repo-policy");
    assert_eq!(prompt.artifact_type, super::PromptArtifactType::Context);
    assert_eq!(prompt.scope, super::PromptScope::Persistent);
    assert!(prompt.prompt.contains("Do not read terminal output"));

    let _ = std::fs::remove_dir_all(root);
}
