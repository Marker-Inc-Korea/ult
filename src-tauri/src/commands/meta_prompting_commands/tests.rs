use super::{
    request::{openai_request_body, META_PROMPTING_MAX_OUTPUT_TOKENS},
    response::{openai_error_message, parse_openai_meta_prompt_result},
    validation::{
        validate_meta_prompting_api_key, validate_meta_prompting_model,
        validate_meta_prompting_provider,
    },
    MetaPromptRiskLevel,
};

#[test]
fn parses_structured_output_text() {
    let body = r#"
    {
      "output": [
        {
          "type": "message",
          "content": [
            {
              "type": "output_text",
              "text": "{\"intervention_text\":\"Check failing tests first.\",\"title\":\"Check tests\",\"risk_level\":\"low\",\"requires_confirmation\":false,\"why_this_wording\":\"It is direct.\"}"
            }
          ]
        }
      ]
    }
    "#;

    let result = parse_openai_meta_prompt_result(body).expect("result");
    assert_eq!(result.intervention_text, "Check failing tests first.");
    assert_eq!(result.risk_level, MetaPromptRiskLevel::Low);
    assert!(!result.requires_confirmation);
}

#[test]
fn parses_text_after_reasoning_output_item() {
    let body = r#"
    {
      "status": "completed",
      "output": [
        {
          "type": "reasoning",
          "summary": []
        },
        {
          "type": "message",
          "content": [
            {
              "type": "output_text",
              "text": "{\"intervention_text\":\"테스트를 실행하지 않고 계속 구현하지 마세요. 변경 후 관련 테스트를 먼저 실행하고 실패를 수정하세요.\",\"title\":\"Run tests first\",\"risk_level\":\"medium\",\"requires_confirmation\":false,\"why_this_wording\":\"It turns the note into a direct guardrail.\"}"
            }
          ]
        }
      ]
    }
    "#;

    let result = parse_openai_meta_prompt_result(body).expect("result");
    assert_eq!(
        result.intervention_text,
        "테스트를 실행하지 않고 계속 구현하지 마세요. 변경 후 관련 테스트를 먼저 실행하고 실패를 수정하세요."
    );
    assert_eq!(result.risk_level, MetaPromptRiskLevel::Medium);
    assert!(!result.requires_confirmation);
}

#[test]
fn parses_top_level_output_text() {
    let body = r#"
    {
      "output_text": "{\"intervention_text\":\"Run the relevant tests before continuing implementation.\",\"title\":\"Run tests\",\"risk_level\":\"low\",\"requires_confirmation\":false,\"why_this_wording\":\"It is concise.\"}",
      "output": []
    }
    "#;

    let result = parse_openai_meta_prompt_result(body).expect("result");
    assert_eq!(
        result.intervention_text,
        "Run the relevant tests before continuing implementation."
    );
    assert_eq!(result.risk_level, MetaPromptRiskLevel::Low);
}

#[test]
fn rejects_result_without_intervention_text() {
    let body = r#"
    {
      "output_text": "{\"intervention_text\":\"\",\"title\":\"Empty\",\"risk_level\":\"low\",\"requires_confirmation\":false,\"why_this_wording\":\"No rewrite was produced.\"}",
      "output": []
    }
    "#;

    let error = parse_openai_meta_prompt_result(body).expect_err("empty");
    assert_eq!(error, "OpenAI returned an empty intervention");
}

#[test]
fn reports_refusal_separately() {
    let body = r#"
    {
      "output": [
        {
          "type": "message",
          "content": [
            {
              "type": "refusal",
              "refusal": "I cannot help with that."
            }
          ]
        }
      ]
    }
    "#;

    let error = parse_openai_meta_prompt_result(body).expect_err("refusal");
    assert_eq!(error, "OpenAI refused to refine this prompt.");
}

#[test]
fn reports_incomplete_response_separately() {
    let body = r#"
    {
      "status": "incomplete",
      "incomplete_details": {
        "reason": "max_output_tokens"
      },
      "output": []
    }
    "#;

    let error = parse_openai_meta_prompt_result(body).expect_err("incomplete");
    assert_eq!(
        error,
        "Retryable provider failure: OpenAI response was incomplete because the output limit was reached. Try a shorter scratch prompt."
    );
}

#[test]
fn reports_incomplete_before_partial_output_text() {
    let body = r#"
    {
      "status": "incomplete",
      "incomplete_details": {
        "reason": "max_output_tokens"
      },
      "output_text": "{\"intervention_text\":\"partial"
    }
    "#;

    let error = parse_openai_meta_prompt_result(body).expect_err("incomplete");
    assert_eq!(
        error,
        "Retryable provider failure: OpenAI response was incomplete because the output limit was reached. Try a shorter scratch prompt."
    );
}

#[test]
fn request_body_allocates_reasoning_budget_for_gpt5() {
    let body = openai_request_body("gpt-5-mini", "Rewrite: {input}", "rough note");

    assert_eq!(
        body.get("max_output_tokens")
            .and_then(|value| value.as_u64()),
        Some(META_PROMPTING_MAX_OUTPUT_TOKENS as u64),
    );
    assert_eq!(
        body.get("reasoning")
            .and_then(|value| value.get("effort"))
            .and_then(|value| value.as_str()),
        Some("low"),
    );
}

#[test]
fn request_body_handles_vague_input_through_prompt_contract() {
    let body = openai_request_body("gpt-4.1-mini", "Rewrite: {input}", "ㅎㅇㅎㅇ");
    let instructions = body
        .get("instructions")
        .and_then(|value| value.as_str())
        .expect("instructions");
    let properties = body
        .get("text")
        .and_then(|value| value.get("format"))
        .and_then(|value| value.get("schema"))
        .and_then(|value| value.get("properties"))
        .and_then(|value| value.as_object())
        .expect("schema properties");

    assert!(instructions.contains("vague, social, filler"));
    assert!(instructions.contains("missing a concrete task"));
    assert!(instructions.contains("pause, avoid code changes"));
    assert!(instructions.contains("do not write an assistant-response prompt"));
    assert!(instructions.contains("Preserve the user's intent and language"));
    assert!(!instructions.contains("not actionable"));
    assert!(properties.get("status").is_none());
}

#[test]
fn request_body_omits_reasoning_for_non_reasoning_models() {
    let body = openai_request_body("gpt-4.1-mini", "Rewrite: {input}", "rough note");

    assert!(body.get("reasoning").is_none());
}

#[test]
fn reads_openai_error_message() {
    let body = r#"{"error":{"message":"bad key"}}"#;
    assert_eq!(openai_error_message(body), Some("bad key".to_string()));
}

#[test]
fn validates_meta_prompting_connection_inputs() {
    assert_eq!(
        validate_meta_prompting_provider(" OPENAI ").expect("provider"),
        "openai"
    );
    assert_eq!(
        validate_meta_prompting_api_key(" sk-test ").expect("api key"),
        "sk-test"
    );
    assert_eq!(
        validate_meta_prompting_model(" gpt-5-mini ").expect("model"),
        "gpt-5-mini"
    );

    assert_eq!(
        validate_meta_prompting_provider("").expect_err("provider"),
        "Meta Prompting provider is required"
    );
    assert_eq!(
        validate_meta_prompting_api_key("").expect_err("api key"),
        "OpenAI API key is required to test Meta Prompting"
    );
    assert_eq!(
        validate_meta_prompting_model("bad/model").expect_err("model"),
        "Meta Prompting model contains unsupported characters"
    );
}
