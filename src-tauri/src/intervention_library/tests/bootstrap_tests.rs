use super::*;

#[test]
fn bootstraps_starter_prompts_into_empty_personal_library() {
    let root = unique_temp_dir("ult-bootstrap");
    super::ensure_ult_home(&root).expect("library");
    super::bootstrap_personal_library(&root).expect("bootstrap");

    assert!(super::personal_library_readme_path(&root).is_file());
    assert!(
        super::prompt_scope_dir(&root, super::PromptScope::Persistent)
            .join("scope-lock")
            .join(super::PROMPT_PACKAGE_FILE)
            .is_file()
    );
    assert!(
        super::prompt_scope_dir(&root, super::PromptScope::Persistent)
            .join("qa")
            .join(super::PROMPT_PACKAGE_FILE)
            .is_file()
    );
    assert!(
        super::prompt_scope_dir(&root, super::PromptScope::Persistent)
            .join("workflow-fix-failing-tests")
            .join(super::PROMPT_PACKAGE_FILE)
            .is_file()
    );
    assert!(
        super::command_package_dir(&root, "workflow-fix-failing-tests")
            .join(super::COMMAND_PACKAGE_FILE)
            .is_file()
    );
    assert!(!root.join("personal-library").join("scratch").exists());

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
    assert!(errors.is_empty(), "{errors:?}");
    assert!(warnings.is_empty(), "{warnings:?}");
    assert!(registry
        .entries()
        .iter()
        .any(|entry| entry.prompt.id == "scope-lock" && entry.editable));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn bootstraps_editable_workflow_prompt_command_pairs() {
    let root = unique_temp_dir("ult-workflow-bootstrap");
    let result = super::load_intervention_library_from_home(&root);

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.warnings.is_empty(), "{:?}", result.warnings);

    let packs = super::parse_agent_workflow_packs_json(include_str!(
        "../../../../src/data/agent-workflow-packs.json"
    ))
    .expect("workflow packs");
    assert_eq!(packs.len(), 6);

    for pack in packs {
        let prompt_path = super::prompt_scope_dir(&root, super::PromptScope::Persistent)
            .join(&pack.id)
            .join(super::PROMPT_PACKAGE_FILE);
        let command_path =
            super::command_package_dir(&root, &pack.id).join(super::COMMAND_PACKAGE_FILE);
        assert!(
            prompt_path.is_file(),
            "{} was not bootstrapped",
            prompt_path.display()
        );
        assert!(
            command_path.is_file(),
            "{} was not bootstrapped",
            command_path.display()
        );

        let entry = result
            .entries
            .iter()
            .find(|entry| entry.prompt.id == pack.id)
            .unwrap_or_else(|| panic!("missing workflow prompt {}", pack.id));
        let prompt_path_string = prompt_path.to_string_lossy().to_string();
        assert!(entry.editable);
        assert_eq!(entry.source, super::PromptRegistrySource::LocalFile);
        assert_eq!(
            entry.source_path.as_deref(),
            Some(prompt_path_string.as_str())
        );

        let command = result
            .commands
            .iter()
            .find(|command| command.id == pack.id)
            .unwrap_or_else(|| panic!("missing workflow command {}", pack.id));
        let command_path_string = command_path.to_string_lossy().to_string();
        assert_eq!(command.prompt_id, pack.id);
        assert_eq!(command.title, pack.title);
        assert_eq!(
            command.source_path.as_deref(),
            Some(command_path_string.as_str())
        );
        assert_eq!(command.contexts, Vec::<String>::new());
        assert!(command.variable_values.is_empty());
        assert_eq!(command.actions, vec![super::LauncherCommandAction::Prepare]);
        assert!(!command.home);
    }

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn fresh_catalog_load_bootstraps_editable_starter_prompts_in_personal_library() {
    let root = unique_temp_dir("ult-fresh-load");
    let result = super::load_intervention_library_from_home(&root);

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.warnings.is_empty(), "{:?}", result.warnings);
    assert_eq!(result.config_path, root.display().to_string());
    assert_eq!(
        result.registry_path,
        super::personal_library_dir(&root).display().to_string()
    );

    let bundled = super::parse_bundled_prompts_json(include_str!(
        "../../../../src/data/bundled-prompts.json"
    ))
    .expect("bundled");
    assert!(!bundled.is_empty());
    for prompt in bundled {
        assert_eq!(prompt.artifact_type, super::PromptArtifactType::Prompt);
        assert_eq!(prompt.scope, super::PromptScope::Persistent);
        let path = super::prompt_file_path(&root, &prompt, "md");
        assert!(path.is_file(), "{} was not bootstrapped", path.display());

        let entry = result
            .entries
            .iter()
            .find(|entry| entry.prompt.id == prompt.id)
            .unwrap_or_else(|| panic!("missing bootstrapped entry {}", prompt.id));
        let path_string = path.to_string_lossy().to_string();
        assert!(entry.editable);
        assert_eq!(entry.source, super::PromptRegistrySource::LocalOverride);
        assert_eq!(entry.source_path.as_deref(), Some(path_string.as_str()));
    }

    assert!(super::personal_library_readme_path(&root).is_file());
    assert!(!root.join("workspaces").exists());

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn bootstrap_respects_existing_personal_library_marker() {
    let root = unique_temp_dir("ult-bootstrap-marker");
    super::ensure_ult_home(&root).expect("library");
    std::fs::write(super::personal_library_readme_path(&root), "custom library").expect("marker");

    super::bootstrap_personal_library(&root).expect("bootstrap");

    assert!(
        !super::prompt_scope_dir(&root, super::PromptScope::Persistent)
            .join("scope-lock")
            .join(super::PROMPT_PACKAGE_FILE)
            .exists()
    );

    let _ = std::fs::remove_dir_all(root);
}
