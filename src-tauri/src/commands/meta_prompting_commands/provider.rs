use std::time::Duration;

use super::request::openai_request_body;
use super::response::{
    openai_error_message, parse_openai_meta_prompt_result, retryable_provider_failure,
};
use super::MetaPromptResult;

const META_PROMPTING_PROVIDER_TIMEOUT_SECS: u64 = 20;

pub(super) async fn refine_with_openai(
    api_key: &str,
    model: &str,
    template: &str,
    text: &str,
) -> Result<MetaPromptResult, String> {
    let client = openai_client()?;
    let response = client
        .post("https://api.openai.com/v1/responses")
        .bearer_auth(api_key)
        .json(&openai_request_body(model, template, text))
        .send()
        .await
        .map_err(|error| openai_request_error(error, "failed to call OpenAI"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| openai_request_error(error, "failed to read OpenAI response"))?;

    if !status.is_success() {
        return Err(openai_error_message(&body)
            .unwrap_or_else(|| format!("OpenAI request failed with status {}", status.as_u16())));
    }

    parse_openai_meta_prompt_result(&body)
}

pub(super) async fn test_openai_connection(api_key: &str, model: &str) -> Result<(), String> {
    let client = openai_client()?;
    let response = client
        .get(format!("https://api.openai.com/v1/models/{model}"))
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|error| openai_request_error(error, "failed to call OpenAI"))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| openai_request_error(error, "failed to read OpenAI response"))?;

    if status.is_success() {
        return Ok(());
    }

    if status.as_u16() == 404 {
        return Err(format!("OpenAI could not find model `{model}`."));
    }
    if status.as_u16() == 401 {
        return Err(openai_error_message(&body)
            .unwrap_or_else(|| "OpenAI rejected the API key.".to_string()));
    }
    Err(openai_error_message(&body).unwrap_or_else(|| {
        format!(
            "OpenAI connection test failed with status {}",
            status.as_u16()
        )
    }))
}

fn openai_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(META_PROMPTING_PROVIDER_TIMEOUT_SECS))
        .build()
        .map_err(|error| format!("failed to build OpenAI client: {error}"))
}

fn openai_request_error(error: reqwest::Error, context: &str) -> String {
    if error.is_timeout() {
        return retryable_provider_failure("Meta Prompting request timed out. Try again.");
    }
    format!("{context}: {error}")
}
