use std::collections::HashSet;

#[cfg(test)]
pub(crate) fn extract_template_variables(prompt: &str) -> Vec<String> {
    analyze_template(prompt).variables
}

#[derive(Default)]
pub(crate) struct TemplateAnalysis {
    pub(crate) variables: Vec<String>,
    pub(crate) duplicate_variables: Vec<String>,
    pub(crate) errors: Vec<String>,
}

pub(crate) fn analyze_template(prompt: &str) -> TemplateAnalysis {
    let mut variables = Vec::new();
    let mut seen = HashSet::new();
    let mut duplicate_variables = Vec::new();
    let mut duplicates = HashSet::new();
    let mut errors = Vec::new();
    let chars = prompt.chars().collect::<Vec<_>>();
    let mut index = 0;

    while index < chars.len() {
        if chars[index] != '{' || chars.get(index + 1) != Some(&'{') {
            index += 1;
            continue;
        }
        if chars.get(index + 2) == Some(&'}') && chars.get(index + 3) == Some(&'}') {
            errors.push("template variable names cannot be empty".to_string());
            index += 4;
            continue;
        }

        let start = index + 2;
        let mut end = start;
        while end < chars.len() && (chars[end].is_ascii_alphanumeric() || chars[end] == '_') {
            end += 1;
        }
        if end > start && chars.get(end) == Some(&'}') && chars.get(end + 1) == Some(&'}') {
            let variable = chars[start..end].iter().collect::<String>();
            if !seen.insert(variable.clone()) {
                if duplicates.insert(variable.clone()) {
                    duplicate_variables.push(variable);
                }
            } else {
                variables.push(variable);
            }
            index = end + 2;
        } else {
            index += 2;
        }
    }

    TemplateAnalysis {
        variables,
        duplicate_variables,
        errors,
    }
}
