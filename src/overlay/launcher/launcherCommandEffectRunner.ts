import {
  clearPromptPaletteLauncherFeedback,
  selectedPrompt,
  setPromptPaletteArtifactPanel,
  setPromptPaletteLauncherFeedback,
  setPromptPaletteLibraryFilter,
  setPromptPaletteOverlayMode,
  setPromptPaletteScratchText,
  setPromptPaletteSearchQuery,
  setPromptPaletteSelectedIndex,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import { native } from "../../native";
import { promptArtifactType } from "../../promptUtils";
import type {
  ProjectArtifactWriteKind,
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import type { PreparePromptOptions } from "../loaded/deliveryController";
import type { ArtifactCreateInitialValues } from "./artifactCreateState";
import {
  libraryDiagnosticsFromLoadResult,
  orderPaletteArtifacts,
  promptsFromLoadResult,
  userCommandsFromLoadResult,
} from "../shared/promptLoad";
import {
  addEphemeralContextCapture,
  syncClipFeedbackFromCatalog,
} from "./ephemeralContextState";
import { expiredEphemeralClipContextCount } from "./historyCommands";
import type { LauncherCommandEffect } from "./launcherCommandEffects";

export type PrepareSearchPrompt = (
  prompt: PromptDefinition,
  contextIds: string[],
  options?: PreparePromptOptions,
) => void;

export type OpenArtifactComposer = (
  kind: "new" | "edit" | "duplicate",
  artifactType: PromptArtifactType,
  artifactId?: string | null,
  initialId?: string | null,
  initialDraft?: PromptDefinition | null,
) => void;

export type OpenArtifactCreateCanvas = (
  artifactType: Extract<PromptArtifactType, "prompt" | "context">,
  initialId?: string | null,
  initialValues?: ArtifactCreateInitialValues,
) => void;

export type OpenGitHubImport = () => void;

export type OpenStarterPacks = () => void;

export type OpenProjectArtifactWrite = (
  writeKind: ProjectArtifactWriteKind,
  artifactId?: string | null,
) => void;

export type OpenProjectSetup = () => void;

export type LauncherCommandEffectRunnerOptions = {
  surface: HTMLElement;
  palette: PromptPaletteRuntime;
  effects: LauncherCommandEffect | LauncherCommandEffect[] | null;
  rerender: () => void;
  preparePrompt: PrepareSearchPrompt;
  openArtifactComposer?: OpenArtifactComposer;
  openArtifactCreateCanvas?: OpenArtifactCreateCanvas;
  openGitHubImport?: OpenGitHubImport;
  openProjectArtifactWrite?: OpenProjectArtifactWrite;
  openProjectSetup?: OpenProjectSetup;
  openStarterPacks?: OpenStarterPacks;
};

type LauncherCommandEffectRunnerContext = Omit<
  LauncherCommandEffectRunnerOptions,
  "effects"
> & {
  requestRerender: () => void;
  flush: () => void;
};

type LauncherCommandEffectRunnerMap = {
  [Effect in LauncherCommandEffect as Effect["type"]]: (
    effect: Effect,
    context: LauncherCommandEffectRunnerContext,
  ) => void;
};

const EFFECT_RUNNERS = {
  "prepare-prompt": (effect, context) => {
    context.flush();
    context.preparePrompt(effect.prompt, effect.contextIds, effect.options);
  },
  "open-launcher-mode": (effect, context) => {
    setPromptPaletteOverlayMode(context.surface, context.palette, "launcher", effect.mode);
    context.requestRerender();
  },
  "open-library-mode": (effect, context) => {
    setPromptPaletteOverlayMode(context.surface, context.palette, "launcher", "library");
    setPromptPaletteLibraryFilter(context.palette, effect.filter);
    context.requestRerender();
  },
  "set-scratch-text": (effect, context) => {
    setPromptPaletteScratchText(context.palette, effect.text);
    context.requestRerender();
  },
  "set-search-query": (effect, context) => {
    setPromptPaletteSearchQuery(context.palette, effect.query);
    context.requestRerender();
  },
  "feedback": (effect, context) => {
    setPromptPaletteLauncherFeedback(context.palette, effect.message, effect.tone);
    context.requestRerender();
  },
  "rerender": (_effect, context) => {
    context.flush();
  },
  "capture-clipboard-context": (_effect, context) => {
    context.flush();
    captureClipboardAsContext(context.surface, context.palette, context.rerender);
  },
  "reveal-skill-source": (effect, context) => {
    context.flush();
    revealSkillSource(context.palette, effect.artifactId, context.rerender);
  },
  "open-preferences": (_effect, context) => {
    context.flush();
    void native.openPreferences().catch(() => undefined);
    void native.unloadOverlay().catch(() => undefined);
  },
  "open-artifact-composer": (effect, context) => {
    context.flush();
    if (context.openArtifactComposer) {
      context.openArtifactComposer(
        effect.kind,
        effect.artifactType,
        null,
        effect.initialId ?? null,
      );
      return;
    }
    setPromptPaletteLauncherFeedback(context.palette, effect.fallbackMessage);
    context.requestRerender();
  },
  "open-artifact-create-canvas": (effect, context) => {
    context.flush();
    if (context.openArtifactCreateCanvas) {
      context.openArtifactCreateCanvas(
        effect.artifactType,
        effect.initialId ?? null,
        effect.initialValues,
      );
      return;
    }
    setPromptPaletteLauncherFeedback(context.palette, effect.fallbackMessage);
    context.requestRerender();
  },
  "open-github-import": (effect, context) => {
    context.flush();
    if (context.openGitHubImport) {
      context.openGitHubImport();
      return;
    }
    setPromptPaletteLauncherFeedback(context.palette, effect.fallbackMessage);
    context.requestRerender();
  },
  "open-starter-packs": (effect, context) => {
    context.flush();
    if (context.openStarterPacks) {
      context.openStarterPacks();
      return;
    }
    setPromptPaletteLauncherFeedback(context.palette, effect.fallbackMessage);
    context.requestRerender();
  },
  "open-skill-discovery": (effect, context) => {
    setPromptPaletteArtifactPanel(context.palette, {
      mode: "skill-discovery",
      intent: effect.intent,
    });
    context.requestRerender();
  },
  "open-skill-scaffold": (effect, context) => {
    setPromptPaletteArtifactPanel(context.palette, {
      mode: "skill-scaffold",
      initialId: effect.initialId ?? null,
    });
    context.requestRerender();
  },
  "open-project-write": (effect, context) => {
    context.flush();
    openSelectedProjectWrite(
      context.palette,
      effect,
      context.rerender,
      context.openProjectArtifactWrite,
    );
  },
  "open-project-setup": (effect, context) => {
    context.flush();
    if (context.openProjectSetup) {
      context.openProjectSetup();
      return;
    }
    setPromptPaletteSearchQuery(context.palette, effect.fallbackQuery);
    setPromptPaletteLauncherFeedback(context.palette, effect.fallbackMessage);
    context.requestRerender();
  },
  "open-workflow-input": (effect, context) => {
    setPromptPaletteArtifactPanel(context.palette, {
      mode: "workflow-input",
      status: "form",
      commandId: effect.commandId,
      inputText: "",
      contextHandleText: effect.contextHandleText,
      error: null,
    });
    context.requestRerender();
  },
  "open-recovery-panel": (effect, context) => {
    setPromptPaletteArtifactPanel(context.palette, {
      mode: "recovery",
      status: "ready",
      entry: effect.entry,
      error: null,
      message: null,
      exportPath: null,
    });
    context.requestRerender();
  },
  "clear-expired-contexts": (_effect, context) => {
    context.flush();
    clearExpiredContexts(context.palette, context.rerender);
  },
  "open-library-folder": (_effect, context) => {
    context.flush();
    openLibraryFolder(context.palette, context.rerender);
  },
} satisfies LauncherCommandEffectRunnerMap;

export function applyLauncherCommandEffects(options: LauncherCommandEffectRunnerOptions) {
  const queue = Array.isArray(options.effects)
    ? options.effects
    : options.effects
    ? [options.effects]
    : [];
  let shouldRerender = false;
  const context: LauncherCommandEffectRunnerContext = {
    ...options,
    requestRerender: () => {
      shouldRerender = true;
    },
    flush: () => {
      if (!shouldRerender) return;
      shouldRerender = false;
      options.rerender();
    },
  };

  for (const effect of queue) {
    const runner = EFFECT_RUNNERS[effect.type] as (
      effect: LauncherCommandEffect,
      context: LauncherCommandEffectRunnerContext,
    ) => void;
    runner(effect, context);
  }

  context.flush();
}

function captureClipboardAsContext(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  setPromptPaletteLauncherFeedback(palette, "Capturing clipboard...");
  rerender();
  void native.captureEphemeralContext()
    .then((capture) => {
      addEphemeralContextCapture(palette, capture);
      clearPromptPaletteLauncherFeedback(palette);
      setPromptPaletteOverlayMode(surface, palette, "launcher", "stack");
      rerender();
    })
    .catch((error) => {
      setPromptPaletteLauncherFeedback(
        palette,
        clipboardCaptureErrorMessage(error),
        "warning",
      );
      rerender();
    });
}

function revealSkillSource(
  palette: PromptPaletteRuntime,
  artifactId: string,
  rerender: () => void,
) {
  void native.revealInterventionSource(artifactId)
    .then(() => native.unloadOverlay().catch(() => undefined))
    .catch((error) => {
      setPromptPaletteLauncherFeedback(
        palette,
        skillRevealErrorMessage(error),
        "warning",
      );
      rerender();
    });
}

function openSelectedProjectWrite(
  palette: PromptPaletteRuntime,
  effect: Extract<LauncherCommandEffect, { type: "open-project-write" }>,
  rerender: () => void,
  openProjectArtifactWrite?: OpenProjectArtifactWrite,
) {
  const artifact = projectWriteArtifactForCommand(
    palette,
    effect.artifactId ?? null,
    effect.artifactType,
  );
  if (!artifact || (effect.artifactType && promptArtifactType(artifact) !== effect.artifactType)) {
    setPromptPaletteLauncherFeedback(palette, effect.unavailableMessage, "warning");
    rerender();
    return;
  }
  if (openProjectArtifactWrite) {
    openProjectArtifactWrite(effect.writeKind, artifact.id);
  } else {
    setPromptPaletteLauncherFeedback(palette, effect.fallbackMessage);
    rerender();
  }
}

function openLibraryFolder(
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  setPromptPaletteLauncherFeedback(palette, "Opening Personal Library folder...");
  rerender();
  void native.openInterventionLibraryFolder()
    .then(() => {
      setPromptPaletteLauncherFeedback(palette, "Personal Library folder opened.");
      rerender();
    })
    .catch((error) => {
      setPromptPaletteLauncherFeedback(
        palette,
        libraryRevealErrorMessage(error),
        "warning",
      );
      rerender();
    });
}

function clearExpiredContexts(
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  const expiredCount = expiredEphemeralClipContextCount(palette.prompts);
  setPromptPaletteLauncherFeedback(palette, "Clearing expired contexts...");
  rerender();
  void native.reloadInterventionLibrary()
    .then((result) => {
      palette.prompts = orderPaletteArtifacts(
        promptsFromLoadResult(result),
        palette.usageHistory,
        palette.appSettings.pinned_artifact_ids,
      );
      palette.userCommands = userCommandsFromLoadResult(result);
      palette.launcherLibraryDiagnostics = libraryDiagnosticsFromLoadResult(result);
      setPromptPaletteSelectedIndex(
        palette,
        Math.min(palette.selectedIndex, Math.max(0, palette.prompts.length - 1)),
      );
      syncClipFeedbackFromCatalog(palette);
      setPromptPaletteLauncherFeedback(
        palette,
        expiredCount > 0
          ? `Cleared ${expiredCount} expired context${expiredCount === 1 ? "" : "s"}.`
          : "No expired contexts found.",
      );
      rerender();
    })
    .catch((error) => {
      setPromptPaletteLauncherFeedback(
        palette,
        expiredContextCleanupErrorMessage(error),
        "warning",
      );
      rerender();
    });
}

function clipboardCaptureErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Clipboard could not be captured.";
}

function skillRevealErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Skill source could not be opened.";
}

function libraryRevealErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Personal Library folder could not be opened.";
}

function expiredContextCleanupErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Expired contexts could not be cleared.";
}

function projectWriteArtifactForCommand(
  palette: PromptPaletteRuntime,
  artifactId: string | null,
  artifactType: PromptArtifactType | null,
) {
  if (artifactId) {
    const explicit = palette.prompts.find((prompt) => prompt.id === artifactId) ?? null;
    if (!explicit || (artifactType && promptArtifactType(explicit) !== artifactType)) {
      return null;
    }
    return explicit;
  }

  const selected = selectedPrompt(palette) ?? null;
  if (!selected || (artifactType && promptArtifactType(selected) !== artifactType)) {
    return null;
  }
  return selected;
}
