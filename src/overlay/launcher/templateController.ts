import { native } from "../../native";
import {
  setPromptPaletteTemplateDynamicEnumLoading,
  setPromptPaletteTemplateDynamicEnumResult,
  templatePrompt,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import type { PromptTemplateArgument } from "../../types";

export async function resolveTemplateDynamicEnum(
  palette: PromptPaletteRuntime,
  variable: string,
  rerender: () => void,
) {
  const prompt = templatePrompt(palette);
  if (!prompt) return;
  const promptId = prompt.id;
  const argument = (prompt.template_arguments ?? [])
    .find((entry) => entry.name === variable && isDynamicEnumArgument(entry));
  if (!argument) return;
  if (palette.templateDynamicEnumLoading[variable]) return;

  if (!argument.enum_dynamic_command?.trim() || !argument.enum_dynamic_cwd?.trim()) {
    setPromptPaletteTemplateDynamicEnumResult(
      palette,
      argument.name,
      [],
      "Dynamic enum needs a command and working directory.",
    );
    rerender();
    return;
  }

  setPromptPaletteTemplateDynamicEnumLoading(palette, argument.name, true);
  rerender();

  const command = argument.enum_dynamic_command.trim();
  const workingDirectory = argument.enum_dynamic_cwd.trim();
  try {
    const result = await native.resolveDynamicEnumArgument(
      argument.name,
      command,
      workingDirectory,
    );
    if (!isTemplateDynamicEnumResolutionCurrent(palette, promptId)) return;
    const warning = result.ok && result.truncated
      ? "Showing the first resolved choices."
      : result.error;
    setPromptPaletteTemplateDynamicEnumResult(
      palette,
      argument.name,
      result.values,
      warning,
    );
    rerender();
  } catch (error) {
    if (!isTemplateDynamicEnumResolutionCurrent(palette, promptId)) return;
    setPromptPaletteTemplateDynamicEnumResult(
      palette,
      argument.name,
      [],
      error instanceof Error ? error.message : String(error || "Dynamic enum failed."),
    );
    rerender();
  }
}

function isDynamicEnumArgument(argument: PromptTemplateArgument) {
  return argument.value_type === "enum" && argument.enum_source === "dynamic";
}

function isTemplateDynamicEnumResolutionCurrent(
  palette: PromptPaletteRuntime,
  promptId: string,
) {
  return palette.active
    && palette.surfaceMode === "template"
    && palette.templatePromptId === promptId;
}
