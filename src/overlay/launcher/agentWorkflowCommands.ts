import workflowPacksJson from "../../data/agent-workflow-packs.json";
import { promptArtifactType } from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { LauncherCommand, LauncherCommandId } from "./launcherCommandTypes";

export type AgentWorkflowPromptCommandId = Extract<
  LauncherCommandId,
  | "workflow-review-current-change"
  | "workflow-fix-failing-tests"
  | "workflow-plan-next-step"
  | "workflow-write-pr-description"
  | "workflow-rescue-stuck-agent"
  | "workflow-summarize-thread"
>;

export type AgentWorkflowInputCommandId = Extract<
  AgentWorkflowPromptCommandId,
  | "workflow-review-current-change"
  | "workflow-fix-failing-tests"
  | "workflow-write-pr-description"
  | "workflow-rescue-stuck-agent"
>;

type AgentWorkflowDefinition = {
  id: AgentWorkflowPromptCommandId;
  title: string;
  description: string;
  keywords: readonly string[];
  aliases: readonly string[];
  prompt: string;
  input_title?: string;
  input_placeholder?: string;
};

export const WORKFLOW_PRIVACY_LABEL =
  "Prepares prompt text only; reads no terminal, project, editor, or agent output.";

const HOME_WORKFLOW_COMMAND_IDS = new Set<AgentWorkflowPromptCommandId>([
  "workflow-review-current-change",
  "workflow-fix-failing-tests",
]);

const AGENT_WORKFLOW_DEFINITIONS = Object.fromEntries(
  (workflowPacksJson as AgentWorkflowDefinition[]).map((definition) => [
    definition.id,
    definition,
  ]),
) as Record<AgentWorkflowPromptCommandId, AgentWorkflowDefinition>;

export const AGENT_WORKFLOW_PROMPT_COMMANDS: LauncherCommand[] = Object.entries(
  AGENT_WORKFLOW_DEFINITIONS,
).map(([id, definition]) => ({
  id: id as AgentWorkflowPromptCommandId,
  label: definition.title,
  description: definition.description,
  category: "Workflow",
  keywords: definition.keywords,
  aliases: definition.aliases,
  homePlacement: HOME_WORKFLOW_COMMAND_IDS.has(id as AgentWorkflowPromptCommandId) ? "home" : "search",
  artifactRequirement: "none",
  privacyLabel: WORKFLOW_PRIVACY_LABEL,
}));

export const CLIPBOARD_CONTEXT_WORKFLOW_COMMAND: LauncherCommand = {
  id: "clipboard-to-context",
  label: "Turn Clipboard into Context",
  description: "Save clipboard text as a temporary context.",
  category: "Workflow",
  keywords: ["clipboard", "context", "clip", "paste", "turn clipboard into context"],
  aliases: ["clipboard to context", "capture as context", "클립보드 컨텍스트"],
  homePlacement: "search",
  artifactRequirement: "none",
  privacyLabel: "Reads the current clipboard only when explicitly run.",
};

export const AGENT_WORKFLOW_COMMANDS: LauncherCommand[] = [
  ...AGENT_WORKFLOW_PROMPT_COMMANDS,
  CLIPBOARD_CONTEXT_WORKFLOW_COMMAND,
];

export function agentWorkflowPromptForCommand(
  command: LauncherCommand,
  prompts: PromptDefinition[] = [],
): PromptDefinition | null {
  if (!isAgentWorkflowPromptCommandId(command.id)) return null;
  const localPrompt = agentWorkflowLocalPromptForCommandId(prompts, command.id);
  if (localPrompt) return localPrompt;
  const definition = AGENT_WORKFLOW_DEFINITIONS[command.id];
  return workflowPromptFromDefinition(definition);
}

export function agentWorkflowPromptForCommandId(
  commandId: AgentWorkflowPromptCommandId,
  prompts: PromptDefinition[] = [],
) {
  const localPrompt = agentWorkflowLocalPromptForCommandId(prompts, commandId);
  if (localPrompt) return localPrompt;
  return workflowPromptFromDefinition(AGENT_WORKFLOW_DEFINITIONS[commandId]);
}

export function agentWorkflowInputDefinitionForCommandId(
  commandId: string,
) {
  if (!isAgentWorkflowInputCommandId(commandId)) return null;
  const definition = AGENT_WORKFLOW_DEFINITIONS[commandId];
  return {
    id: commandId,
    title: definition.title,
    description: definition.description,
    inputTitle: definition.input_title ?? "Add context for this workflow.",
    inputPlaceholder: definition.input_placeholder ?? "",
  };
}

export function agentWorkflowLocalPromptForCommandId(
  prompts: PromptDefinition[],
  commandId: AgentWorkflowPromptCommandId,
) {
  return prompts.find((prompt) =>
    prompt.id === commandId && promptArtifactType(prompt) === "prompt"
  ) ?? null;
}

export function isAgentWorkflowInputCommandId(
  id: string,
): id is AgentWorkflowInputCommandId {
  return isAgentWorkflowPromptCommandId(id)
    && Boolean(AGENT_WORKFLOW_DEFINITIONS[id].input_title);
}

export function isAgentWorkflowPromptCommandId(
  id: string,
): id is AgentWorkflowPromptCommandId {
  return id in AGENT_WORKFLOW_DEFINITIONS;
}

function workflowPromptFromDefinition(
  definition: AgentWorkflowDefinition,
): PromptDefinition {
  return {
    id: definition.id,
    title: definition.title,
    artifact_type: "prompt",
    scope: "ephemeral",
    pinned: false,
    description: definition.description,
    prompt: definition.prompt,
    contexts: [],
    shortcut: null,
    confirm: false,
    template_arguments: [],
    source: "user",
  };
}
