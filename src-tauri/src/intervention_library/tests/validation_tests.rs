use super::*;

#[test]
fn validates_prompt_definition() {
    let prompt = validate_prompt(input_prompt(), None).expect("prompt");
    assert_eq!(prompt.id, "scope-lock");
    assert_eq!(prompt.shortcut, None);
    assert!(!prompt.confirm);
}

#[test]
fn validates_pinned_persistent_prompts_only() {
    let mut prompt = input_prompt();
    prompt.pinned = true;
    assert!(validate_prompt(prompt, None).expect("prompt").pinned);

    let mut context = input_prompt();
    context.id = Some("repo-policy".to_string());
    context.artifact_type = Some(super::PromptArtifactType::Context);
    context.pinned = true;
    assert!(validate_prompt(context, None)
        .expect_err("pinned context")
        .contains("persistent prompt"));

    let mut ephemeral = input_prompt();
    ephemeral.scope = Some(super::PromptScope::Ephemeral);
    ephemeral.pinned = true;
    assert!(validate_prompt(ephemeral, None)
        .expect_err("pinned ephemeral")
        .contains("persistent prompt"));
}

#[test]
fn rejects_ephemeral_skills_until_skill_lifecycle_exists() {
    let mut skill = input_prompt();
    skill.id = Some("diagnose".to_string());
    skill.title = "Diagnose".to_string();
    skill.artifact_type = Some(super::PromptArtifactType::Skill);
    skill.scope = Some(super::PromptScope::Ephemeral);
    skill.prompt = "---\nname: Diagnose\n---\n\nUse logs.".to_string();

    assert!(validate_prompt(skill, None)
        .expect_err("ephemeral skill")
        .contains("persistent SKILL.md package"));
}

#[test]
fn validates_shortcut_and_confirm_fields() {
    let mut prompt = input_prompt();
    prompt.shortcut = Some("CmdOrCtrl+Shift+1".to_string());
    prompt.confirm = true;
    let prompt = validate_prompt(prompt, None).expect("prompt");
    assert!(prompt
        .shortcut
        .as_deref()
        .is_some_and(|shortcut| shortcut.contains("shift")));
    assert!(prompt.confirm);
}

#[test]
fn rejects_app_shortcut_collisions() {
    let mut prompt = input_prompt();
    prompt.shortcut = Some("Cmd+U".to_string());
    assert!(validate_prompt(prompt, None)
        .expect_err("shortcut collision")
        .contains("collides"));
}

#[test]
fn rejects_invalid_prompt_id() {
    let mut prompt = input_prompt();
    prompt.id = Some("bad id".to_string());
    assert!(validate_prompt(prompt, None)
        .expect_err("invalid id")
        .contains("must use letters"));
}

#[test]
fn ephemeral_artifacts_get_ttl_metadata() {
    let mut input = input_prompt();
    input.id = Some("75ac6db".to_string());
    input.title = "Clip 1".to_string();
    input.artifact_type = Some(super::PromptArtifactType::Context);
    input.scope = Some(super::PromptScope::Ephemeral);
    input.source = super::PromptArtifactSource::Clipboard;

    let context = validate_prompt(input, None).expect("ephemeral context");
    let created_at = context.created_at.expect("created_at");
    let expires_at = context.expires_at.expect("expires_at");

    assert_eq!(
        expires_at.saturating_sub(created_at),
        super::EPHEMERAL_ARTIFACT_TTL_MS
    );
    assert_eq!(context.source, super::PromptArtifactSource::Clipboard);
}

#[test]
fn derives_template_variables_from_prompt_text() {
    let variables = super::extract_template_variables(
        "Use {{scope}} and {{task}}. Ignore {literal} and {{task}}.",
    );
    assert_eq!(variables, vec!["scope", "task"]);
}

#[test]
fn rejects_empty_template_variable_names() {
    let mut prompt = input_prompt();
    prompt.prompt = "Use {{}} now.".to_string();
    assert!(validate_prompt(prompt, None)
        .expect_err("empty variable")
        .contains("invalid template"));
}

