use super::*;

#[test]
fn github_import_preview_reads_only_recognized_package_paths() {
    let root = unique_temp_dir("ult-github-preview");
    super::ensure_ult_home(&root).expect("library");
    let existing = validate_prompt(input_prompt(), None).expect("existing");
    super::write_prompt_file_to_registry(&root, &existing).expect("write existing prompt");

    let mut imported_prompt = input_prompt();
    imported_prompt.id = Some("ignored-frontmatter-id".to_string());
    imported_prompt.title = "Imported Prompt".to_string();
    imported_prompt.prompt = "Do imported work.".to_string();
    let imported_prompt = validate_prompt(imported_prompt, None).expect("imported prompt");

    let mut context = input_prompt();
    context.id = Some("repo-context".to_string());
    context.title = "Repo Context".to_string();
    context.artifact_type = Some(super::PromptArtifactType::Context);
    context.prompt = "Repository context.".to_string();
    let context = validate_prompt(context, None).expect("context");

    let source = github_source();
    let files = vec![
        super::GitHubLibraryImportFile {
            path: "persistent/prompts/scope-lock/PROMPT.md".to_string(),
            contents: Some(super::prompt_file_to_markdown(&imported_prompt).expect("prompt md")),
        },
        super::GitHubLibraryImportFile {
            path: "contexts/repo-context/CONTEXT.md".to_string(),
            contents: Some(super::prompt_file_to_markdown(&context).expect("context md")),
        },
        super::GitHubLibraryImportFile {
            path: "persistent/skills/code-review/SKILL.md".to_string(),
            contents: Some(
                "---\nname: Code Review\ndescription: Review patches.\n---\n\nReview code."
                    .to_string(),
            ),
        },
        super::GitHubLibraryImportFile {
            path: "persistent/commands/review-import/COMMAND.md".to_string(),
            contents: Some(
                "---\ntitle = \"Review Import\"\nprompt = \"scope-lock\"\ncontexts = [\"repo-context\"]\n---\n"
                    .to_string(),
            ),
        },
        super::GitHubLibraryImportFile {
            path: "persistent/prompts/loose/README.md".to_string(),
            contents: None,
        },
        super::GitHubLibraryImportFile {
            path: "docs/PROMPT.md".to_string(),
            contents: None,
        },
        super::GitHubLibraryImportFile {
            path: "prompts/broken/PROMPT.md".to_string(),
            contents: Some("missing front matter".to_string()),
        },
    ];

    let preview = super::preview_github_library_import_from_files(&root, source, files, Vec::new());

    assert_eq!(preview.entries.len(), 4);
    let by_id = preview
        .entries
        .iter()
        .map(|entry| (entry.artifact_id.as_str(), entry))
        .collect::<std::collections::HashMap<_, _>>();
    assert_eq!(
        by_id["scope-lock"].action,
        super::GitHubLibraryImportAction::Overwrite
    );
    assert_eq!(
        by_id["repo-context"].action,
        super::GitHubLibraryImportAction::New
    );
    assert_eq!(
        by_id["code-review"].artifact_type,
        super::LibraryPackageType::Skill
    );
    assert_eq!(
        by_id["review-import"].artifact_type,
        super::LibraryPackageType::Command
    );
    assert_eq!(preview.ignored_files.len(), 1);
    assert_eq!(
        preview.ignored_files[0].path,
        "persistent/prompts/loose/README.md"
    );
    assert_eq!(preview.malformed_packages.len(), 1);
    assert!(preview.malformed_packages[0]
        .path
        .contains("broken/PROMPT.md"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn github_import_writes_selected_packages_to_persistent_library() {
    let root = unique_temp_dir("ult-github-import");
    super::ensure_ult_home(&root).expect("library");

    let mut prompt_input = input_prompt();
    prompt_input.id = Some("imported".to_string());
    prompt_input.title = "Imported".to_string();
    prompt_input.prompt = "Use this imported prompt.".to_string();
    let prompt = validate_prompt(prompt_input, None).expect("prompt");

    let mut context_input = input_prompt();
    context_input.id = Some("imported-context".to_string());
    context_input.title = "Imported Context".to_string();
    context_input.artifact_type = Some(super::PromptArtifactType::Context);
    context_input.prompt = "Use this imported context.".to_string();
    let context = validate_prompt(context_input, None).expect("context");

    let files = vec![
        super::GitHubLibraryImportFile {
            path: "persistent/prompts/imported/PROMPT.md".to_string(),
            contents: Some(super::prompt_file_to_markdown(&prompt).expect("prompt md")),
        },
        super::GitHubLibraryImportFile {
            path: "persistent/contexts/imported-context/CONTEXT.md".to_string(),
            contents: Some(super::prompt_file_to_markdown(&context).expect("context md")),
        },
        super::GitHubLibraryImportFile {
            path: "persistent/skills/review/SKILL.md".to_string(),
            contents: Some(
                "---\nname: Review\ndescription: Review code.\n---\n\nReview code.".to_string(),
            ),
        },
        super::GitHubLibraryImportFile {
            path: "persistent/commands/run-imported/COMMAND.md".to_string(),
            contents: Some(
                "---\ntitle = \"Run Imported\"\nprompt = \"imported\"\n---\n".to_string(),
            ),
        },
    ];

    let summary = super::import_github_library_pack_from_files(
        &root,
        github_source(),
        files,
        vec![
            "persistent/prompts/imported/PROMPT.md".to_string(),
            "persistent/skills/review/SKILL.md".to_string(),
            "persistent/commands/run-imported/COMMAND.md".to_string(),
        ],
        Vec::new(),
    )
    .expect("import");

    assert_eq!(summary.imported_count, 3);
    assert_eq!(summary.updated_count, 0);
    assert_eq!(summary.commit, "abcdef1234567890");
    assert!(
        super::prompt_package_dir(&root, super::PromptScope::Persistent, "imported")
            .join(super::PROMPT_PACKAGE_FILE)
            .is_file()
    );
    assert!(super::skill_package_dir(&root, "review")
        .join(super::SKILL_PACKAGE_FILE)
        .is_file());
    assert!(super::command_package_dir(&root, "run-imported")
        .join(super::COMMAND_PACKAGE_FILE)
        .is_file());
    assert!(
        !super::context_package_dir(&root, super::PromptScope::Persistent, "imported-context")
            .join(super::CONTEXT_PACKAGE_FILE)
            .exists()
    );

    let library = super::load_intervention_library_from_home(&root);
    let imported = library
        .entries
        .iter()
        .find(|entry| entry.prompt.id == "imported")
        .expect("imported prompt");
    assert!(imported.editable);
    let skill = library
        .entries
        .iter()
        .find(|entry| entry.prompt.id == "review")
        .expect("imported skill");
    assert!(skill.editable);
    assert_eq!(skill.prompt.artifact_type, super::PromptArtifactType::Skill);
    assert!(library
        .commands
        .iter()
        .any(|command| command.id == "run-imported"));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn github_import_ships_workflow_prompt_command_pairs() {
    let root = unique_temp_dir("ult-github-workflow-pack");
    super::ensure_ult_home(&root).expect("library");

    let workflow_prompt = super::parse_agent_workflow_packs_json(include_str!(
        "../../../../src/data/agent-workflow-packs.json"
    ))
    .expect("workflow packs")
    .into_iter()
    .find(|pack| pack.id == "workflow-review-current-change")
    .expect("review workflow");
    let prompt = validate_prompt(
        super::InputPrompt {
            id: Some(workflow_prompt.id.clone()),
            title: workflow_prompt.title.clone(),
            artifact_type: Some(super::PromptArtifactType::Prompt),
            scope: Some(super::PromptScope::Persistent),
            pinned: false,
            prompt: workflow_prompt.prompt.clone(),
            contexts: Vec::new(),
            description: workflow_prompt.description.clone(),
            shortcut: None,
            confirm: false,
            template_arguments: Vec::new(),
            created_at: None,
            expires_at: None,
            source: super::PromptArtifactSource::User,
        },
        None,
    )
    .expect("workflow prompt");

    let files = vec![
        super::GitHubLibraryImportFile {
            path: "persistent/prompts/workflow-review-current-change/PROMPT.md".to_string(),
            contents: Some(super::prompt_file_to_markdown(&prompt).expect("prompt md")),
        },
        super::GitHubLibraryImportFile {
            path: "persistent/commands/workflow-review-current-change/COMMAND.md".to_string(),
            contents: Some(
                "---\ntitle = \"Review Current Change\"\ndescription = \"Editable workflow command.\"\nprompt = \"workflow-review-current-change\"\nkeywords = [\"review\", \"workflow\"]\nactions = [\"prepare\"]\nhome = false\n---\n"
                    .to_string(),
            ),
        },
    ];

    let preview = super::preview_github_library_import_from_files(
        &root,
        github_source(),
        files.clone(),
        Vec::new(),
    );
    assert_eq!(preview.entries.len(), 2);
    assert!(preview.entries.iter().any(|entry| {
        entry.artifact_id == "workflow-review-current-change"
            && entry.artifact_type == super::LibraryPackageType::Prompt
    }));
    assert!(preview.entries.iter().any(|entry| {
        entry.artifact_id == "workflow-review-current-change"
            && entry.artifact_type == super::LibraryPackageType::Command
    }));

    let summary = super::import_github_library_pack_from_files(
        &root,
        github_source(),
        files,
        vec![
            "persistent/prompts/workflow-review-current-change/PROMPT.md".to_string(),
            "persistent/commands/workflow-review-current-change/COMMAND.md".to_string(),
        ],
        Vec::new(),
    )
    .expect("import workflow pack");
    assert_eq!(summary.imported_count, 2);

    let library = super::load_intervention_library_from_home(&root);
    assert!(library
        .entries
        .iter()
        .any(|entry| entry.prompt.id == "workflow-review-current-change" && entry.editable));
    assert!(library
        .commands
        .iter()
        .any(|command| command.id == "workflow-review-current-change"
            && command.prompt_id == "workflow-review-current-change"));

    let _ = std::fs::remove_dir_all(root);
}
