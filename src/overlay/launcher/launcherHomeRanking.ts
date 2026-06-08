import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  isNonExpiredArtifact,
  isLauncherPromptArtifact,
  isLauncherSkillArtifact,
  isPalettePrompt,
  isPersistentContextArtifact,
  isPersistentPrompt,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import type { DeliveryResultStatus, PromptDefinition, UsageHistoryEntry } from "../../types";
import {
  artifactCommand,
  HISTORY_COMMANDS,
  LIBRARY_HOME_COMMAND,
  MANAGEMENT_COMMANDS,
  SCRATCH_COMMAND,
  CAPTURE_CLIPBOARD_COMMAND,
} from "./launcherCommandDefinitions";
import {
  AGENT_WORKFLOW_COMMANDS,
  isAgentWorkflowPromptCommandId,
  type AgentWorkflowPromptCommandId,
} from "./agentWorkflowCommands";
import { ephemeralContextPickerEntries } from "./ephemeralContextState";
import { mostRecentFailedDelivery } from "./historyCommands";
import {
  userLauncherCommands,
  userLauncherHomeCommands,
} from "./userLauncherCommands";
import type { LauncherCommand } from "./launcherCommandTypes";

const REPEAT_USAGE_WEIGHT_MS = 60 * 1000;

export function launcherHomeCommands(palette: PromptPaletteRuntime) {
  return [
    ...continueHomeCommands(palette),
    ...libraryHomeCommands(palette),
    ...createHomeCommands(),
    ...workflowHomeCommands(palette),
    ...projectHomeCommands(),
    ...recoveryHomeCommands(),
  ];
}

function continueHomeCommands(palette: PromptPaletteRuntime) {
  return firstAvailableHomeLane([
    recentArtifactHomeCommands(palette),
    clipboardStackHomeCommands(palette),
    failedDeliveryHomeCommands(palette),
  ]);
}

function recentArtifactHomeCommands(palette: PromptPaletteRuntime) {
  const usage = artifactUsageStats(palette.usageHistory);
  return palette.prompts
    .map((prompt, index) => ({ prompt, index }))
    .filter((prompt) =>
      isRecommendedHomeArtifact(prompt.prompt),
    )
    .filter(({ prompt }) => usage.has(prompt.id))
    .sort((left, right) => compareRecommendedArtifacts(left, right, usage))
    .slice(0, 1)
    .map(({ prompt }) => artifactCommand(prompt));
}

function clipboardStackHomeCommands(palette: PromptPaletteRuntime) {
  if (ephemeralContextPickerEntries(palette).length === 0) return [];
  return historyCommandById("open-recent-context-stack");
}

function failedDeliveryHomeCommands(palette: PromptPaletteRuntime) {
  if (!mostRecentFailedDelivery(palette)) return [];
  return historyCommandById("reveal-last-failed-delivery");
}

function libraryHomeCommands(palette: PromptPaletteRuntime) {
  const counts = libraryInventoryCounts(palette);
  return [
    {
      ...LIBRARY_HOME_COMMAND,
      detailLabel: libraryInventorySummary(counts),
    },
    ...userLauncherHomeCommands(palette).slice(0, 1),
  ];
}

function createHomeCommands() {
  return requiredManagementCommands([
    "scratch",
    "add-prompt",
    "add-context",
  ]);
}

function workflowHomeCommands(palette: PromptPaletteRuntime) {
  const localReview = localWorkflowCommandById(palette, "workflow-review-current-change");
  if (localReview) return [localReview];
  return requiredCommands(AGENT_WORKFLOW_COMMANDS, [
    "workflow-review-current-change",
  ]);
}

function projectHomeCommands() {
  return requiredManagementCommands([
    "project-setup",
  ]);
}

function recoveryHomeCommands() {
  return requiredManagementCommands([
    "preferences",
  ]);
}

function localWorkflowCommandById(
  palette: PromptPaletteRuntime,
  workflowId: AgentWorkflowPromptCommandId,
) {
  return userLauncherCommands(palette)
    .find((command) =>
      command.userCommand?.id === workflowId
      && isAgentWorkflowPromptCommandId(command.userCommand.id)
    )
    ?? null;
}

