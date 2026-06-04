use crate::settings::{AppSettings, DEFAULT_META_PROMPTING_PROVIDER};

pub(super) struct MetaPromptRefineRequest {
    pub(super) api_key: String,
    pub(super) model: String,
    pub(super) template: String,
}

pub(super) fn validate_scratch_prompt_text(text: &str) -> Result<String, String> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return Err("Scratch prompt is empty".to_string());
    }
    Ok(text)
}

pub(super) fn validate_refine_settings(
    settings: &AppSettings,
) -> Result<MetaPromptRefineRequest, String> {
    if !settings.meta_prompting_enabled {
        return Err("Enable Meta Prompting in Settings first".to_string());
    }
    if settings.meta_prompting_provider != DEFAULT_META_PROMPTING_PROVIDER {
        return Err("Only OpenAI is supported for Meta Prompting in this beta".to_string());
    }
    if settings.meta_prompting_api_key.trim().is_empty() {
        return Err("Add an OpenAI API key in Settings first".to_string());
    }
    if !settings.meta_prompting_template.contains("{input}") {
        return Err("Meta Prompting template must include {input}".to_string());
    }

    Ok(MetaPromptRefineRequest {
        api_key: settings.meta_prompting_api_key.clone(),
        model: settings.meta_prompting_model.clone(),
        template: settings.meta_prompting_template.clone(),
    })
}

pub(super) fn validate_meta_prompting_provider(provider: &str) -> Result<String, String> {
    let provider = provider.trim().to_ascii_lowercase();
    if provider.is_empty() {
        return Err("Meta Prompting provider is required".to_string());
    }
    if provider != DEFAULT_META_PROMPTING_PROVIDER {
        return Err("Only OpenAI is supported for Meta Prompting in this beta".to_string());
    }
    Ok(provider)
}

pub(super) fn validate_meta_prompting_api_key(api_key: &str) -> Result<String, String> {
    let api_key = api_key.trim().to_string();
    if api_key.is_empty() {
        return Err("OpenAI API key is required to test Meta Prompting".to_string());
    }
    Ok(api_key)
}

pub(super) fn validate_meta_prompting_model(model: &str) -> Result<String, String> {
    let model = model.trim().to_string();
    if model.is_empty() {
        return Err("Meta Prompting model is required".to_string());
    }
    if model
        .chars()
        .any(|character| character.is_whitespace() || matches!(character, '/' | '?' | '#'))
    {
        return Err("Meta Prompting model contains unsupported characters".to_string());
    }
    Ok(model)
}
