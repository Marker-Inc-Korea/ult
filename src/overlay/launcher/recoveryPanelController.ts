import { native } from "../../native";
import {
  setPromptPaletteArtifactPanel,
  setPromptPaletteLauncherFeedback,
  setPromptPaletteLoadedDeliveryMode,
  type LauncherArtifactPanel,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import {
  artifactHandle,
  isDeliverableArtifact,
  isNonExpiredArtifact,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type {
  LauncherRecoveryActionId,
} from "../shared/renderTypes";

type RecoveryPanel = Extract<LauncherArtifactPanel, { mode: "recovery" }>;

export type PrepareRecoveryPrompt = (
  prompt: PromptDefinition,
  contextIds: string[],
) => void;

export function createRecoveryPanelController(options: {
  palette: PromptPaletteRuntime;
  rerender: () => void;
  preparePrompt: PrepareRecoveryPrompt;
}) {
  const {
    palette,
    rerender,
    preparePrompt,
  } = options;

  const runRecoveryAction = (actionId: LauncherRecoveryActionId) => {
    const panel = currentRecoveryPanel(palette);
    if (!panel) return;
    const artifact = panel.entry.prompt_id
      ? palette.prompts.find((entry) => entry.id === panel.entry.prompt_id) ?? null
      : null;

    if (actionId === "prepare-again") {
      prepareArtifactAgain(panel, artifact);
      return;
    }
    if (actionId === "retry-copy") {
      retryArtifactAsCopy(panel, artifact);
      return;
    }
    if (actionId === "reveal-source") {
      revealArtifactSource(panel, artifact);
      return;
    }
    if (actionId === "open-accessibility") {
      openAccessibilityGuidance(panel);
      return;
    }
    if (actionId === "export-diagnostics") {
      exportDiagnostics(panel);
    }
  };

  const prepareArtifactAgain = (
    panel: RecoveryPanel,
    artifact: PromptDefinition | null,
  ) => {
    if (!canPrepareRecoveryArtifact(artifact)) {
      updateRecoveryPanel(panel, {
        error: "The failed artifact is no longer available for preparation.",
        message: null,
      });
      return;
    }
    setPromptPaletteArtifactPanel(palette, null);
    preparePrompt(artifact, []);
  };

  const retryArtifactAsCopy = (
    panel: RecoveryPanel,
    artifact: PromptDefinition | null,
  ) => {
    if (!canPrepareRecoveryArtifact(artifact)) {
      updateRecoveryPanel(panel, {
        error: "The failed artifact is no longer available for Copy retry.",
        message: null,
      });
      return;
    }
    setPromptPaletteArtifactPanel(palette, null);
    preparePrompt(artifact, []);
    if (palette.surfaceMode === "loaded") {
      setPromptPaletteLoadedDeliveryMode(palette, "copy");
      rerender();
    }
  };

  const revealArtifactSource = (
    panel: RecoveryPanel,
    artifact: PromptDefinition | null,
  ) => {
    if (!artifact) {
      updateRecoveryPanel(panel, {
        error: "The failed artifact source is no longer available.",
        message: null,
      });
      return;
    }
    updateRecoveryPanel(panel, {
      error: null,
      message: `Opening source for ${artifactHandle(artifact)}...`,
    });
    void native.revealInterventionSource(artifact.id)
      .then(() => {
        const current = currentRecoveryPanel(palette);
        if (!current) return;
        updateRecoveryPanel(current, {
          error: null,
          message: `Source opened for ${artifactHandle(artifact)}.`,
        });
      })
      .catch((error) => {
        const current = currentRecoveryPanel(palette);
        if (!current) return;
        updateRecoveryPanel(current, {
          error: recoveryActionErrorMessage(error, "Source could not be opened."),
          message: null,
        });
      });
  };

  const openAccessibilityGuidance = (panel: RecoveryPanel) => {
    if (panel.entry.diagnostic_code !== "accessibility-required") {
      updateRecoveryPanel(panel, {
        error: "Accessibility guidance is only available for permission failures.",
        message: null,
      });
      return;
    }
    setPromptPaletteLauncherFeedback(palette, "Opening Accessibility guidance...");
    rerender();
    void native.openPreferences()
      .then(() => {
        setPromptPaletteLauncherFeedback(palette, "Accessibility guidance opened.");
        rerender();
      })
      .catch((error) => {
        setPromptPaletteLauncherFeedback(
          palette,
          recoveryActionErrorMessage(error, "Accessibility guidance could not be opened."),
          "warning",
        );
        rerender();
      });
  };

  const exportDiagnostics = (panel: RecoveryPanel) => {
    updateRecoveryPanel(panel, {
      status: "exporting",
      error: null,
      message: "Exporting diagnostics...",
      exportPath: null,
    });
    void native.exportAppDiagnostics()
      .then((result) => {
        const current = currentRecoveryPanel(palette);
        if (!current) return;
        updateRecoveryPanel(current, {
          status: "ready",
          error: null,
          message: `Diagnostics exported with ${result.failure_count} failure record${result.failure_count === 1 ? "" : "s"}.`,
          exportPath: result.file_path,
        });
      })
      .catch((error) => {
        const current = currentRecoveryPanel(palette);
        if (!current) return;
        updateRecoveryPanel(current, {
          status: "ready",
          error: recoveryActionErrorMessage(error, "Diagnostics could not be exported."),
          message: null,
          exportPath: null,
        });
      });
  };

  const updateRecoveryPanel = (
    panel: RecoveryPanel,
    updates: Partial<RecoveryPanel>,
  ) => {
    setPromptPaletteArtifactPanel(palette, {
      ...panel,
      ...updates,
    });
    rerender();
  };

  return {
    runRecoveryAction,
  };
}

function currentRecoveryPanel(palette: PromptPaletteRuntime) {
  const panel = palette.launcherArtifactPanel;
  return panel?.mode === "recovery" ? panel : null;
}

function canPrepareRecoveryArtifact(
  artifact: PromptDefinition | null,
): artifact is PromptDefinition {
  return Boolean(artifact && isDeliverableArtifact(artifact) && isNonExpiredArtifact(artifact));
}

function recoveryActionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}
