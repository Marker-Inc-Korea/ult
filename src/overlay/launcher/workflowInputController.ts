import { native } from "../../native";
import {
  setPromptPaletteArtifactPanel,
  setPromptPaletteLauncherFeedback,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import { composerContextIds } from "../../searchComposer";
import type { PromptDefinition, PromptLoadResult } from "../../types";
import type { PrepareSearchPrompt } from "./searchController";
import {
  agentWorkflowInputDefinitionForCommandId,
  agentWorkflowPromptForCommandId,
  type AgentWorkflowPromptCommandId,
} from "./agentWorkflowCommands";

export function createWorkflowInputController(options: {
  palette: PromptPaletteRuntime;
  rerender: () => void;
  applyLibraryResult: (result: PromptLoadResult, selectedArtifactId: string | null) => void;
  preparePrompt: PrepareSearchPrompt;
}) {
  const {
    palette,
    rerender,
    applyLibraryResult,
    preparePrompt,
  } = options;

  const submitWorkflowInput = async (
    commandId: string,
    inputText: string,
    contextHandleText: string,
  ) => {
    const definition = agentWorkflowInputDefinitionForCommandId(commandId);
    const workflowPrompt = definition
      ? agentWorkflowPromptForCommandId(
        definition.id as AgentWorkflowPromptCommandId,
        palette.prompts,
      )
      : null;
    if (!definition || !workflowPrompt) {
      setPromptPaletteLauncherFeedback(palette, "Workflow command is no longer available.", "warning");
      setPromptPaletteArtifactPanel(palette, null);
      rerender();
      return;
    }

    const trimmedInput = inputText.trim();
    const contextIds = composerContextIds(contextHandleText, palette.prompts);
    if (!trimmedInput) {
      setPromptPaletteArtifactPanel(palette, null);
      preparePrompt(workflowPrompt, contextIds);
      return;
    }

    setPromptPaletteArtifactPanel(palette, {
      mode: "workflow-input",
      status: "saving",
      commandId,
      inputText,
      contextHandleText,
      error: null,
    });
    rerender();

    try {
      const saved = await native.saveWorkflowInputContext(trimmedInput, definition.title);
      applyLibraryResult(saved.library, saved.artifact.id);
      const nextContextIds = mergeContextIds(contextIds, saved.artifact);
      setPromptPaletteArtifactPanel(palette, null);
      preparePrompt(workflowPrompt, nextContextIds);
    } catch (error) {
      setPromptPaletteArtifactPanel(palette, {
        mode: "workflow-input",
        status: "form",
        commandId,
        inputText,
        contextHandleText,
        error: workflowInputErrorMessage(error),
      });
      rerender();
    }
  };

  return {
    submitWorkflowInput,
  };
}

function mergeContextIds(contextIds: string[], artifact: PromptDefinition) {
  return [...contextIds, artifact.id].filter((id, index, ids) =>
    ids.indexOf(id) === index
  );
}

function workflowInputErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Workflow input could not be saved.";
}
