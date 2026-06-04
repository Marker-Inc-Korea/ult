import { native } from "../../native";
import {
  failPromptPaletteScratchRefinement,
  finishPromptPaletteScratchRefinement,
  setPromptPaletteLoadedState,
  startPromptPaletteScratchRefinement,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import { prepareRegistryPrompt } from "../../promptExecutor";
import { promptArtifactType, promptScope } from "../../promptUtils";
import type { PromptDefinition, PromptLoadResult } from "../../types";
import { promptsFromLoadResult } from "../shared/promptLoad";

export async function prepareScratchInput(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  rerender: () => void,
  syncLoadedPointerFromNative: () => void,
) {
  if (palette.deliveryInFlight) return;
  const text = palette.scratchText.trim();
  if (!text) {
    palette.scratchNotice = "Type a prompt first";
    rerender();
    return;
  }
  const needsMetaConfirmation =
    palette.scratchMetaConfirmRequired && !palette.scratchMetaConfirmPending;
  if (needsMetaConfirmation) {
    palette.scratchMetaConfirmPending = true;
    palette.scratchNotice = "Press Enter again to prepare the refined prompt";
    rerender();
    return;
  }
  const previousIds = new Set(palette.prompts.map((prompt) => prompt.id));
  palette.deliveryInFlight = true;
  palette.scratchNotice = "Saving scratch prompt...";
  rerender();

  let prompts: PromptDefinition[];
  let scratchPrompt: PromptDefinition | null;
  try {
    const result = await native.saveScratchPrompt(
      text,
      palette.scratchMetaConfirmRequired,
    );
    prompts = promptsFromLoadResult(result);
    scratchPrompt = savedScratchPrompt(result, previousIds, text);
    if (!scratchPrompt) {
      throw new Error("Scratch saved but could not be loaded.");
    }
  } catch (error) {
    palette.deliveryInFlight = false;
    palette.scratchNotice = error instanceof Error
      ? error.message
      : "Failed to save scratch";
    rerender();
    return;
  }

  palette.prompts = prompts;
  palette.scratchNotice = null;
  setPromptPaletteLoadedState(
    surface,
    palette,
    prepareRegistryPrompt(scratchPrompt, palette.prompts, []),
  );
  syncLoadedPointerFromNative();
  rerender();
}

export async function refineScratchInput(
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  if (palette.deliveryInFlight) return;
  if (palette.scratchRefining) return;
  const text = palette.scratchText.trim();
  if (!text) {
    palette.scratchNotice = "Type a prompt first";
    rerender();
    return;
  }
  const generation = startPromptPaletteScratchRefinement(palette, text);
  rerender();

  let updated = false;
  try {
    const result = await native.refineScratchPrompt(text);
    const requiresConfirmation =
      result.requires_confirmation || result.risk_level === "high";
    updated = finishPromptPaletteScratchRefinement(
      palette,
      result.intervention_text,
      requiresConfirmation,
      generation,
      text,
    );
  } catch (error) {
    updated = failPromptPaletteScratchRefinement(
      palette,
      error instanceof Error ? error.message : String(error || "Meta Prompting failed"),
      generation,
      text,
    );
  } finally {
    if (updated) {
      rerender();
    }
  }
}

function savedScratchPrompt(
  result: PromptLoadResult,
  previousIds: Set<string>,
  text: string,
) {
  const prompts = promptsFromLoadResult(result);
  const trimmed = text.trim();
  return prompts.find((prompt) =>
    !previousIds.has(prompt.id) && isMatchingScratchPrompt(prompt, trimmed)
  ) ?? [...prompts].reverse().find((prompt) =>
    isMatchingScratchPrompt(prompt, trimmed)
  ) ?? null;
}

function isMatchingScratchPrompt(prompt: PromptDefinition, text: string) {
  return promptArtifactType(prompt) === "prompt"
    && promptScope(prompt) === "ephemeral"
    && prompt.source === "scratch"
    && prompt.prompt.trim() === text;
}
