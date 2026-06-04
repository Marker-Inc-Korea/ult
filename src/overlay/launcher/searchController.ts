import {
  selectedPrompt,
  setPromptPaletteLauncherFeedback,
  setPromptPaletteSearchQuery,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import type { LauncherCommand } from "./launcherCommands";
import {
  isDeliverableArtifact,
  promptArtifactType,
} from "../../promptUtils";
import {
  composerContextIds,
  composerPrompt,
  searchQueryWithHandle,
} from "../../searchComposer";
import type { PromptDefinition } from "../../types";
import {
  launcherCommandCapability,
} from "./launcherCommandCapabilities";
import {
  applyLauncherCommandEffects,
  type OpenArtifactComposer,
  type OpenGitHubImport,
  type OpenProjectArtifactWrite,
  type OpenProjectSetup,
  type OpenStarterPacks,
  type PrepareSearchPrompt,
} from "./launcherCommandEffectRunner";
import { selectedLauncherRow } from "./launcherRows";

export type {
  OpenArtifactComposer,
  OpenGitHubImport,
  OpenProjectArtifactWrite,
  OpenProjectSetup,
  OpenStarterPacks,
  PrepareSearchPrompt,
} from "./launcherCommandEffectRunner";

export type SelectedLauncherSearchAction =
  | { type: "command"; command: LauncherCommand }
  | { type: "artifact"; prompt: PromptDefinition; promptIndex: number }
  | { type: "composer" };

export function selectedLauncherSearchAction(
  palette: PromptPaletteRuntime,
): SelectedLauncherSearchAction {
  const row = selectedLauncherRow(palette);
  if (!row) return { type: "composer" };
  if (row.kind === "command") {
    return { type: "command", command: row.command };
  }
  if (row.command) {
    return { type: "command", command: row.command };
  }
  return {
    type: "artifact",
    prompt: row.prompt,
    promptIndex: row.promptIndex,
  };
}

export function loadSearchSelectionOrPrompt(
  palette: PromptPaletteRuntime,
  prompt: PromptDefinition | null,
  rerender: () => void,
  preparePrompt: PrepareSearchPrompt,
) {
  if (!prompt) {
    applySearchComposer(palette, rerender, preparePrompt);
    return;
  }

  const artifactType = promptArtifactType(prompt);
  if (!isDeliverableArtifact(prompt)) {
    reportSkillDeliveryBlocked(palette, rerender);
    return;
  }

  if (artifactType === "context") {
    const nextQuery = searchQueryWithHandle(palette.searchQuery, prompt);
    const composer = composerPrompt(nextQuery, palette.prompts);
    if (composer) {
      if (!isDeliverableArtifact(composer)) {
        reportSkillDeliveryBlocked(palette, rerender);
        return;
      }
      preparePrompt(
        composer,
        composerContextIds(nextQuery, palette.prompts),
      );
      return;
    }
    preparePrompt(prompt, []);
    return;
  }

  preparePrompt(
    prompt,
    composerContextIds(palette.searchQuery, palette.prompts),
  );
}

export function updateSearchQueryWithHandle(
  palette: PromptPaletteRuntime,
  prompt: PromptDefinition,
  rerender: () => void,
) {
  const nextQuery = searchQueryWithHandle(palette.searchQuery, prompt);
  if (!setPromptPaletteSearchQuery(palette, nextQuery)) return;
  rerender();
}

export function applySearchComposer(
  palette: PromptPaletteRuntime,
  rerender: () => void,
  preparePrompt: PrepareSearchPrompt,
) {
  const prompt = composerPrompt(palette.searchQuery, palette.prompts);
  const contextIds = composerContextIds(palette.searchQuery, palette.prompts);
  if (!prompt) {
    if (contextIds.length === 1) {
      const context = palette.prompts.find((entry) =>
        entry.id === contextIds[0] && promptArtifactType(entry) === "context",
      );
      if (context) {
        preparePrompt(context, []);
        return;
      }
    }
    const selected = selectedPrompt(palette);
    if (
      selected
      && promptArtifactType(selected) !== "context"
      && isDeliverableArtifact(selected)
    ) {
      updateSearchQueryWithHandle(palette, selected, rerender);
      return;
    }
    return;
  }

  if (!isDeliverableArtifact(prompt)) {
    reportSkillDeliveryBlocked(palette, rerender);
    return;
  }

  preparePrompt(prompt, contextIds);
}

export function runLauncherCommand(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  command: LauncherCommand,
  rerender: () => void,
  preparePrompt: PrepareSearchPrompt,
  openArtifactComposer?: OpenArtifactComposer,
  openGitHubImport?: OpenGitHubImport,
  openProjectArtifactWrite?: OpenProjectArtifactWrite,
  openProjectSetup?: OpenProjectSetup,
  openStarterPacks?: OpenStarterPacks,
) {
  const effects = launcherCommandCapability(command).execute({
    palette,
    command,
  });
  applyLauncherCommandEffects({
    surface,
    palette,
    effects,
    rerender,
    preparePrompt,
    openArtifactComposer,
    openGitHubImport,
    openProjectArtifactWrite,
    openProjectSetup,
    openStarterPacks,
  });
}

function reportSkillDeliveryBlocked(
  palette: PromptPaletteRuntime,
  rerender: () => void,
) {
  setPromptPaletteLauncherFeedback(
    palette,
    "Skills open their SKILL.md source and cannot be loaded for delivery.",
    "warning",
  );
  rerender();
}
