import type { PromptPaletteRuntime } from "../../paletteRuntime";

export function setPromptPaletteScratchText(
  palette: PromptPaletteRuntime,
  text: string,
) {
  if (palette.scratchText !== text) {
    palette.scratchMetaConfirmPending = false;
    clearPromptPaletteScratchRefinement(palette);
    palette.scratchRefineError = null;
    palette.scratchNotice = null;
  }
  palette.scratchText = text;
}

export function startPromptPaletteScratchRefinement(
  palette: PromptPaletteRuntime,
  sourceText: string,
) {
  palette.scratchRefineGeneration += 1;
  palette.launcherMode = "refine";
  palette.scratchRefining = true;
  palette.scratchRefineSourceText = sourceText;
  palette.scratchRefineSourceRequiresConfirmation = palette.scratchMetaConfirmRequired;
  palette.scratchRefineResultText = null;
  palette.scratchRefineResultRequiresConfirmation = false;
  palette.scratchRefineApplied = false;
  palette.scratchRefineError = null;
  palette.scratchNotice = null;
  palette.scratchMetaConfirmPending = false;
  return palette.scratchRefineGeneration;
}

export function finishPromptPaletteScratchRefinement(
  palette: PromptPaletteRuntime,
  resultText: string,
  requiresConfirmation: boolean,
  generation?: number,
  sourceText?: string,
) {
  if (
    generation !== undefined
    && !isPromptPaletteScratchRefinementCurrent(palette, generation, sourceText)
  ) {
    return false;
  }
  palette.scratchRefining = false;
  palette.launcherMode = "scratch";
  palette.scratchRefineResultText = resultText;
  palette.scratchRefineResultRequiresConfirmation = requiresConfirmation;
  palette.scratchRefineApplied = false;
  return true;
}

export function failPromptPaletteScratchRefinement(
  palette: PromptPaletteRuntime,
  message?: string,
  generation?: number,
  sourceText?: string,
) {
  if (
    generation !== undefined
    && !isPromptPaletteScratchRefinementCurrent(palette, generation, sourceText)
  ) {
    return false;
  }
  clearPromptPaletteScratchRefinement(palette);
  palette.launcherMode = "scratch";
  palette.scratchRefineError = message?.trim() || "Meta Prompting failed. Try again.";
  return true;
}

export function acceptPromptPaletteScratchRefinement(
  palette: PromptPaletteRuntime,
) {
  const resultText = palette.scratchRefineResultText;
  if (!resultText) return false;
  palette.scratchText = resultText;
  palette.scratchMetaConfirmRequired = palette.scratchRefineResultRequiresConfirmation;
  palette.scratchMetaConfirmPending = false;
  palette.scratchNotice = null;
  palette.launcherMode = "scratch";
  palette.scratchRefineApplied = true;
  return true;
}

export function restorePromptPaletteScratchRefinementSource(
  palette: PromptPaletteRuntime,
) {
  const sourceText = palette.scratchRefineSourceText;
  if (sourceText === null) return false;
  const sourceRequiresConfirmation = palette.scratchRefineSourceRequiresConfirmation;
  palette.scratchText = sourceText;
  palette.scratchMetaConfirmRequired = sourceRequiresConfirmation;
  palette.scratchMetaConfirmPending = false;
  palette.scratchNotice = null;
  palette.launcherMode = "scratch";
  clearPromptPaletteScratchRefinement(palette);
  return true;
}

export function clearPromptPaletteScratchRefinement(
  palette: PromptPaletteRuntime,
) {
  palette.scratchRefining = false;
  palette.scratchRefineSourceText = null;
  palette.scratchRefineSourceRequiresConfirmation = false;
  palette.scratchRefineResultText = null;
  palette.scratchRefineResultRequiresConfirmation = false;
  palette.scratchRefineApplied = false;
  if (palette.launcherMode === "refine") {
    palette.launcherMode = "scratch";
  }
}

export function isPromptPaletteScratchRefinementCurrent(
  palette: PromptPaletteRuntime,
  generation: number,
  sourceText?: string,
) {
  if (!palette.active) return false;
  if (palette.surfaceMode !== "scratch") return false;
  if (!palette.scratchRefining) return false;
  if (palette.scratchRefineGeneration !== generation) return false;
  if (sourceText !== undefined && palette.scratchRefineSourceText !== sourceText) {
    return false;
  }
  return true;
}

export function setPromptPaletteScratchMetaConfirmation(
  palette: PromptPaletteRuntime,
  required: boolean,
) {
  palette.scratchMetaConfirmRequired = required;
  palette.scratchMetaConfirmPending = false;
}
