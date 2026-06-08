import {
  artifactHandle,
  isLauncherSkillArtifact,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { LauncherCommand } from "./launcherCommandTypes";
import {
  artifactMatchesSearch,
  artifactScore,
} from "./launcherSearchArtifactScoring";
import { COMMAND_CREATION_CONTRACT } from "./commandCreationContract";
import {
  composeScratchCommand,
  createArtifactCommand,
  findMissingCommand,
} from "./launcherSearchFallbacks";
import type {
  LauncherIndexedCommandItem,
  LauncherIndexedItem,
  LauncherSearchIntent,
  ScoredArtifact,
  ScoredCommand,
} from "./launcherSearchTypes";

export function commandsForIntent(
  items: LauncherIndexedItem[],
  intent: LauncherSearchIntent,
  hasArtifactMatches: boolean,
  artifactMatches: ScoredArtifact[],
) {
  if (intent.namespace === "prompt") {
    const commandMatches = scoreCommandMatches(items, intent.commandTerm);
    if (commandMatches.length > 0) {
      return commandMatches.map((match) => match.item.command);
    }
    if (hasArtifactMatches) return [];
    return [createArtifactCommand("prompt", intent.term)];
  }

  if (intent.namespace === "context") {
    const commandMatches = scoreCommandMatches(items, intent.commandTerm);
    if (commandMatches.length > 0) {
      return commandMatches.map((match) => match.item.command);
    }
    if (hasArtifactMatches) return [];
    return [createArtifactCommand("context", intent.term)];
  }

  if (intent.namespace === "skill") {
    const commandMatches = scoreCommandMatches(items, intent.commandTerm);
    if (commandMatches.length > 0) {
      return commandMatches.map((match) => match.item.command);
    }
    const skillCommands = skillCommandsForIntent(items, intent.term);
    if (skillCommands.length > 0) return skillCommands;
    return [createArtifactCommand("skill", intent.term)];
  }

  if (intent.namespace === "command") {
    const commandMatches = scoreCommandMatches(items, intent.commandTerm);
    if (commandMatches.length > 0) {
      return commandMatches.map((match) => match.item.command);
    }
    return [findMissingCommand(intent.term)];
  }

  const commandMatches = scoreCommandMatches(items, intent.commandTerm);
  const commands = commandMatches.map((match) => match.item.command);
  const scratch = composeScratchCommand(intent.query);
  if (!shouldOfferComposeScratch(intent, commandMatches, artifactMatches)) {
    return commands;
  }
  if (isFreeformDraftIntent(intent.query)) {
    return [
      scratch,
      ...commands.filter((command) => command.id !== "scratch"),
    ];
  }
  return [
    ...commands.filter((command) => command.id !== "scratch"),
    scratch,
  ];
}

export function scoreCommandMatches(
  items: LauncherIndexedItem[],
  term: string,
): ScoredCommand[] {
  const normalizedTerm = term.toLowerCase();
  if (!normalizedTerm) return [];
  return items
    .filter((item): item is LauncherIndexedCommandItem =>
      "command" in item && commandMatchesSearch(item, normalizedTerm)
    )
    .map((item) => ({
      item,
      ...commandScore(item, normalizedTerm),
    }))
    .sort((left, right) => left.score - right.score);
}

export function shouldRankCommandsBeforeArtifacts(
  intent: LauncherSearchIntent,
  commands: LauncherCommand[],
  artifactMatches: ScoredArtifact[],
) {
  if (intent.namespace === "command") return true;
  if (intent.namespace !== "plain") return false;
  if (artifactMatches.length === 0) return false;
  const firstCommand = commands[0];
  if (!firstCommand || firstCommand.id === "compose-scratch") return false;
  return isStrongCommandIntent(intent.query, firstCommand);
}

function commandMatchesSearch(
  item: LauncherIndexedCommandItem,
  term: string,
) {
  const haystack = searchableCommandText(item);
  if (haystack.includes(term)) return true;
  const tokens = term.split(/\s+/).filter(Boolean);
  return tokens.length > 1 && tokens.every((token) => haystack.includes(token));
}

function searchableCommandText(item: LauncherIndexedCommandItem) {
  const command = item.command;
  const sourcePath = COMMAND_CREATION_CONTRACT.indexedMetadataFields.includes("source_path")
    ? command.userCommand?.source_path ?? ""
    : "";
  return [
    command.id,
    item.handle,
    command.label,
    command.description,
    command.category ?? "",
    command.privacyLabel ?? "",
    sourcePath,
    ...item.keywords,
    ...item.aliases,
  ].join(" ").toLowerCase();
}

function commandScore(
  item: LauncherIndexedCommandItem,
  term: string,
) {
  const command = item.command;
  const id = command.userCommand?.id.toLowerCase() ?? command.id.toLowerCase();
  const handle = `/${id}`;
  const label = command.label.toLowerCase();
  const aliases = item.aliases.map((alias) => alias.toLowerCase());
  if (id === term || handle === term) return { score: 0, reason: "exact command handle" };
  if (label === term) return { score: 1, reason: "exact command title" };
  if (aliases.includes(term)) return { score: 2, reason: "exact alias" };
  if (id.startsWith(term) || handle.startsWith(term)) {
    return { score: 3, reason: "command handle prefix" };
  }
  if (label.startsWith(term)) return { score: 4, reason: "command title prefix" };
  if (aliases.some((alias) => alias.startsWith(term))) {
    return { score: 5, reason: "alias prefix" };
  }
  if (id.includes(term) || handle.includes(term)) {
    return { score: 6, reason: "command handle contains" };
  }
  if (label.includes(term)) return { score: 7, reason: "command title contains" };
  return { score: 8, reason: "command metadata contains" };
}

function skillCommandsForIntent(items: LauncherIndexedItem[], term: string) {
  const normalizedTerm = term.toLowerCase();
  return items
    .filter((item): item is Extract<LauncherIndexedItem, { prompt: PromptDefinition }> =>
      item.type === "skill-package"
      && isLauncherSkillArtifact(item.prompt)
      && artifactMatchesSearch(item, {
        query: term,
        namespace: "skill",
        term,
        commandTerm: term,
        searchTerm: { namespace: "skill", artifactType: "skill", term },
        selectedContextIds: new Set(),
        home: false,
      })
    )
    .map((item) => ({
      item,
      ...artifactScore(item, normalizedTerm),
    }))
    .sort((left, right) =>
      left.score - right.score || left.item.promptIndex - right.item.promptIndex
    )
    .map(({ item }) => ({
      id: "open-skill" as const,
      label: artifactHandle(item.prompt),
      description: item.prompt.title,
      category: "Library" as const,
      keywords: ["skill", "workflow", "SKILL.md"],
      artifactId: item.prompt.id,
      artifactType: "skill" as const,
    }));
}

function shouldOfferComposeScratch(
  intent: LauncherSearchIntent,
  commandMatches: ScoredCommand[],
  artifactMatches: ScoredArtifact[],
) {
  if (intent.namespace !== "plain" || !intent.query) return false;
  if (isFreeformDraftIntent(intent.query)) return true;
  return commandMatches.length === 0 && artifactMatches.length === 0;
}

function isStrongCommandIntent(query: string, command: LauncherCommand) {
  const normalized = query.trim().toLowerCase();
  const id = (command.userCommand?.id ?? command.id).toLowerCase();
  const handle = `/${id}`;
  const label = command.label.toLowerCase();
  const aliases = (command.aliases ?? []).map((alias) => alias.toLowerCase());
  if (id === normalized || handle === normalized) return true;
  if (label === normalized) return true;
  if (aliases.includes(normalized)) return true;
  return normalized.includes(" ") && label.startsWith(normalized);
}

function isFreeformDraftIntent(query: string) {
  const normalized = query.trim().toLowerCase();
  return /^(draft|write|compose|ask|tell|create a prompt|make a prompt|프롬프트|작성)\b/.test(normalized)
    || normalized.length > 64
    || /[.!?]\s*$/.test(normalized);
}
