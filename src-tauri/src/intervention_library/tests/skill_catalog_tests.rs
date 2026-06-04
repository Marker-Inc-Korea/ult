use super::*;

#[test]
fn loads_skill_packages_from_personal_library() {
    let root = unique_temp_dir("ult-skill-library");
    super::ensure_ult_home(&root).expect("library");
    let skill_dir = super::persistent_skills_dir(&root).join("diagnose");
    std::fs::create_dir_all(&skill_dir).expect("skill dir");
    let skill_path = skill_dir.join("SKILL.md");
    std::fs::write(
        &skill_path,
        "---\nname: diagnose\ndescription: Debug failures with a repeatable workflow.\n---\n\nUse logs, tests, and narrow hypotheses.",
    )
    .expect("skill");

    let result = super::load_intervention_library_from_home(&root);

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    let skill = result
        .artifacts
        .iter()
        .find(|artifact| artifact.id == "diagnose")
        .expect("skill artifact");
    assert_eq!(skill.artifact_type, super::PromptArtifactType::Skill);
    assert_eq!(skill.scope, super::PromptScope::Persistent);
    assert_eq!(skill.title, "diagnose");
    assert_eq!(
        skill.description,
        "Debug failures with a repeatable workflow."
    );
    assert!(skill.prompt.contains("Use logs, tests"));

    let entry = result
        .entries
        .iter()
        .find(|entry| entry.prompt.id == "diagnose")
        .expect("skill entry");
    assert!(entry.editable);
    assert_eq!(
        entry.source_path.as_deref(),
        Some(skill_path.to_str().unwrap())
    );
    assert!(result
        .editable_artifact_ids
        .iter()
        .any(|id| id == "diagnose"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn ignores_loose_files_in_skills_directory() {
    let root = unique_temp_dir("ult-skill-loose-file");
    super::ensure_ult_home(&root).expect("library");
    write_test_markdown_artifact(
        &super::persistent_skills_dir(&root).join("accidental.md"),
        "Accidental Skill File",
        "This must not be loaded as a prompt or skill.",
    );

    let result = super::load_intervention_library_from_home(&root);
    let ids = result
        .artifacts
        .iter()
        .map(|artifact| artifact.id.as_str())
        .collect::<std::collections::HashSet<_>>();

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!ids.contains("accidental"));
    assert!(ids.contains("scope-lock"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn parses_simple_skill_metadata() {
    let metadata = super::parse_skill_metadata(
        "---\nname: diagnose\ndescription: Debug failures.\n---\n\nUse logs.",
        std::path::Path::new("/tmp/diagnose/SKILL.md"),
    );

    assert_eq!(metadata.name.as_deref(), Some("diagnose"));
    assert_eq!(metadata.description.as_deref(), Some("Debug failures."));
    assert!(metadata.warnings.is_empty(), "{:?}", metadata.warnings);
}

#[test]
fn parses_quoted_skill_metadata() {
    let metadata = super::parse_skill_metadata(
        "---\nname: \"diagnose: failures\"\ndescription: 'Debug: tests and logs'\n---\n\nUse logs.",
        std::path::Path::new("/tmp/diagnose/SKILL.md"),
    );

    assert_eq!(metadata.name.as_deref(), Some("diagnose: failures"));
    assert_eq!(
        metadata.description.as_deref(),
        Some("Debug: tests and logs")
    );
    assert!(metadata.warnings.is_empty(), "{:?}", metadata.warnings);
}

#[test]
fn parses_multiline_skill_metadata() {
    let metadata = super::parse_skill_metadata(
        "---\nname: diagnose\ndescription: |\n  Debug failing runs.\n  Use narrow hypotheses.\n---\n\nUse logs.",
        std::path::Path::new("/tmp/diagnose/SKILL.md"),
    );

    assert_eq!(metadata.name.as_deref(), Some("diagnose"));
    assert_eq!(
        metadata.description.as_deref(),
        Some("Debug failing runs.\nUse narrow hypotheses.")
    );
    assert!(metadata.warnings.is_empty(), "{:?}", metadata.warnings);
}

#[test]
fn warns_on_unsupported_skill_metadata_shapes_without_executing_anything() {
    let root = unique_temp_dir("ult-skill-warning");
    super::ensure_ult_home(&root).expect("library");
    let skill_dir = super::persistent_skills_dir(&root).join("diagnose");
    std::fs::create_dir_all(&skill_dir).expect("skill dir");
    let skill_path = skill_dir.join("SKILL.md");
    std::fs::write(
        &skill_path,
        "---\nname:\n  - diagnose\ndescription: 123\n---\n\nUse logs.",
    )
    .expect("skill");

    let result = super::load_intervention_library_from_home(&root);

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(result
        .warnings
        .iter()
        .any(|warning| warning.contains("`name` must be a string")));
    assert!(result
        .warnings
        .iter()
        .any(|warning| warning.contains("`description` must be a string")));
    let skill = result
        .artifacts
        .iter()
        .find(|artifact| artifact.id == "diagnose")
        .expect("skill artifact");
    assert_eq!(skill.title, "diagnose");
    assert_eq!(skill.description, "Agent workflow skill.");
    assert_eq!(
        skill.prompt,
        "---\nname:\n  - diagnose\ndescription: 123\n---\n\nUse logs."
    );

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn skill_loading_reads_skill_md_without_executing_instructions() {
    let root = unique_temp_dir("ult-skill-local-first");
    super::ensure_ult_home(&root).expect("library");
    let marker_path = root.join("executed");
    let skill_dir = super::persistent_skills_dir(&root).join("local-first");
    std::fs::create_dir_all(&skill_dir).expect("skill dir");
    std::fs::write(
        skill_dir.join("SKILL.md"),
        format!(
            "---\nname: local-first\ndescription: Safe load.\n---\n\ntouch {}\n",
            marker_path.display()
        ),
    )
    .expect("skill");

    let result = super::load_intervention_library_from_home(&root);

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert!(!marker_path.exists());
    let skill = result
        .artifacts
        .iter()
        .find(|artifact| artifact.id == "local-first")
        .expect("skill artifact");
    assert!(skill.prompt.contains("touch "));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn writes_skill_packages_with_standard_skill_metadata() {
    let root = unique_temp_dir("ult-skill-write");
    super::ensure_ult_home(&root).expect("library");
    let mut skill_input = input_prompt();
    skill_input.id = Some("diagnose".to_string());
    skill_input.title = "Diagnose".to_string();
    skill_input.description = "Debug failures with a repeatable workflow.".to_string();
    skill_input.artifact_type = Some(super::PromptArtifactType::Skill);
    skill_input.prompt = "Inspect logs and run focused tests.".to_string();
    let skill = validate_prompt(skill_input, None).expect("skill");

    super::write_prompt_file_to_registry(&root, &skill).expect("write skill");

    let skill_path = super::skill_package_dir(&root, "diagnose").join(super::SKILL_PACKAGE_FILE);
    let contents = std::fs::read_to_string(&skill_path).expect("skill contents");
    assert!(contents.starts_with("---\nname: Diagnose\ndescription: Debug failures"));
    assert!(contents.contains("Inspect logs and run focused tests."));

    let library = super::load_intervention_library_from_home(&root);
    let entry = library
        .entries
        .iter()
        .find(|entry| entry.prompt.id == "diagnose")
        .expect("skill entry");
    assert!(entry.editable);
    assert_eq!(entry.prompt.title, "Diagnose");
    assert_eq!(
        entry.prompt.description,
        "Debug failures with a repeatable workflow."
    );

    let _ = std::fs::remove_dir_all(root);
}