function libraryInventoryCounts(palette: PromptPaletteRuntime) {
  return {
    prompts: palette.prompts.filter(isLauncherPromptArtifact).length,
    contexts: palette.prompts.filter(isPersistentContextArtifact).length,
    skills: palette.prompts.filter(isLauncherSkillArtifact).length,
    commands: palette.userCommands.length,
  };
}

function libraryInventorySummary(counts: ReturnType<typeof libraryInventoryCounts>) {
  return [
    pluralizeCount(counts.prompts, "prompt"),
    pluralizeCount(counts.contexts, "context"),
    pluralizeCount(counts.skills, "skill"),
    `${counts.commands} cmd${counts.commands === 1 ? "" : "s"}`,
  ].join(" / ");
}

function pluralizeCount(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function isRecommendedHomeArtifact(prompt: PromptDefinition) {
  if (!isNonExpiredArtifact(prompt)) return false;
  if (isPersistentPrompt(prompt)) return true;
  return promptArtifactType(prompt) === "context";
}

function compareRecommendedArtifacts(
  left: { prompt: PromptDefinition; index: number },
  right: { prompt: PromptDefinition; index: number },
  usage: Map<string, ArtifactUsageStats>,
) {
  const leftUsage = usage.get(left.prompt.id);
  const rightUsage = usage.get(right.prompt.id);
  if (leftUsage || rightUsage) {
    if (!leftUsage) return 1;
    if (!rightUsage) return -1;
    const leftScore = usageAffinityScore(leftUsage);
    const rightScore = usageAffinityScore(rightUsage);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    if (leftUsage.count !== rightUsage.count) return rightUsage.count - leftUsage.count;
    if (leftUsage.lastTimestamp !== rightUsage.lastTimestamp) {
      return rightUsage.lastTimestamp - leftUsage.lastTimestamp;
    }
  }

  const leftRank = homeFallbackRank(left.prompt);
  const rightRank = homeFallbackRank(right.prompt);
  if (leftRank !== rightRank) return leftRank - rightRank;

  const createdAt = compareCreatedAt(right.prompt, left.prompt);
  if (createdAt !== 0) return createdAt;
  return left.index - right.index;
}

function compareCreatedAt(left: PromptDefinition, right: PromptDefinition) {
  return (left.created_at ?? 0) - (right.created_at ?? 0);
}

type ArtifactUsageStats = {
  count: number;
  lastTimestamp: number;
};

function artifactUsageStats(history: UsageHistoryEntry[]) {
  const byId = new Map<string, ArtifactUsageStats>();
  for (const entry of history) {
    if (!entry.prompt_id || !isSuccessfulUsageResult(entry.result)) continue;
    const current = byId.get(entry.prompt_id) ?? { count: 0, lastTimestamp: 0 };
    current.count += 1;
    current.lastTimestamp = Math.max(current.lastTimestamp, entry.timestamp_ms);
    byId.set(entry.prompt_id, current);
  }
  return byId;
}

function usageAffinityScore(stats: ArtifactUsageStats) {
  return stats.lastTimestamp
    + Math.min(Math.max(0, stats.count - 1), 8) * REPEAT_USAGE_WEIGHT_MS;
}

function isSuccessfulUsageResult(result: DeliveryResultStatus) {
  return result === "delivered" || result === "copied";
}

function homeFallbackRank(prompt: PromptDefinition) {
  if (promptArtifactType(prompt) === "context") {
    return promptScope(prompt) === "ephemeral" ? 0 : 2;
  }
  if (isPalettePrompt(prompt)) return 1;
  return 3;
}

function historyCommandById(id: LauncherCommand["id"]) {
  return requiredCommands(HISTORY_COMMANDS, [id]);
}

function firstAvailableHomeLane(lanes: LauncherCommand[][]) {
  return lanes.find((lane) => lane.length > 0) ?? [];
}

function requiredManagementCommands(ids: LauncherCommand["id"][]) {
  return requiredCommands([
    SCRATCH_COMMAND,
    CAPTURE_CLIPBOARD_COMMAND,
    ...MANAGEMENT_COMMANDS,
  ], ids);
}

function requiredCommands(commands: LauncherCommand[], ids: LauncherCommand["id"][]) {
  return ids.map((id) => {
    const command = commands.find((entry) => entry.id === id);
    if (!command) throw new Error(`Missing Launcher home command ${id}`);
    return command;
  });
}
