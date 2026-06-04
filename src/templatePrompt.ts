export type TemplateParseResult = {
  variables: string[];
  duplicateVariables: string[];
  errors: string[];
};

export function parseTemplateVariables(prompt: string): TemplateParseResult {
  const variables: string[] = [];
  const duplicateVariables: string[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  let index = 0;

  while (index < prompt.length) {
    if (prompt[index] !== "{" || prompt[index + 1] !== "{") {
      index += 1;
      continue;
    }
    if (prompt[index + 2] === "}" && prompt[index + 3] === "}") {
      errors.push("Template variable names cannot be empty.");
      index += 4;
      continue;
    }

    const start = index + 2;
    let end = start;
    while (end < prompt.length && /[A-Za-z0-9_]/.test(prompt[end] ?? "")) {
      end += 1;
    }

    if (end > start && prompt[end] === "}" && prompt[end + 1] === "}") {
      const variable = prompt.slice(start, end);
      if (seen.has(variable) && !duplicates.has(variable)) {
        duplicateVariables.push(variable);
        duplicates.add(variable);
      }
      if (!seen.has(variable)) {
        variables.push(variable);
        seen.add(variable);
      }
      index = end + 2;
      continue;
    }

    index += 2;
  }

  return { variables, duplicateVariables, errors };
}

export function renderPromptTemplate(
  prompt: string,
  values: Record<string, string>,
) {
  let output = "";
  let index = 0;

  while (index < prompt.length) {
    if (prompt[index] !== "{" || prompt[index + 1] !== "{") {
      output += prompt[index];
      index += 1;
      continue;
    }

    const start = index + 2;
    let end = start;
    while (end < prompt.length && /[A-Za-z0-9_]/.test(prompt[end] ?? "")) {
      end += 1;
    }
    if (end > start && prompt[end] === "}" && prompt[end + 1] === "}") {
      output += values[prompt.slice(start, end)] ?? "";
      index = end + 2;
      continue;
    }

    output += "{{";
    index += 2;
  }

  return output;
}
