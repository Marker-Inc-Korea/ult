import {
  artifactHandle,
  isDeliverableArtifact,
  promptArtifactHandle,
  promptArtifactType,
} from "../../promptUtils";
import { composerContextIds } from "../../searchComposer";
import type {
  ProjectArtifactWriteKind,
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import type { PreparePromptOptions } from "../loaded/deliveryController";
import {
  agentWorkflowPromptForCommand,
  isAgentWorkflowInputCommandId,
  isAgentWorkflowPromptCommandId,
} from "./agentWorkflowCommands";
import {
  recentContextStackCommandAvailable,
  recentPromptCommandAvailable,
} from "./launcherCommandAvailability";
import {
  fallbackCommandSectionLabel,
} from "./launcherCommandMetadata";
import { ephemeralContextPickerEntries } from "./ephemeralContextState";
import {
  mostRecentFailedDelivery,
  mostRecentRunnableHistoryArtifact,
} from "./historyCommands";
import type {
  LauncherCommand,
  LauncherCommandId,
} from "./launcherCommandTypes";
import type {
  LauncherCommandCapability,
  LauncherCommandEffect,
  LauncherCommandExecutionContext,
  LauncherCommandExecutionResult,
} from "./launcherCommandEffects";

type StaticCommandBehavior = {
  available?: (context: LauncherCommandExecutionContext["palette"]) => boolean;
  sectionLabel?: (command: LauncherCommand) => string;
  primaryAction: (command: LauncherCommand) => string;
  execute: (context: LauncherCommandExecutionContext) =>
    LauncherCommandExecutionResult;
};

const WORKFLOW_PROMPT_BEHAVIOR: StaticCommandBehavior = {
  primaryAction: (command) => isAgentWorkflowInputCommandId(command.id)
    ? "Add Input"
    : "Prepare Prompt",
  execute: ({ palette, command }) => {
    if (isAgentWorkflowInputCommandId(command.id)) {
      return {
        type: "open-workflow-input",
        commandId: command.id,
        contextHandleText: workflowContextHandleText(palette),
      };
    }
    const workflowPrompt = agentWorkflowPromptForCommand(command, palette.prompts);
    return workflowPrompt
      ? preparePrompt(
        workflowPrompt,
        composerContextIds(palette.searchQuery, palette.prompts),
      )
      : null;
  },
};

const STATIC_COMMAND_BEHAVIORS: Partial<Record<LauncherCommandId, StaticCommandBehavior>> = {
  "scratch": {
    primaryAction: () => "Open Scratch",
    execute: () => [
      { type: "open-launcher-mode", mode: "scratch" },
      { type: "rerender" },
    ],
  },
  "capture-clipboard": {
    primaryAction: () => "Capture",
    execute: () => ({ type: "capture-clipboard-context" }),
  },
  "clipboard-to-context": {
    primaryAction: () => "Capture Context",
    execute: () => ({ type: "capture-clipboard-context" }),
  },
  "run-last-prompt": {
    available: recentPromptCommandAvailable,
    primaryAction: () => "Prepare Prompt",
    execute: ({ palette }) => {
      const recent = mostRecentRunnableHistoryArtifact(palette);
      return recent
        ? preparePrompt(recent.artifact, [])
        : feedback("No recent prompt is available.", "warning");
    },
  },
  "open-recent-context-stack": {
    available: recentContextStackCommandAvailable,
    primaryAction: () => "Open Stack",
    execute: ({ palette }) => ephemeralContextPickerEntries(palette).length > 0
      ? [
        { type: "open-launcher-mode", mode: "stack" },
        { type: "rerender" },
      ]
      : feedback("No clipboard stack is available.", "warning"),
  },
  "clear-expired-contexts": {
    primaryAction: () => "Clear",
    execute: () => ({ type: "clear-expired-contexts" }),
  },
  "reveal-last-failed-delivery": {
    primaryAction: () => "Open Recovery",
    execute: ({ palette }) => {
      const failed = mostRecentFailedDelivery(palette);
      if (!failed) {
        return feedback("No failed delivery is available in recent history.", "warning");
      }
      return {
        type: "open-recovery-panel",
        entry: failed.entry,
      };
    },
  },
  "browse-library": {
    primaryAction: () => "Browse",
    execute: () => ({ type: "open-library-mode", filter: "all" }),
  },
  "browse-prompts": {
    primaryAction: () => "Browse",
    execute: () => ({ type: "open-library-mode", filter: "prompts" }),
  },
  "browse-contexts": {
    primaryAction: () => "Browse",
    execute: () => ({ type: "open-library-mode", filter: "contexts" }),
  },
  "browse-skills": {
    primaryAction: () => "Browse",
    execute: () => ({ type: "open-library-mode", filter: "skills" }),
  },
  "browse-commands": {
    primaryAction: () => "Browse",
    execute: () => ({ type: "open-library-mode", filter: "commands" }),
  },
  "preferences": {
    primaryAction: () => "Open Preferences",
    execute: () => ({ type: "open-preferences" }),
  },
  "add-prompt": {
    primaryAction: () => "Create",
    execute: () => openCreateCanvas("prompt", null, "Prompt creation opens in Launcher."),
  },
  "add-context": {
    primaryAction: () => "Create",
    execute: () => openCreateCanvas("context", null, "Context creation opens in Launcher."),
  },
  "add-skill": {
    primaryAction: () => "Create",
    execute: () => openSkillScaffold(null),
  },
  "import-github": {
    primaryAction: () => "Open Import",
    execute: () => ({
      type: "open-github-import",
      fallbackMessage: "GitHub import opens in Launcher.",
    }),
  },
  "browse-packs": {
    primaryAction: () => "Browse Packs",
    execute: () => ({
      type: "open-starter-packs",
      fallbackMessage: "Pack browsing opens in Launcher.",
    }),
  },
  "discover-skills": {
    primaryAction: () => "Open Gate",
    execute: () => ({ type: "open-skill-discovery", intent: "discover" }),
  },
  "find-agent-skills": {
    primaryAction: () => "Open Gate",
    execute: () => ({ type: "open-skill-discovery", intent: "find" }),
  },
  "install-agent-skill": {
    primaryAction: () => "Open Gate",
    execute: () => ({ type: "open-skill-discovery", intent: "install" }),
  },
  "review-installed-skills": {
    primaryAction: () => "Review Skills",
    execute: () => ({ type: "open-library-mode", filter: "skills" }),
  },
  "export-prompt-project": {
    primaryAction: () => "Open Project Write",
    execute: ({ command }) => openProjectWrite("prompt", "prompt", command.artifactId),
  },
  "export-context-project": {
    primaryAction: () => "Open Project Write",
    execute: ({ command }) => openProjectWrite("context", "context", command.artifactId),
  },
  "install-skill-project": {
    primaryAction: () => "Open Project Write",
    execute: ({ command }) => openProjectWrite("skill", "skill", command.artifactId),
  },
  "create-agents-snippet": {
    primaryAction: () => "Open Project Write",
    execute: ({ command }) => openProjectWrite("agents-snippet", null, command.artifactId),
  },
  "project-setup": {
    primaryAction: () => "Choose Project",
    execute: () => ({
      type: "open-project-setup",
      fallbackQuery: "project",
      fallbackMessage: "Choose a project command to preview exact files before writing.",
    }),
  },
  "open-library": {
    primaryAction: () => "Reveal Folder",
    execute: () => ({ type: "open-library-folder" }),
  },
};

export const DYNAMIC_COMMAND_CAPABILITIES: LauncherCommandCapability[] = [
  {
    id: "load-artifact",
    categoryLabel: (command) => command.description,
    kindLabel: (command) => command.artifactType === "context" ? "Context" : "Prompt",
    sectionLabel: () => "Suggestions",
    primaryAction: (command) => command.artifactType === "context" ? "Load Context" : "Load Prompt",
    execute: ({ palette, command }) => {
      const artifact = command.artifactId
        ? palette.prompts.find((prompt) => prompt.id === command.artifactId)
        : null;
      if (!artifact) return feedback("Item is no longer available.", "warning");
      if (!isDeliverableArtifact(artifact)) return skillBlocked();
      return preparePrompt(artifact, []);
    },
  },
  {
    id: "open-skill",
    categoryLabel: (command) => command.description,
    kindLabel: () => "Skill",
    sectionLabel: () => "Skills",
    primaryAction: () => "Open Skill",
    execute: ({ command }) => command.artifactId
      ? { type: "reveal-skill-source", artifactId: command.artifactId }
      : feedback("Skill is no longer available.", "warning"),
  },
  {
    id: "compose-scratch",
    title: (command) => `${command.label} ${command.description}`,
    sectionLabel: () => "Scratch",
    primaryAction: () => "Load Scratch",
    execute: ({ palette, command }) => [
      { type: "open-launcher-mode", mode: "scratch" },
      { type: "set-scratch-text", text: command.scratchText ?? palette.searchQuery.trim() },
      { type: "rerender" },
    ],
  },
  {
    id: "user-command",
    kindLabel: () => "Command",
    sectionLabel: () => "Commands",
    primaryAction: (command) => userCommandPrimaryAction(command),
    execute: executeUserCommand,
  },
  {
    id: "create-prompt",
    sectionLabel: () => "Create",
    primaryAction: () => "Create",
    execute: ({ command }) => openCreateCanvas("prompt", command.draftId, "Prompt creation opens in Launcher."),
  },
  {
    id: "create-context",
    sectionLabel: () => "Create",
    primaryAction: () => "Create",
    execute: ({ command }) => openCreateCanvas("context", command.draftId, "Context creation opens in Launcher."),
  },
  {
    id: "create-skill",
    sectionLabel: () => "Create",
    primaryAction: () => "Create",
    execute: ({ command }) => openSkillScaffold(command.draftId),
  },
];

export function staticCommandCapability(command: LauncherCommand): LauncherCommandCapability {
  const behavior = behaviorForStaticCommand(command);
  return {
    id: command.id,
    available: behavior.available,
    sectionLabel: behavior.sectionLabel ?? fallbackCommandSectionLabel,
    primaryAction: behavior.primaryAction,
    execute: behavior.execute,
  };
}

export function fallbackCapability(command: LauncherCommand): LauncherCommandCapability {
  return {
    id: command.id,
    primaryAction: () => "Run Command",
    execute: () => null,
  };
}

function behaviorForStaticCommand(command: LauncherCommand) {
  return STATIC_COMMAND_BEHAVIORS[command.id]
    ?? (command.category === "Workflow" ? WORKFLOW_PROMPT_BEHAVIOR : DEFAULT_STATIC_BEHAVIOR);
}

const DEFAULT_STATIC_BEHAVIOR: StaticCommandBehavior = {
  primaryAction: () => "Run Command",
  execute: () => null,
};

function executeUserCommand({
  palette,
  command,
}: LauncherCommandExecutionContext): LauncherCommandExecutionResult {
  const userCommand = command.userCommand;
  if (!userCommand) return feedback("Command is no longer available.", "warning");
  if (!userCommand.actions.includes("prepare")) {
    return feedback("Command does not support prompt preparation.", "warning");
  }
  if (isAgentWorkflowInputCommandId(userCommand.id)) {
    return {
      type: "open-workflow-input",
      commandId: userCommand.id,
      contextHandleText: workflowContextHandleText(palette),
    };
  }
  const prompt = palette.prompts.find((entry) => entry.id === userCommand.prompt_id) ?? null;
  if (!prompt) {
    return feedback(
      `Command prompt ${promptArtifactHandle(userCommand.prompt_id)} is no longer available.`,
      "warning",
    );
  }
  if (promptArtifactType(prompt) !== "prompt" || !isDeliverableArtifact(prompt)) {
    return feedback("Commands can only prepare prompt artifacts.", "warning");
  }
  return preparePrompt(
    prompt,
    mergeContextIds(
      userCommand.contexts,
      composerContextIds(palette.searchQuery, palette.prompts),
    ),
    {
      templateValues: userCommand.variable_values,
    },
  );
}

function userCommandPrimaryAction(command: LauncherCommand) {
  const id = command.userCommand?.id;
  if (id && isAgentWorkflowInputCommandId(id)) return "Add Input";
  if (id && isAgentWorkflowPromptCommandId(id)) return "Prepare Prompt";
  return "Run Command";
}

function workflowContextHandleText(palette: LauncherCommandExecutionContext["palette"]) {
  const byId = new Map(palette.prompts.map((prompt) => [prompt.id, prompt]));
  return composerContextIds(palette.searchQuery, palette.prompts)
    .map((id) => byId.get(id))
    .filter((prompt): prompt is PromptDefinition => Boolean(prompt))
    .map(artifactHandle)
    .join(" ");
}

function openSkillScaffold(initialId: string | null | undefined): LauncherCommandEffect {
  return {
    type: "open-skill-scaffold",
    initialId: initialId ?? null,
  };
}

function openCreateCanvas(
  artifactType: Extract<PromptArtifactType, "prompt" | "context">,
  initialId: string | null | undefined,
  fallbackMessage: string,
): LauncherCommandEffect {
  return {
    type: "open-artifact-create-canvas",
    artifactType,
    initialId: initialId ?? null,
    fallbackMessage,
  };
}

function openProjectWrite(
  writeKind: ProjectArtifactWriteKind,
  artifactType: PromptArtifactType | null,
  artifactId: string | null | undefined,
): LauncherCommandEffect {
  return {
    type: "open-project-write",
    writeKind,
    artifactType,
    artifactId,
    unavailableMessage: projectWriteUnavailableMessage(writeKind),
    fallbackMessage: "Project write opens in Launcher.",
  };
}

function projectWriteUnavailableMessage(writeKind: ProjectArtifactWriteKind) {
  switch (writeKind) {
    case "prompt":
      return "Select a prompt before exporting it to a project.";
    case "context":
      return "Select a context before exporting it to a project.";
    case "skill":
      return "Select a skill before installing it to a project.";
    case "agents-snippet":
      return "Select an artifact before creating an AGENTS.md snippet.";
  }
}

function preparePrompt(
  prompt: PromptDefinition,
  contextIds: string[],
  options?: PreparePromptOptions,
): LauncherCommandEffect {
  return {
    type: "prepare-prompt",
    prompt,
    contextIds,
    options,
  };
}

function feedback(
  message: string,
  tone?: "neutral" | "warning",
): LauncherCommandEffect[] {
  return [
    { type: "feedback", message, tone },
    { type: "rerender" },
  ];
}

function skillBlocked() {
  return feedback(
    "Skills open their SKILL.md source and cannot be loaded for delivery.",
    "warning",
  );
}

function mergeContextIds(primary: string[], secondary: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const id of [...primary, ...secondary]) {
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }
  return merged;
}
