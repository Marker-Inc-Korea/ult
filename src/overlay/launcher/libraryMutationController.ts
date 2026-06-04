import { native } from "../../native";
import {
  setPromptPaletteArtifactPanel,
  setPromptPaletteLauncherFeedback,
  setPromptPaletteSelectedIndex,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import { artifactHandle } from "../../promptUtils";
import type { PromptDefinition, PromptLoadResult } from "../../types";
import { syncInterventionShortcutsFromNative } from "../shared/nativeOverlaySync";
import {
  libraryDiagnosticsFromLoadResult,
  orderPaletteArtifacts,
  promptsFromLoadResult,
  userCommandsFromLoadResult,
} from "../shared/promptLoad";
import { selectedLauncherArtifact } from "./artifactSelection";

export type ApplyLibraryResult = (
  result: PromptLoadResult,
  selectedArtifactId: string | null,
) => void;

export function createLibraryMutationController(options: {
  palette: PromptPaletteRuntime;
  rerender: () => void;
}) {
  const { palette, rerender } = options;

  const applyLibraryResult: ApplyLibraryResult = (
    result,
    selectedArtifactId,
  ) => {
    palette.prompts = orderPaletteArtifacts(
      promptsFromLoadResult(result),
      palette.usageHistory,
      palette.appSettings.pinned_artifact_ids,
    );
    palette.userCommands = userCommandsFromLoadResult(result);
    palette.launcherLibraryDiagnostics = libraryDiagnosticsFromLoadResult(result);
    if (selectedArtifactId) {
      const nextIndex = palette.prompts.findIndex((prompt) =>
        prompt.id === selectedArtifactId,
      );
      if (nextIndex >= 0) {
        setPromptPaletteSelectedIndex(palette, nextIndex);
      }
    } else {
      setPromptPaletteSelectedIndex(
        palette,
        Math.min(palette.selectedIndex, Math.max(0, palette.prompts.length - 1)),
      );
    }
    void syncInterventionShortcutsFromNative(palette);
  };

  const saveArtifactDraft = async (
    originalId: string | null,
    draft: PromptDefinition,
  ) => {
    const result = originalId
      ? await native.updateInterventionArtifact(originalId, draft)
      : await native.addInterventionArtifact(draft);
    applyLibraryResult(result, draft.id);
    setPromptPaletteArtifactPanel(palette, { mode: "reader", artifactId: draft.id });
    setPromptPaletteLauncherFeedback(palette, `Saved ${artifactHandle(draft)}.`);
    rerender();
  };

  const deleteArtifact = async (artifactId: string) => {
    const artifact = selectedLauncherArtifact(palette, artifactId);
    try {
      const result = await native.deleteInterventionArtifact(artifactId);
      applyLibraryResult(result, null);
      setPromptPaletteArtifactPanel(palette, null);
      setPromptPaletteLauncherFeedback(
        palette,
        artifact ? `Deleted ${artifactHandle(artifact)}.` : "Artifact deleted.",
      );
      rerender();
    } catch (error) {
      setPromptPaletteArtifactPanel(palette, null);
      setPromptPaletteLauncherFeedback(
        palette,
        artifactMutationErrorMessage(error, "Artifact could not be deleted."),
        "warning",
      );
      rerender();
    }
  };

  return {
    applyLibraryResult,
    saveArtifactDraft,
    deleteArtifact,
  };
}

function artifactMutationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}
