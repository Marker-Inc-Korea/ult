import {
  artifactHandle,
  contextArtifactHandle,
  promptArtifactHandle,
  promptArtifactType,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { LauncherCommand } from "./launcherCommandTypes";

export function libraryDependencyHandlesForArtifact(
  prompt: PromptDefinition,
  prompts: PromptDefinition[],
) {
  if (promptArtifactType(prompt) !== "prompt") return [];
  const byId = new Map(prompts.map((entry) => [entry.id, entry]));
  return (prompt.contexts ?? [])
    .map((id) => byId.get(id) ? artifactHandle(byId.get(id)!) : contextArtifactHandle(id));
}

export function libraryDependencyHandlesForCommand(
  command: LauncherCommand,
) {
  const userCommand = command.userCommand;
  if (!userCommand) return [];
  return [
    promptArtifactHandle(userCommand.prompt_id),
    ...userCommand.contexts.map(contextArtifactHandle),
  ];
}
