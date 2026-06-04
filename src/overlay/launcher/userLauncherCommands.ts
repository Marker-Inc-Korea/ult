import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { promptArtifactHandle } from "../../promptUtils";
import {
  agentWorkflowLocalPromptForCommandId,
  isAgentWorkflowPromptCommandId,
  WORKFLOW_PRIVACY_LABEL,
} from "./agentWorkflowCommands";
import type { LauncherCommand } from "./launcherCommandTypes";

export function userLauncherCommands(palette: PromptPaletteRuntime): LauncherCommand[] {
  return palette.userCommands.flatMap((command) => {
    const workflowCommandId = isAgentWorkflowPromptCommandId(command.id)
      ? command.id
      : null;
    if (
      workflowCommandId
      && !agentWorkflowLocalPromptForCommandId(palette.prompts, workflowCommandId)
    ) {
      return [];
    }
    const workflowCommand = Boolean(workflowCommandId);
    return {
      id: "user-command",
      label: command.title,
      description: command.description || `Run ${promptArtifactHandle(command.prompt_id)}.`,
      category: workflowCommand ? "Workflow" : "Command",
      keywords: [
        "command",
        "custom command",
        "launcher command",
        ...(workflowCommand ? ["workflow", "editable workflow pack"] : []),
        command.id,
        `/${command.id}`,
        command.prompt_id,
        ...command.contexts,
        ...command.keywords,
      ],
      aliases: command.aliases,
      homePlacement: command.home ? "home" : "search",
      artifactRequirement: "none",
      privacyLabel: workflowCommand
        ? WORKFLOW_PRIVACY_LABEL
        : "Uses only referenced local artifacts and explicit variable presets.",
      userCommand: command,
    } satisfies LauncherCommand;
  });
}

export function userLauncherHomeCommands(palette: PromptPaletteRuntime): LauncherCommand[] {
  return userLauncherCommands(palette).filter((command) => command.homePlacement === "home");
}
