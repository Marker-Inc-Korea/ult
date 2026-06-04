use serde_json::{json, Value};

pub(super) const META_PROMPTING_MAX_OUTPUT_TOKENS: u32 = 4096;

pub(super) fn openai_request_body(model: &str, template: &str, text: &str) -> Value {
    let prompt = template.replace("{input}", text);
    let mut body = json!({
        "model": model,
        "store": false,
        "max_output_tokens": META_PROMPTING_MAX_OUTPUT_TOKENS,
        "instructions": "You rewrite rough operator notes into concise intervention prompts for a terminal-based coding agent. Always produce an intervention_text that can be pasted directly into a coding-agent session. If the input is vague, social, filler, or missing a concrete task, do not invent work and do not write an assistant-response prompt; instead, make intervention_text tell the coding agent to pause, avoid code changes, and ask the user for the missing task, file path, command, or constraint. Preserve the user's intent and language unless the user explicitly asks for translation or language changes. Be direct and specific. Keep intervention_text under 1200 characters and why_this_wording under 240 characters. Do not add terminal contents, shell history, repository facts, source files, agent output, tasks, or examples that the user did not provide. Do not ask the coding agent to greet the user, offer help, list examples, or ask what to do next unless the user explicitly asked for that behavior. Address the coding agent directly. Return JSON only.",
        "input": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt
                    }
                ]
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "ult_meta_prompt",
                "strict": true,
                "schema": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                        "intervention_text": {
                            "type": "string",
                            "description": "The rewritten intervention prompt. Keep it concise and directly actionable."
                        },
                        "title": {
                            "type": "string",
                            "description": "A short local title for this intervention."
                        },
                        "risk_level": {
                            "type": "string",
                            "enum": ["low", "medium", "high"]
                        },
                        "requires_confirmation": {
                            "type": "boolean",
                            "description": "True when the prompt asks for destructive, interrupting, or broad autonomous behavior."
                        },
                        "why_this_wording": {
                            "type": "string",
                            "description": "A short explanation of the rewrite."
                        }
                    },
                    "required": [
                        "intervention_text",
                        "title",
                        "risk_level",
                        "requires_confirmation",
                        "why_this_wording"
                    ]
                }
            }
        }
    });
    if openai_model_uses_reasoning(model) {
        body["reasoning"] = json!({ "effort": "low" });
    }
    body
}

fn openai_model_uses_reasoning(model: &str) -> bool {
    let normalized = model.trim().to_ascii_lowercase();
    normalized.starts_with("gpt-5")
        || normalized.starts_with("o1")
        || normalized.starts_with("o3")
        || normalized.starts_with("o4")
}
