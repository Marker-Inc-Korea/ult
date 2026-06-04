use super::*;

#[test]
fn catalog_load_ignores_files_outside_personal_library() {
    let root = unique_temp_dir("ult-ignore-old-paths");
    let old_root_file = root.join("prompts").join("persistent").join("old-root.md");
    let old_workspace_file = root
        .join("workspaces")
        .join("personal")
        .join("prompts")
        .join("persistent")
        .join("old-workspace.md");
    write_test_markdown_artifact(&old_root_file, "Old Root", "Old root body.");
    write_test_markdown_artifact(&old_workspace_file, "Old Workspace", "Old workspace body.");

    let result = super::load_intervention_library_from_home(&root);
    let ids = result
        .artifacts
        .iter()
        .map(|prompt| prompt.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.warnings.is_empty(), "{:?}", result.warnings);
    assert!(!ids.contains("old-root"));
    assert!(!ids.contains("old-workspace"));
    assert!(
        super::prompt_scope_dir(&root, super::PromptScope::Persistent)
            .join("scope-lock")
            .join(super::PROMPT_PACKAGE_FILE)
            .is_file(),
        "fresh current Personal Library should still bootstrap"
    );
    assert!(old_root_file.is_file());
    assert!(old_workspace_file.is_file());

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn old_type_first_personal_library_paths_are_ignored() {
    let root = unique_temp_dir("ult-ignore-type-first-library");
    let old_prompt_file = super::personal_library_dir(&root)
        .join("prompts")
        .join("persistent")
        .join("old-prompt")
        .join(super::PROMPT_PACKAGE_FILE);
    let old_context_file = super::personal_library_dir(&root)
        .join("contexts")
        .join("persistent")
        .join("old-context")
        .join(super::CONTEXT_PACKAGE_FILE);
    let old_skill_file = super::personal_library_dir(&root)
        .join("skills")
        .join("persistent")
        .join("old-skill")
        .join(super::SKILL_PACKAGE_FILE);
    write_test_markdown_artifact(
        &old_prompt_file,
        "Old Prompt",
        "Old type-first prompt body.",
    );
    write_test_markdown_artifact(
        &old_context_file,
        "Old Context",
        "Old type-first context body.",
    );
    std::fs::create_dir_all(old_skill_file.parent().expect("old skill parent"))
        .expect("old skill parent");
    std::fs::write(
        &old_skill_file,
        "---\nname: Old Skill\ndescription: Old type-first skill.\n---\n\nDo old work.",
    )
    .expect("old skill");

    let result = super::load_intervention_library_from_home(&root);
    let ids = result
        .artifacts
        .iter()
        .map(|prompt| prompt.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result.warnings.is_empty(), "{:?}", result.warnings);
    assert!(!ids.contains("old-prompt"));
    assert!(!ids.contains("old-context"));
    assert!(!ids.contains("old-skill"));
    assert!(old_prompt_file.is_file());
    assert!(old_context_file.is_file());
    assert!(old_skill_file.is_file());
    assert!(!super::personal_library_dir(&root)
        .join("ephemeral")
        .join("skills")
        .exists());

    let _ = std::fs::remove_dir_all(root);
}
