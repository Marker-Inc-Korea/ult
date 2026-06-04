use super::*;

#[test]
fn invalid_library_artifact_package_does_not_block_valid_artifacts() {
    let root = unique_temp_dir("ult-invalid-artifact");
    super::ensure_ult_home(&root).expect("library");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write valid prompt");
    let broken_path = super::prompt_scope_dir(&root, super::PromptScope::Persistent)
        .join("broken")
        .join(super::PROMPT_PACKAGE_FILE);
    std::fs::create_dir_all(broken_path.parent().expect("broken package dir"))
        .expect("create broken package dir");
    std::fs::write(&broken_path, "missing front matter").expect("write invalid prompt");

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

    let entries = registry.entries();
    assert_eq!(
        entries
            .iter()
            .map(|entry| entry.prompt.id.as_str())
            .collect::<Vec<_>>(),
        vec!["scope-lock"],
    );
    assert_eq!(errors.len(), 1);
    assert!(errors[0].contains("broken/PROMPT.md"));
    assert!(warnings.is_empty(), "{warnings:?}");

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn catalog_load_reports_malformed_file_path_while_loading_valid_artifacts() {
    let root = unique_temp_dir("ult-malformed-path");
    super::ensure_ult_home(&root).expect("library");

    let mut valid_input = input_prompt();
    valid_input.id = Some("deploy-check".to_string());
    valid_input.title = "Deploy Check".to_string();
    let valid = validate_prompt(valid_input, None).expect("valid prompt");
    let valid_path = super::prompt_file_path(&root, &valid, "md");
    super::write_prompt_file_to_registry(&root, &valid).expect("write valid");

    let broken_path = super::prompt_scope_dir(&root, super::PromptScope::Persistent)
        .join("broken")
        .join(super::PROMPT_PACKAGE_FILE);
    if let Some(parent) = broken_path.parent() {
        std::fs::create_dir_all(parent).expect("broken package dir");
    }
    std::fs::write(
        &broken_path,
        "---\ntitle = \ndescription = \"bad\"\n---\n\nBroken body",
    )
    .expect("broken prompt");

    let result = super::load_intervention_library_from_home(&root);
    let valid_path_string = valid_path.to_string_lossy().to_string();
    assert_eq!(result.errors.len(), 1, "{:?}", result.errors);
    assert!(
        result.errors[0].starts_with(&format!(
            "{}: invalid markdown front matter:",
            broken_path.display()
        )),
        "{}",
        result.errors[0]
    );
    assert!(result
        .entries
        .iter()
        .any(|entry| entry.prompt.id == "deploy-check"
            && entry.editable
            && entry.source_path.as_deref() == Some(valid_path_string.as_str())));
    assert!(!result
        .entries
        .iter()
        .any(|entry| entry.prompt.id == "broken"));

    let _ = std::fs::remove_dir_all(root);
}
