import { schedulePromptPalettePosition } from "../shared/positioning";
import { syncOverlaySurfaceState } from "../shared/surfaceState";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { transitionPromptPaletteRuntimeState } from "../../paletteRuntimeState";

export function setPromptPaletteTemplateState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  promptId: string,
  contextIds: string[] = [],
  initialValues: Record<string, string> = {},
) {
  const result = transitionPromptPaletteRuntimeState(palette, {
    type: "set-template",
    promptId,
    contextIds,
    initialValues,
  });
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
  if (result.schedulePosition) {
    schedulePromptPalettePosition(palette);
  }
}

export function clearPromptPaletteTemplateState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  const result = transitionPromptPaletteRuntimeState(palette, { type: "clear-template" });
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
  if (result.schedulePosition) {
    schedulePromptPalettePosition(palette);
  }
}

export function setPromptPaletteTemplateValidationErrors(
  palette: PromptPaletteRuntime,
  errors: Record<string, string>,
) {
  palette.templateValidationErrors = errors;
}

export function setPromptPaletteTemplateDynamicEnumLoading(
  palette: PromptPaletteRuntime,
  variable: string,
  loading: boolean,
) {
  palette.templateDynamicEnumLoading = {
    ...palette.templateDynamicEnumLoading,
    [variable]: loading,
  };
  if (loading) {
    const { [variable]: _previous, ...errors } = palette.templateDynamicEnumErrors;
    const { [variable]: _previousValues, ...values } = palette.templateDynamicEnumValues;
    palette.templateDynamicEnumErrors = errors;
    palette.templateDynamicEnumValues = values;
  }
}

export function setPromptPaletteTemplateDynamicEnumResult(
  palette: PromptPaletteRuntime,
  variable: string,
  values: string[],
  error?: string | null,
) {
  const { [variable]: _previousLoading, ...loading } = palette.templateDynamicEnumLoading;
  palette.templateDynamicEnumLoading = loading;
  palette.templateDynamicEnumValues = {
    ...palette.templateDynamicEnumValues,
    [variable]: values,
  };
  if (error?.trim()) {
    palette.templateDynamicEnumErrors = {
      ...palette.templateDynamicEnumErrors,
      [variable]: error.trim(),
    };
  } else {
    const { [variable]: _previousError, ...errors } = palette.templateDynamicEnumErrors;
    palette.templateDynamicEnumErrors = errors;
  }
}

export function clearPromptPaletteTemplateDynamicEnums(
  palette: PromptPaletteRuntime,
) {
  palette.templateDynamicEnumValues = {};
  palette.templateDynamicEnumErrors = {};
  palette.templateDynamicEnumLoading = {};
}

export function setPromptPaletteTemplateValue(
  palette: PromptPaletteRuntime,
  variable: string,
  value: string,
) {
  palette.templateValues = {
    ...palette.templateValues,
    [variable]: value,
  };
  if (!palette.templateValidationErrors[variable]) return;
  if (!value.trim()) return;
  const { [variable]: _cleared, ...remaining } = palette.templateValidationErrors;
  palette.templateValidationErrors = remaining;
}

export function templatePrompt(palette: PromptPaletteRuntime) {
  return palette.prompts.find((prompt) => prompt.id === palette.templatePromptId) ?? null;
}
