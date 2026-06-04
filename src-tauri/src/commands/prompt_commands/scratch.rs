use std::collections::HashSet;

use tauri::{AppHandle, Runtime};

use crate::intervention_library::{
    add_intervention_artifact as add_artifact_to_library, load_intervention_library_from_disk,
    PromptArtifactSource, PromptArtifactType, PromptDefinition, PromptLoadResult, PromptScope,
};
use crate::logging::info_event;
use crate::state::AppState;

const SCRATCH_PROMPT_ID_HEX_LEN: usize = 7;
const SCRATCH_PROMPT_ID_ATTEMPTS: usize = 64;

pub(crate) fn save_scratch_prompt_use_case<R: Runtime>(
    app: &AppHandle<R>,
    state: &AppState,
    text: String,
    confirm: bool,
) -> Result<PromptLoadResult, String> {
    let existing = load_intervention_library_from_disk(app);
    let id = unique_scratch_prompt_id(&existing.artifacts)?;
    let prompt = scratch_prompt_definition(id, text, confirm)?;
    let prompt = add_artifact_to_library(app, prompt)?;
    state.set_selected_artifact_id(prompt.id)?;
    info_event(app, "intervention-library", "scratch prompt saved");
    super::load_prompt_cache_for_app(app, state, true)
}

pub(crate) fn scratch_prompt_definition(
    id: String,
    text: String,
    confirm: bool,
) -> Result<PromptDefinition, String> {
    let prompt = text.trim().to_string();
    if prompt.is_empty() {
        return Err("scratch prompt is empty".to_string());
    }
    Ok(PromptDefinition {
        id,
        title: scratch_prompt_title(&prompt),
        artifact_type: PromptArtifactType::Prompt,
        scope: PromptScope::Ephemeral,
        pinned: false,
        description: "Saved scratch prompt.".to_string(),
        prompt,
        contexts: Vec::new(),
        shortcut: None,
        confirm,
        template_arguments: Vec::new(),
        created_at: None,
        expires_at: None,
        source: PromptArtifactSource::Scratch,
    })
}

pub(crate) fn scratch_prompt_title(prompt: &str) -> String {
    let first_line = prompt
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .unwrap_or("Scratch prompt");
    let mut title = first_line.chars().take(48).collect::<String>();
    if first_line.chars().count() > 48 {
        title.push_str("...");
    }
    title
}

pub(crate) fn unique_scratch_prompt_id(prompts: &[PromptDefinition]) -> Result<String, String> {
    let existing = prompts
        .iter()
        .map(|prompt| prompt.id.as_str())
        .collect::<HashSet<_>>();
    for _ in 0..SCRATCH_PROMPT_ID_ATTEMPTS {
        let candidate = random_scratch_prompt_id()?;
        if !existing.contains(candidate.as_str()) {
            return Ok(candidate);
        }
    }
    Err("failed to allocate a unique scratch prompt id".to_string())
}

fn random_scratch_prompt_id() -> Result<String, String> {
    let mut bytes = [0u8; 4];
    getrandom::fill(&mut bytes)
        .map_err(|error| format!("failed to generate scratch prompt id: {error}"))?;
    Ok(format!("{:08x}", u32::from_be_bytes(bytes))
        .chars()
        .take(SCRATCH_PROMPT_ID_HEX_LEN)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{scratch_prompt_definition, scratch_prompt_title, unique_scratch_prompt_id};
    use crate::intervention_library::{PromptArtifactType, PromptDefinition, PromptScope};

    #[test]
    fn scratch_prompt_save_definition_is_ephemeral_and_unpinned() {
        let prompt = scratch_prompt_definition(
            "75ac6db".to_string(),
            "  Fix tests before more changes.  ".to_string(),
            true,
        )
        .expect("scratch prompt");

        assert_eq!(prompt.id, "75ac6db");
        assert_eq!(prompt.title, "Fix tests before more changes.");
        assert_eq!(prompt.artifact_type, PromptArtifactType::Prompt);
        assert_eq!(prompt.scope, PromptScope::Ephemeral);
        assert!(!prompt.pinned);
        assert!(prompt.confirm);
        assert_eq!(prompt.prompt, "Fix tests before more changes.");
    }

    #[test]
    fn scratch_prompt_save_rejects_empty_text() {
        assert!(
            scratch_prompt_definition("75ac6db".to_string(), "   ".to_string(), false,)
                .expect_err("empty scratch")
                .contains("empty")
        );
    }

    #[test]
    fn scratch_prompt_title_is_short_and_derived_from_first_line() {
        assert_eq!(
            scratch_prompt_title("\n\nFirst useful line\nSecond"),
            "First useful line"
        );
        assert!(scratch_prompt_title("a".repeat(80).as_str()).ends_with("..."));
    }

    #[test]
    fn scratch_prompt_ids_avoid_existing_ids() {
        let existing = vec![PromptDefinition {
            id: unique_scratch_prompt_id(&[]).expect("scratch id"),
            title: "Existing".to_string(),
            artifact_type: PromptArtifactType::Prompt,
            scope: PromptScope::Ephemeral,
            pinned: false,
            description: String::new(),
            prompt: "Existing".to_string(),
            contexts: Vec::new(),
            shortcut: None,
            confirm: false,
            template_arguments: Vec::new(),
            created_at: None,
            expires_at: None,
            source: Default::default(),
        }];

        let next = unique_scratch_prompt_id(&existing).expect("scratch id");
        assert_ne!(next, existing[0].id);
        assert_scratch_prompt_id(&next);
    }

    #[test]
    fn scratch_prompt_ids_are_opaque_hex_handles() {
        let id = unique_scratch_prompt_id(&[]).expect("scratch id");
        assert_scratch_prompt_id(&id);
    }

    fn assert_scratch_prompt_id(id: &str) {
        assert_eq!(id.len(), 7);
        assert!(id.chars().all(|character| character.is_ascii_hexdigit()));
        assert_eq!(id, id.to_ascii_lowercase());
    }
}
