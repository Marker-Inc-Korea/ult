use serde::{Deserialize, Serialize};
use tauri::{AppHandle, WebviewWindow};

use crate::commands::{ensure_window, load_effective_app_settings};
use crate::windows::{PALETTE_WINDOW, SETTINGS_WINDOW};

#[path = "meta_prompting_commands/provider.rs"]
mod provider;
#[path = "meta_prompting_commands/request.rs"]
mod request;
#[path = "meta_prompting_commands/response.rs"]
mod response;
#[path = "meta_prompting_commands/validation.rs"]
mod validation;

#[cfg(test)]
#[path = "meta_prompting_commands/tests.rs"]
mod tests;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MetaPromptRiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
pub struct MetaPromptResult {
    pub intervention_text: String,
    pub title: String,
    pub risk_level: MetaPromptRiskLevel,
    pub requires_confirmation: bool,
    pub why_this_wording: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct MetaPromptingConnectionTestResult {
    pub provider: String,
    pub model: String,
    pub message: String,
}

#[tauri::command]
pub async fn test_meta_prompting_connection(
    window: WebviewWindow,
    provider: String,
    api_key: String,
    model: String,
) -> Result<MetaPromptingConnectionTestResult, String> {
    ensure_window(&window, &[SETTINGS_WINDOW])?;
    let provider = validation::validate_meta_prompting_provider(&provider)?;
    let api_key = validation::validate_meta_prompting_api_key(&api_key)?;
    let model = validation::validate_meta_prompting_model(&model)?;

    provider::test_openai_connection(&api_key, &model).await?;
    Ok(MetaPromptingConnectionTestResult {
        provider,
        model,
        message: "OpenAI connection works.".to_string(),
    })
}

#[tauri::command]
pub async fn refine_scratch_prompt(
    window: WebviewWindow,
    app: AppHandle,
    text: String,
) -> Result<MetaPromptResult, String> {
    ensure_window(&window, &[PALETTE_WINDOW])?;
    let text = validation::validate_scratch_prompt_text(&text)?;
    let settings = load_effective_app_settings(&app);
    let request = validation::validate_refine_settings(&settings)?;

    provider::refine_with_openai(&request.api_key, &request.model, &request.template, &text).await
}
