import {
  selectedPrompt,
  setPromptPaletteArtifactPanel,
  setPromptPaletteLauncherFeedback,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";

export function selectedLauncherArtifact(
  palette: PromptPaletteRuntime,
  artifactId?: string | null,
) {
  const id = artifactId?.trim();
  if (id) return palette.prompts.find((prompt) => prompt.id === id) ?? null;
  return selectedPrompt(palette) ?? null;
}

export function reportLauncherArtifactUnavailable(
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  setPromptPaletteArtifactPanel(palette, null);
  setPromptPaletteLauncherFeedback(palette, "Item is no longer available.", "warning");
  rerender();
}
