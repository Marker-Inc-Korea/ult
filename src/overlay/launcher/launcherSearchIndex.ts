import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { launcherHomeCommands } from "./launcherHomeRanking";
import {
  pageArtifactMatches,
  scoreArtifactMatches,
} from "./launcherSearchArtifactScoring";
import {
  commandsForIntent,
  shouldRankCommandsBeforeArtifacts,
} from "./launcherSearchCommandScoring";
import {
  collectLauncherIndexedItems,
} from "./launcherSearchCollector";
import { parseLauncherSearchIntent } from "./launcherSearchIntent";
import {
  rankingTrace,
  traceCommandResult,
} from "./launcherSearchTrace";
import type {
  LauncherSearchOptions,
  LauncherSearchResult,
} from "./launcherSearchTypes";

export type {
  LauncherIndexedCommandItem,
  LauncherIndexedArtifactItem,
  LauncherIndexedItem,
  LauncherSearchIntent,
  LauncherSearchOptions,
  LauncherSearchResult,
  RankingTrace,
  RankingTraceEntry,
  ScoredArtifact,
  ScoredCommand,
} from "./launcherSearchTypes";

export {
  collectLauncherIndexedItems,
} from "./launcherSearchCollector";

export {
  parseLauncherSearchIntent,
} from "./launcherSearchIntent";

export function launcherSearchForPalette(
  palette: PromptPaletteRuntime,
  options: LauncherSearchOptions = {},
): LauncherSearchResult {
  const items = collectLauncherIndexedItems(palette);
  const intent = parseLauncherSearchIntent(palette.searchQuery);

  if (intent.home) {
    const commands = launcherHomeCommands(palette);
    return {
      intent,
      entries: [],
      commands,
      commandsLead: false,
      trace: rankingTrace(
        palette,
        intent,
        items,
        [],
        commands.map((command, index) =>
          traceCommandResult(command, index, "home representative")
        ),
      ),
    };
  }

  const artifactMatches = scoreArtifactMatches(items, intent);
  const pagedArtifactMatches = pageArtifactMatches(artifactMatches, palette);
  const hasArtifactMatches = options.hasArtifactMatches ?? artifactMatches.length > 0;
  const commands = commandsForIntent(
    items,
    intent,
    hasArtifactMatches,
    artifactMatches,
  );
  const entries = pagedArtifactMatches.map((match, offset) => ({
    prompt: match.item.prompt,
    index: match.item.promptIndex,
    key: offset + 1,
  }));

  return {
    intent,
    entries,
    commands,
    commandsLead: shouldRankCommandsBeforeArtifacts(intent, commands, artifactMatches),
    trace: rankingTrace(
      palette,
      intent,
      items,
      pagedArtifactMatches,
      commands.map((command, index) =>
        traceCommandResult(
          command,
          index,
          command.id === "compose-scratch" ? "scratch fallback" : "command result",
        )
      ),
    ),
  };
}

export function launcherRankingTrace(palette: PromptPaletteRuntime) {
  return launcherSearchForPalette(palette).trace;
}
