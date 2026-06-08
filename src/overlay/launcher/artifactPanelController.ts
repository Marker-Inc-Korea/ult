import { native } from "../../native";
import {
  positionPromptPalette,
  setPromptPaletteArtifactPanel,
  setPromptPaletteLauncherFeedback,
  setPromptPaletteOverlayMode,
  setPromptPaletteScratchText,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import {
  artifactHandle,
  isDeliverableArtifact,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import type {
  ProjectArtifactWriteKind,
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import type { LauncherArtifactActionId } from "../shared/renderTypes";
import type { ApplyLibraryResult } from "./libraryMutationController";
import {
  reportLauncherArtifactUnavailable,
  selectedLauncherArtifact,
} from "./artifactSelection";
import {
  createLauncherArtifactCreatePanel,
  type ArtifactCreateInitialValues,
} from "./artifactCreateState";

export type PrepareSearchPrompt = (
  prompt: PromptDefinition,
  contextIds: string[],
) => void;

export type OpenProjectArtifactWrite = (
  writeKind: ProjectArtifactWriteKind,
  artifactId?: string | null,
) => void;

export function createArtifactPanelController(options: {
  surface: HTMLElement;
  palette: PromptPaletteRuntime;
  rerender: () => void;
  preparePrompt: PrepareSearchPrompt;
  openProjectArtifactWrite: OpenProjectArtifactWrite;
  applyLibraryResult: ApplyLibraryResult;
}) {
  const {
    surface,
    palette,
    rerender,
    preparePrompt,
    openProjectArtifactWrite,
    applyLibraryResult,
  } = options;

  const openArtifactPanel = (
    mode: "reader" | "actions",
    artifactId?: string | null,
  ) => {
    const artifact = selectedLauncherArtifact(palette, artifactId);
    if (!artifact) {
      reportLauncherArtifactUnavailable(palette, rerender);
      return;
    }
    if (!setPromptPaletteArtifactPanel(palette, { mode, artifactId: artifact.id })) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const closeArtifactPanel = () => {
    if (!setPromptPaletteArtifactPanel(palette, null)) return;
    rerender();
  };

  const revealArtifactSource = (artifact: PromptDefinition) => {
    setPromptPaletteArtifactPanel(palette, null);
    setPromptPaletteLauncherFeedback(
      palette,
      `Opening source for ${artifactHandle(artifact)}...`,
    );
    rerender();
    void native.revealInterventionSource(artifact.id)
      .then(() => {
        setPromptPaletteLauncherFeedback(
          palette,
          `Source opened for ${artifactHandle(artifact)}.`,
        );
        rerender();
      })
      .catch((error) => {
        setPromptPaletteLauncherFeedback(
          palette,
          artifactRevealErrorMessage(error),
          "warning",
        );
        rerender();
      });
  };

  const openArtifactComposer = (
    kind: "new" | "edit" | "duplicate",
    artifactType: PromptArtifactType,
    artifactId?: string | null,
    initialId?: string | null,
    initialDraft?: PromptDefinition | null,
  ) => {
    const source = artifactId ? selectedLauncherArtifact(palette, artifactId) : null;
    if ((kind === "edit" || kind === "duplicate") && !source) {
      reportLauncherArtifactUnavailable(palette, rerender);
      return;
    }
    const panel: Extract<
      PromptPaletteRuntime["launcherArtifactPanel"],
      { mode: "composer" }
    > = {
      mode: "composer",
      kind,
      artifactType: source ? promptArtifactType(source) : artifactType,
      artifactId: source?.id ?? artifactId ?? null,
      initialId: initialId ?? null,
    };
    if (initialDraft) {
      panel.initialDraft = initialDraft;
    }
    if (!setPromptPaletteArtifactPanel(palette, panel)) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const openArtifactCreateCanvas = (
    artifactType: Extract<PromptArtifactType, "prompt" | "context">,
    initialId?: string | null,
    initialValues?: ArtifactCreateInitialValues,
  ) => {
    if (!setPromptPaletteArtifactPanel(
      palette,
      createLauncherArtifactCreatePanel(artifactType, initialId, initialValues),
    )) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const openArtifactDelete = (artifactId?: string | null) => {
    const artifact = selectedLauncherArtifact(palette, artifactId);
    if (!artifact) {
      reportLauncherArtifactUnavailable(palette, rerender);
      return;
    }
    if (!setPromptPaletteArtifactPanel(palette, {
      mode: "delete",
      artifactId: artifact.id,
    })) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const runArtifactAction = (
    actionId: LauncherArtifactActionId,
    artifactId?: string | null,
  ) => {
    const artifact = selectedLauncherArtifact(palette, artifactId);
    if (!artifact) {
      reportLauncherArtifactUnavailable(palette, rerender);
      return;
    }
    if (actionId === "read") {
      openArtifactPanel("reader", artifact.id);
      return;
    }
    if (actionId === "copy-handle") {
      copyArtifactText(artifactHandle(artifact), `Copied ${artifactHandle(artifact)}.`);
      return;
    }
    if (actionId === "copy-body") {
      copyArtifactText(
        artifact.prompt,
        promptArtifactType(artifact) === "skill"
          ? `Copied source for ${artifactHandle(artifact)}.`
          : `Copied body for ${artifactHandle(artifact)}.`,
      );
      return;
    }
    if (actionId === "toggle-pin") {
      togglePromptPin(artifact);
      return;
    }
    if (actionId === "duplicate-scratch") {
      duplicateArtifactAsScratch(artifact);
      return;
    }
    if (actionId === "reveal") {
      revealArtifactSource(artifact);
      return;
    }
    if (actionId === "edit") {
      openArtifactComposer("edit", promptArtifactType(artifact), artifact.id);
      return;
    }
    if (actionId === "duplicate") {
      openArtifactComposer("duplicate", promptArtifactType(artifact), artifact.id);
      return;
    }
    if (actionId === "delete") {
      openArtifactDelete(artifact.id);
      return;
    }
    if (actionId === "export-project") {
      openProjectArtifactWrite(projectWriteKindForArtifact(artifact), artifact.id);
      return;
    }
    if (actionId === "install-project") {
      openProjectArtifactWrite("skill", artifact.id);
      return;
    }
    if (actionId === "agents-snippet") {
      openProjectArtifactWrite("agents-snippet", artifact.id);
      return;
    }
    if (!isDeliverableArtifact(artifact)) {
      setPromptPaletteArtifactPanel(palette, null);
      setPromptPaletteLauncherFeedback(
        palette,
        "Skills open their SKILL.md source and cannot be loaded for delivery.",
        "warning",
      );
      rerender();
      return;
    }
    preparePrompt(artifact, []);
  };

  const copyArtifactText = (text: string, successMessage: string) => {
    const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard;
    const write = clipboard?.writeText(text)
      ?? Promise.reject(new Error("Clipboard is unavailable."));
    void write
      .then(() => {
        setPromptPaletteArtifactPanel(palette, null);
        setPromptPaletteLauncherFeedback(palette, successMessage);
        rerender();
      })
      .catch((error) => {
        setPromptPaletteArtifactPanel(palette, null);
        setPromptPaletteLauncherFeedback(
          palette,
          artifactClipboardErrorMessage(error),
          "warning",
        );
        rerender();
      });
  };

  const togglePromptPin = (artifact: PromptDefinition) => {
    if (
      promptArtifactType(artifact) !== "prompt"
      || promptScope(artifact) !== "persistent"
      || artifact.registry_editable === false
    ) {
      setPromptPaletteLauncherFeedback(
        palette,
        "Only editable persistent prompts can be pinned.",
        "warning",
      );
      rerender();
      return;
    }

    const nextPinned = !artifact.pinned;
    void native.updateInterventionArtifact(artifact.id, {
      ...artifact,
      pinned: nextPinned,
    })
      .then((result) => {
        applyLibraryResult(result, artifact.id);
        setPromptPaletteArtifactPanel(palette, { mode: "actions", artifactId: artifact.id });
        setPromptPaletteLauncherFeedback(
          palette,
          `${nextPinned ? "Pinned" : "Unpinned"} ${artifactHandle(artifact)}.`,
        );
        rerender();
      })
      .catch((error) => {
        setPromptPaletteArtifactPanel(palette, null);
        setPromptPaletteLauncherFeedback(
          palette,
          artifactMutationErrorMessage(error, "Prompt pin state could not be updated."),
          "warning",
        );
        rerender();
      });
  };

  const duplicateArtifactAsScratch = (artifact: PromptDefinition) => {
    if (!isDeliverableArtifact(artifact)) {
      setPromptPaletteArtifactPanel(palette, null);
      setPromptPaletteLauncherFeedback(
        palette,
        "Skills open their SKILL.md source and cannot become scratch prompts.",
        "warning",
      );
      rerender();
      return;
    }
    setPromptPaletteOverlayMode(surface, palette, "launcher", "scratch");
    setPromptPaletteScratchText(palette, artifact.prompt);
    palette.scratchNotice = `Duplicated ${artifactHandle(artifact)} as scratch.`;
    rerender();
  };

  return {
    openArtifactPanel,
    closeArtifactPanel,
    openArtifactComposer,
    openArtifactCreateCanvas,
    openArtifactDelete,
    runArtifactAction,
  };
}

function projectWriteKindForArtifact(
  artifact: PromptDefinition,
): Extract<ProjectArtifactWriteKind, "prompt" | "context"> {
  return promptArtifactType(artifact) === "context" ? "context" : "prompt";
}

function artifactRevealErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Artifact source could not be opened.";
}

function artifactClipboardErrorMessage(error: unknown) {
  return artifactMutationErrorMessage(error, "Clipboard could not be updated.");
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
