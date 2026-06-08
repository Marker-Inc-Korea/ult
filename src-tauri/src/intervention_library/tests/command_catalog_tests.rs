use super::*;

#[test]
fn loads_launcher_command_packages_from_personal_library() {
    let root = unique_temp_dir("ult-command-catalog");
    super::ensure_ult_home(&root).expect("library");

    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");

    let mut context_input = input_prompt();
    context_input.id = Some("repo-policy".to_string());
    context_input.title = "Repo Policy".to_string();
    context_input.artifact_type = Some(super::PromptArtifactType::Context);
    context_input.prompt = "Follow the repository policy.".to_string();
    let context = validate_prompt(context_input, None).expect("context");
    super::write_prompt_file_to_registry(&root, &context).expect("write context");

    let command_path =
        super::command_package_dir(&root, "review-repo").join(super::COMMAND_PACKAGE_FILE);
    std::fs::create_dir_all(command_path.parent().expect("command dir")).expect("command dir");
    std::fs::write(
        &command_path,
        r#"---
title = "Review Repo"
description = "Review the current change with repo policy."
prompt = "scope-lock"
contexts = ["repo-policy", "repo-policy"]
keywords = ["review", "diff"]
aliases = ["review current"]
actions = ["prepare"]
home = true

[variables]
branch = "main"
policy = "@repo-policy"
---

Local command notes are not searched by Launcher.
"#,
    )
    .expect("write command");

    let result = super::load_intervention_library_from_home(&root);

    assert!(result.errors.is_empty(), "{:?}", result.errors);
    assert_eq!(result.commands.len(), 1);
    let command = &result.commands[0];
    assert_eq!(command.id, "review-repo");
    assert_eq!(command.title, "Review Repo");
    assert_eq!(command.prompt_id, "scope-lock");
    assert_eq!(command.contexts, vec!["repo-policy"]);
    assert_eq!(
        command.variable_values.get("policy").map(String::as_str),
        Some("@repo-policy")
    );
    assert_eq!(command.keywords, vec!["review", "diff"]);
    assert_eq!(command.aliases, vec!["review current"]);
    assert_eq!(command.actions, vec![super::LauncherCommandAction::Prepare]);
    assert!(command.home);
    let expected_path = command_path.display().to_string();
    assert_eq!(command.source_path.as_deref(), Some(expected_path.as_str()));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn malformed_launcher_command_package_does_not_block_artifacts() {
    let root = unique_temp_dir("ult-command-malformed");
    super::ensure_ult_home(&root).expect("library");
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    super::write_prompt_file_to_registry(&root, &prompt).expect("write prompt");

    let command_path = super::persistent_commands_dir(&root)
        .join("broken")
        .join(super::COMMAND_PACKAGE_FILE);
    std::fs::create_dir_all(command_path.parent().expect("command dir")).expect("command dir");
    std::fs::write(
        &command_path,
        "---\ntitle = \"Broken\"\nprompt = \"missing-prompt\"\n---\n",
    )
    .expect("write command");

    let result = super::load_intervention_library_from_home(&root);

    assert!(result
        .artifacts
        .iter()
        .any(|artifact| artifact.id == "scope-lock"));
    assert!(result.commands.is_empty());
    assert!(result
        .errors
        .iter()
        .any(|error| error.contains("missing prompt `missing-prompt`")));

    let _ = std::fs::remove_dir_all(root);
}

#[test]
fn command_package_prompt_references_stay_id_based_not_visible_handles() {
    for prompt_reference in ["#scope-lock", "/scope-lock"] {
        let contents = format!(
            r#"---
title = "Bad Command"
prompt = "{prompt_reference}"
---
"#,
        );
        let error = super::load_command_package_from_contents(
            "bad-command",
            "persistent/commands/bad-command/COMMAND.md",
            &contents,
        )
        .expect_err("visible prompt handles are not command metadata ids");

        assert!(error.contains("prompt reference"), "{error}");
        assert!(error.contains(prompt_reference), "{error}");
    }
}

#[test]
fn command_package_contract_stores_prepare_inputs_without_markdown_body() {
    let command = super::load_command_package_from_contents(
        "review-repo",
        "persistent/commands/review-repo/COMMAND.md",
        r#"---
title = "Review Repo"
description = "Review the current change."
prompt = "scope-lock"
contexts = ["repo-policy"]
keywords = ["review"]
aliases = ["rr"]
home = true

[variables]
branch = "main"
---

Local command implementation notes are not part of the command contract.
"#,
    )
    .expect("command package");

    assert_eq!(command.id, "review-repo");
    assert_eq!(command.title, "Review Repo");
    assert_eq!(command.prompt_id, "scope-lock");
    assert_eq!(command.contexts, vec!["repo-policy"]);
    assert_eq!(
        command.variable_values.get("branch").map(String::as_str),
        Some("main")
    );
    assert_eq!(command.actions, vec![super::LauncherCommandAction::Prepare]);
    assert!(command.home);

    let serialized = serde_json::to_string(&command).expect("serialized command");
    assert!(!serialized.contains("implementation notes"));
    assert!(!serialized.contains("Markdown"));
}

#[test]
fn command_package_rejects_unsupported_action_types() {
    let error = super::load_command_package_from_contents(
        "bad-command",
        "persistent/commands/bad-command/COMMAND.md",
        r#"---
title = "Bad Command"
prompt = "scope-lock"
actions = ["deliver"]
---
"#,
    )
    .expect_err("unsupported actions must not deserialize");

    assert!(error.contains("invalid command front matter"), "{error}");
    assert!(error.contains("deliver"), "{error}");
}
