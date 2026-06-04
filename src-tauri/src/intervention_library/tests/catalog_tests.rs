#[test]
fn bundled_prompt_artifacts_match_rust_schema() {
    let prompts = super::parse_bundled_prompts_json(include_str!(
        "../../../../src/data/bundled-prompts.json"
    ))
    .expect("bundled prompts");
    assert!(prompts.len() >= 8);
    assert!(super::prompt_ids(&prompts).contains("scope-lock"));
    assert!(prompts.iter().all(|prompt| prompt.pinned));
}
