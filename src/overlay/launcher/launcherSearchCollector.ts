import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  canonicalArtifactHandle,
  promptArtifactType,
} from "../../promptUtils";
import type {
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import { isAgentWorkflowPromptCommandId } from "./agentWorkflowCommands";
import { BASE_COMMANDS } from "./launcherCommandDefinitions";
import type { LauncherCommand } from "./launcherCommandTypes";
import type {
  LauncherIndexedCommandItem,
  LauncherIndexedItem,
} from "./launcherSearchTypes";
import { userLauncherCommands } from "./userLauncherCommands";

export function collectLauncherIndexedItems(
  palette: PromptPaletteRuntime,
): LauncherIndexedItem[] {
  const userCommands = userLauncherCommands(palette);
  const localWorkflowCommandIds = new Set(
    userCommands
      .map((command) => command.userCommand?.id ?? "")
      .filter(isAgentWorkflowPromptCommandId),
  );
  return [
    ...palette.prompts.map((prompt, promptIndex) =>
      artifactIndexedItem(prompt, promptIndex)
    ),
    ...BASE_COMMANDS
      .filter((command) =>
        !isAgentWorkflowPromptCommandId(command.id)
        || !localWorkflowCommandIds.has(command.id)
      )
      .map(commandIndexedItem),
    ...userCommands.map(commandIndexedItem),
  ];
}

export function commandIndexedItem(
  command: LauncherCommand,
): LauncherIndexedCommandItem {
  const id = command.userCommand?.id ?? command.id;
  return {
    type: commandItemType(command),
    key: `command:${id}`,
    command,
    handle: `/${id}`,
    title: command.label,
    keywords: command.keywords ?? [],
    aliases: command.aliases ?? [],
  };
}

function artifactIndexedItem(
  prompt: PromptDefinition,
  promptIndex: number,
): LauncherIndexedItem {
  const artifactType = promptArtifactType(prompt);
  return {
    type: artifactIndexedItemType(artifactType),
    key: `${artifactType}:${prompt.id}`,
    prompt,
    promptIndex,
    handle: canonicalArtifactHandle(prompt),
    title: prompt.title,
    artifactType,
  };
}

function artifactIndexedItemType(artifactType: PromptArtifactType) {
  if (artifactType === "context") return "context-artifact";
  if (artifactType === "skill") return "skill-package";
  return "prompt-artifact";
}

function commandItemType(
  command: LauncherCommand,
): Extract<LauncherIndexedItem["type"], `${string}-command`> {
  if (command.id === "user-command") return "user-defined-command";
  if (command.category === "Workflow") return "workflow-command";
  if (
    command.category === "History"
    || command.category === "Settings"
    || command.id === "open-library"
    || command.id === "clear-expired-contexts"
    || command.id === "reveal-last-failed-delivery"
  ) {
    return "recovery-system-command";
  }
  return "built-in-command";
}
