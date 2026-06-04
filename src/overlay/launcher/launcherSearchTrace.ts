import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  launcherCommandAvailable,
} from "./launcherCommandCapabilities";
import { commandIndexedItem } from "./launcherSearchCollector";
import {
  commandPrimaryAction,
} from "./searchCommandPresentation";
import type {
  LauncherIndexedItem,
  LauncherSearchIntent,
  RankingTrace,
  RankingTraceEntry,
  ScoredArtifact,
  ScoredCommand,
} from "./launcherSearchTypes";

export function rankingTrace(
  palette: PromptPaletteRuntime,
  intent: LauncherSearchIntent,
  items: LauncherIndexedItem[],
  artifactMatches: ScoredArtifact[],
  commandMatches: ScoredCommand[],
): RankingTrace {
  return {
    query: intent.query,
    intent: {
      namespace: intent.namespace,
      term: intent.term,
      commandTerm: intent.commandTerm,
      home: intent.home,
    },
    indexedItemCount: items.length,
    indexedItemTypes: indexedItemTypes(items),
    matches: [
      ...artifactMatches.map(traceArtifact),
      ...commandMatches.map((match) => traceCommand(match, palette)),
    ],
  };
}

export function traceCommandResult(
  command: ScoredCommand["item"]["command"],
  score: number,
  reason: string,
): ScoredCommand {
  return {
    item: commandIndexedItem(command),
    score,
    reason,
  };
}

function indexedItemTypes(items: LauncherIndexedItem[]): RankingTrace["indexedItemTypes"] {
  const counts: RankingTrace["indexedItemTypes"] = {
    "prompt-artifact": 0,
    "context-artifact": 0,
    "skill-package": 0,
    "built-in-command": 0,
    "user-defined-command": 0,
    "workflow-command": 0,
    "recovery-system-command": 0,
  };
  for (const item of items) {
    counts[item.type] += 1;
  }
  return counts;
}

function traceArtifact(match: ScoredArtifact): RankingTraceEntry {
  return {
    key: match.item.key,
    type: match.item.type,
    label: match.item.handle,
    score: match.score,
    reason: match.reason,
  };
}

function traceCommand(
  match: ScoredCommand,
  palette: PromptPaletteRuntime,
): RankingTraceEntry {
  const command = match.item.command;
  return {
    key: match.item.key,
    type: command.id === "compose-scratch" ? "compose-scratch" : match.item.type,
    label: match.item.handle,
    score: match.score,
    reason: match.reason,
    available: launcherCommandAvailable(command, palette),
    primaryAction: commandPrimaryAction(command),
  };
}
