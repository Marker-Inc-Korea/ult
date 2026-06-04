use serde_json::Value;

use super::MetaPromptResult;

pub(super) fn parse_openai_meta_prompt_result(body: &str) -> Result<MetaPromptResult, String> {
    let value: Value = serde_json::from_str(body)
        .map_err(|error| format!("failed to parse OpenAI response: {error}"))?;
    let text = output_text(&value)?;
    let result: MetaPromptResult = serde_json::from_str(text)
        .map_err(|error| format!("OpenAI returned invalid Meta Prompting JSON: {error}"))?;
    if result.intervention_text.trim().is_empty() {
        return Err("OpenAI returned an empty intervention".to_string());
    }
    Ok(MetaPromptResult {
        intervention_text: result.intervention_text.trim().to_string(),
        title: result.title.trim().to_string(),
        risk_level: result.risk_level,
        requires_confirmation: result.requires_confirmation,
        why_this_wording: result.why_this_wording.trim().to_string(),
    })
}

pub(super) fn openai_error_message(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    openai_error_message_from_value(&value)
}

pub(super) fn retryable_provider_failure(message: &str) -> String {
    format!("Retryable provider failure: {message}")
}

fn output_text(value: &Value) -> Result<&str, String> {
    if let Some(error) = openai_response_status_error(value) {
        return Err(error);
    }

    if let Some(text) = value
        .get("output_text")
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
    {
        return Ok(text);
    }

    let mut saw_refusal = false;
    let output = value
        .get("output")
        .and_then(Value::as_array)
        .ok_or_else(|| {
            openai_response_status_error(value)
                .unwrap_or_else(|| "OpenAI response did not contain output text".to_string())
        })?;
    for item in output {
        let Some(content) = item.get("content").and_then(Value::as_array) else {
            continue;
        };
        for entry in content {
            if entry.get("type").and_then(Value::as_str) == Some("output_text") {
                if let Some(text) = entry
                    .get("text")
                    .and_then(Value::as_str)
                    .filter(|text| !text.trim().is_empty())
                {
                    return Ok(text);
                }
            }
            if entry.get("type").and_then(Value::as_str) == Some("refusal")
                || entry.get("refusal").and_then(Value::as_str).is_some()
            {
                saw_refusal = true;
            }
        }
    }
    if saw_refusal {
        return Err("OpenAI refused to refine this prompt.".to_string());
    }
    Err(openai_response_status_error(value)
        .unwrap_or_else(|| "OpenAI response did not contain output text".to_string()))
}

fn openai_response_status_error(value: &Value) -> Option<String> {
    match value.get("status").and_then(Value::as_str)? {
        "incomplete" => {
            let reason = value
                .get("incomplete_details")
                .and_then(|details| details.get("reason"))
                .and_then(Value::as_str);
            Some(match reason {
                Some("max_output_tokens") => {
                    retryable_provider_failure("OpenAI response was incomplete because the output limit was reached. Try a shorter scratch prompt.")
                }
                Some(reason) => retryable_provider_failure(&format!(
                    "OpenAI response was incomplete ({reason}). Try again."
                )),
                None => retryable_provider_failure("OpenAI response was incomplete. Try again."),
            })
        }
        "failed" => Some(
            openai_error_message_from_value(value)
                .unwrap_or_else(|| "OpenAI failed to refine this prompt. Try again.".to_string()),
        ),
        "cancelled" => Some("OpenAI cancelled the Meta Prompting request. Try again.".to_string()),
        _ => None,
    }
}

fn openai_error_message_from_value(value: &Value) -> Option<String> {
    value
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .map(str::to_string)
}
