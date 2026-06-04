import { parseTemplateVariables } from "./templatePrompt";
import type { PromptTemplateArgument } from "./types";

export function syncPromptTemplateArguments(
  promptText: string,
  existing: PromptTemplateArgument[] = [],
) {
  const byName = new Map(existing.map((argument) => [argument.name, argument]));
  return parseTemplateVariables(promptText).variables.map((name) => {
    const argument = byName.get(name);
    return normalizePromptTemplateArgument({
      name,
      description: argument?.description ?? "",
      default_value: argument?.default_value ?? "",
      value_type: argument?.value_type ?? "text",
      enum_source: argument?.enum_source ?? "static",
      enum_name: argument?.enum_name ?? "",
      enum_values: argument?.enum_values ?? [],
      enum_dynamic_command: argument?.enum_dynamic_command ?? "",
      enum_dynamic_cwd: argument?.enum_dynamic_cwd ?? "",
    });
  });
}

export function nextPromptTemplateArgumentName(
  promptText: string,
  existing: PromptTemplateArgument[] = [],
) {
  const names = new Set([
    ...parseTemplateVariables(promptText).variables,
    ...existing.map((argument) => argument.name),
  ]);
  for (let index = 1; index < 1000; index += 1) {
    const name = `argument_${index}`;
    if (!names.has(name)) return name;
  }
  return `argument_${Date.now()}`;
}

export function normalizePromptTemplateArgument(
  argument: PromptTemplateArgument,
): PromptTemplateArgument {
  const valueType = argument.value_type === "enum" ? "enum" : "text";
  const enumSource = argument.enum_source === "dynamic" ? "dynamic" : "static";
  const normalized: PromptTemplateArgument = {
    name: argument.name.trim(),
    description: argument.description?.trim() ?? "",
    default_value: argument.default_value ?? "",
    value_type: valueType,
  };

  if (valueType !== "enum") return normalized;

  normalized.enum_source = enumSource;
  normalized.enum_name = argument.enum_name?.trim() ?? "";
  if (enumSource === "dynamic") {
    normalized.enum_dynamic_command = argument.enum_dynamic_command?.trim() ?? "";
    normalized.enum_dynamic_cwd = argument.enum_dynamic_cwd?.trim() ?? "";
    normalized.enum_values = [];
    return normalized;
  }

  const values = argument.enum_values
    ?.map((value) => value.trim())
    .filter(Boolean) ?? [];
  normalized.enum_values = [...new Set(values)];
  normalized.enum_dynamic_command = null;
  normalized.enum_dynamic_cwd = null;
  return normalized;
}
