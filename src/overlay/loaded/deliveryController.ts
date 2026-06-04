import {
  clearPromptPaletteTemplateState,
  setPromptPaletteApplyingState,
  setPromptPaletteLoadedState,
  setPromptPaletteTemplateState,
  setPromptPaletteTemplateValidationErrors,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import {
  applyPreparedPrompt,
  prepareRegistryPrompt,
  prepareTemplatePrompt,
} from "../../promptExecutor";
import { parseTemplateVariables } from "../../templatePrompt";
import type { DeliveryCommandResult, PromptDefinition } from "../../types";
import { native } from "../../native";
import { selectedEphemeralContext } from "../launcher/ephemeralContextState";

export type PersistPromptSelection = (prompt?: PromptDefinition) => void;
export type PreparePromptOptions = {
  templateValues?: Record<string, string>;
};

export function submitTemplateValues(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  values: Record<string, string>,
  rerender: () => void,
  syncLoadedPointerFromNative: () => void,
) {
  const prompt = palette.prompts.find((entry) => entry.id === palette.templatePromptId);
  if (!prompt) return;
  for (const [variable, value] of Object.entries(values)) {
    palette.templateValues = {
      ...palette.templateValues,
      [variable]: value,
    };
  }
  const missing = missingTemplateVariables(prompt, values);
  if (missing.length > 0) {
    setPromptPaletteTemplateValidationErrors(
      palette,
      Object.fromEntries(
        missing.map((variable) => [variable, "Required"]),
      ),
    );
    rerender();
    return;
  }
  const templateContextIds = [...palette.templateContextIds];
  setPromptPaletteLoadedState(
    surface,
    palette,
    prepareTemplatePrompt(
      prompt,
      values,
      palette.prompts,
      templateContextIds,
    ),
  );
  syncLoadedPointerFromNative();
  rerender();
}

export function cancelTemplate(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  const shouldDismiss = palette.templateReturnLauncherMode === null;
  clearPromptPaletteTemplateState(surface, palette);
  rerender();
  if (shouldDismiss) {
    void native.unloadOverlay().catch(() => undefined);
  }
}

export function preparePromptForExecution(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  prompt: PromptDefinition,
  contextIds: string[],
  rerender: () => void,
  persistSelection: PersistPromptSelection,
  syncLoadedPointerFromNative: () => void,
  options: PreparePromptOptions = {},
) {
  if (prompt.confirm && palette.pendingConfirmPromptId !== prompt.id) {
    palette.pendingConfirmPromptId = prompt.id;
    rerender();
    return;
  }
  palette.pendingConfirmPromptId = null;
  persistSelection(prompt);
  if (templateVariables(prompt).length > 0) {
    setPromptPaletteTemplateState(
      surface,
      palette,
      prompt.id,
      contextIds,
      options.templateValues ?? {},
    );
    rerender();
    return;
  }
  setPromptPaletteLoadedState(
    surface,
    palette,
    prepareRegistryPrompt(prompt, palette.prompts, contextIds),
  );
  syncLoadedPointerFromNative();
  rerender();
}

export async function applyLoadedPrompt(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  if (palette.surfaceMode !== "loaded") return;
  if (palette.deliveryInFlight) return;
  const prepared = palette.preparedExecution;
  if (!prepared) return;
  palette.deliveryInFlight = true;
  setPromptPaletteApplyingState(surface, palette);

  try {
    const result = await applyPreparedPrompt(prepared);
    if (shouldUnloadAfterDeliveryCommand(result)) {
      void native.unloadOverlay().catch(() => undefined);
    }
  } catch (error) {
    console.error("Prompt palette delivery failed", error);
    void native.unloadOverlay().catch(() => undefined);
  }
}

export async function pasteSelectedEphemeralContext(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  if (palette.surfaceMode !== "context-picker") return;
  if (palette.deliveryInFlight) return;
  const context = selectedEphemeralContext(palette);
  if (!context) return;
  palette.deliveryInFlight = true;
  setPromptPaletteApplyingState(surface, palette);

  try {
    const result = await native.deliverPromptAtPointer(
      context.prompt,
      "paste",
      context.id,
      "context",
    );
    if (shouldUnloadAfterDeliveryCommand(result)) {
      void native.unloadOverlay().catch(() => undefined);
    }
  } catch (error) {
    console.error("Ephemeral context delivery failed", error);
    void native.unloadOverlay().catch(() => undefined);
  }
}

export function shouldUnloadAfterDeliveryCommand(result: DeliveryCommandResult) {
  return result.status !== "started" && result.diagnostic_code !== "accessibility-required";
}

function templateVariables(prompt: PromptDefinition) {
  return prompt.template_variables ?? parseTemplateVariables(prompt.prompt).variables;
}

function missingTemplateVariables(
  prompt: PromptDefinition,
  values: Record<string, string>,
) {
  return templateVariables(prompt).filter((variable) => !values[variable]?.trim());
}