#[test]
fn records_duplicate_template_variable_diagnostics() {
    let mut prompt = input_prompt();
    prompt.prompt = "Use {{scope}}, then {{scope}} again.".to_string();
    let prompt = validate_prompt(prompt, None).expect("prompt");
    let entry = super::prompt_registry_entry(
        prompt,
        super::PromptRegistrySource::LocalFile,
        Some("scope-lock.toml".to_string()),
        true,
    );
    assert_eq!(entry.template_variables, vec!["scope"]);
    assert!(entry.diagnostics[0].contains("used more than once"));
}

#[test]
fn normalizes_template_arguments_to_detected_variables() {
    let mut prompt = input_prompt();
    prompt.prompt = "Review {{scope}} using {{risk}}.".to_string();
    prompt.template_arguments = vec![
        super::PromptTemplateArgument {
            name: "scope".to_string(),
            description: " Scope description ".to_string(),
            default_value: " current diff ".to_string(),
            ..Default::default()
        },
        super::PromptTemplateArgument {
            name: "stale".to_string(),
            description: "drop".to_string(),
            ..Default::default()
        },
    ];

    let prompt = validate_prompt(prompt, None).expect("prompt");

    assert_eq!(
        prompt
            .template_arguments
            .iter()
            .map(|argument| argument.name.as_str())
            .collect::<Vec<_>>(),
        vec!["scope", "risk"],
    );
    assert_eq!(
        prompt.template_arguments[0].description,
        "Scope description"
    );
    assert_eq!(prompt.template_arguments[0].default_value, "current diff");
}

#[test]
fn serializes_template_argument_metadata() {
    let mut prompt = input_prompt();
    prompt.prompt = "Review {{scope}}.".to_string();
    prompt.template_arguments = vec![super::PromptTemplateArgument {
        name: "scope".to_string(),
        description: "Scope to review".to_string(),
        default_value: "current diff".to_string(),
        value_type: super::PromptTemplateArgumentKind::Enum,
        enum_source: super::PromptTemplateEnumSource::Static,
        enum_name: "Scope".to_string(),
        enum_values: vec!["current diff".to_string(), "branch".to_string()],
        enum_dynamic_command: None,
        enum_dynamic_cwd: None,
    }];
    let prompt = validate_prompt(prompt, None).expect("prompt");

    let toml = super::prompt_file_to_toml(&prompt).expect("toml");

    assert!(toml.contains("[[template_arguments]]"));
    assert!(toml.contains("name = \"scope\""));
    assert!(toml.contains("value_type = \"enum\""));
    assert!(toml.contains("enum_values = ["));
    assert!(toml.contains("\"current diff\""));
    assert!(toml.contains("\"branch\""));
}

#[test]
fn serializes_dynamic_enum_config_without_resolved_values() {
    let mut prompt = input_prompt();
    prompt.prompt = "Review {{branch}}.".to_string();
    prompt.template_arguments = vec![super::PromptTemplateArgument {
        name: "branch".to_string(),
        description: "Branch to review".to_string(),
        default_value: String::new(),
        value_type: super::PromptTemplateArgumentKind::Enum,
        enum_source: super::PromptTemplateEnumSource::Dynamic,
        enum_name: "Branches".to_string(),
        enum_values: vec!["resolved-value".to_string()],
        enum_dynamic_command: Some(" git branch --format='%(refname:short)' ".to_string()),
        enum_dynamic_cwd: Some(" ~/Workspace/ult ".to_string()),
    }];
    let prompt = validate_prompt(prompt, None).expect("prompt");

    assert!(prompt.template_arguments[0].enum_values.is_empty());
    assert_eq!(
        prompt.template_arguments[0].enum_dynamic_command.as_deref(),
        Some("git branch --format='%(refname:short)'"),
    );
    assert_eq!(
        prompt.template_arguments[0].enum_dynamic_cwd.as_deref(),
        Some("~/Workspace/ult"),
    );

    let toml = super::prompt_file_to_toml(&prompt).expect("toml");

    assert!(toml.contains("enum_source = \"dynamic\""));
    assert!(toml.contains("enum_dynamic_command = \"git branch --format='%(refname:short)'\""));
    assert!(toml.contains("enum_dynamic_cwd = \"~/Workspace/ult\""));
    assert!(!toml.contains("enum_values"));
    assert!(!toml.contains("resolved-value"));
}
