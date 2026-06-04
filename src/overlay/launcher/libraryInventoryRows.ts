import type {
  LauncherLibraryFilter,
  LauncherLibrarySort,
  PromptPaletteRuntime,
} from "../../paletteRuntime";
import {
  artifactHandle,
  isLauncherPromptArtifact,
  isLauncherSkillArtifact,
  isNonExpiredArtifact,
  isPersistentContextArtifact,
  launcherCommandHandle,
  promptArtifactType,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import { BASE_COMMANDS } from "./launcherCommandDefinitions";
import { ensureLauncherCommandIndex } from "./launcherCommandSelection";
import type { LauncherCommand } from "./launcherCommandTypes";
import { libraryInventoryContext } from "./libraryInventoryContext";
import {
  libraryDependencyHandlesForArtifact,
  libraryDependencyHandlesForCommand,
} from "./libraryInventoryDependencies";
import {
  artifactIssueCount,
  commandIssueRows,
  libraryIssueRowsForPalette,
} from "./libraryInventoryIssues";
import type {
  LibraryArtifactRow,
  LibraryCommandRow,
  LibraryInventoryContext,
  LibraryRow,
} from "./libraryInventoryTypes";
import { userLauncherCommands } from "./userLauncherCommands";

export function libraryRowsForPalette(palette: PromptPaletteRuntime) {
  const context = libraryInventoryContext(palette);
  const artifactRows = palette.prompts
    .map((prompt, index) => artifactRow(prompt, index, context))
    .filter((row) => libraryArtifactMatchesFilter(row.prompt, palette.launcherLibraryFilter));
  const commandRows = libraryCommandsForPalette(palette)
    .filter(() => commandFilterMatches(palette.launcherLibraryFilter))
    .map((command, index) => commandRow(command, index, context));
  const issueRows = palette.launcherLibraryFilter === "all"
    ? libraryIssueRowsForPalette(palette, context)
    : [];
  const rows = palette.launcherLibraryFilter === "commands"
    ? commandRows
    : palette.launcherLibraryFilter === "all"
    ? [...issueRows, ...artifactRows, ...commandRows]
    : artifactRows;
  const filteredRows = rows
    .filter((row) => libraryRowMatchesQuery(row, palette.launcherLibraryQuery))
    .sort((left, right) => compareLibraryRows(left, right, palette.launcherLibrarySort, context));
  ensureLauncherCommandIndex(palette, filteredRows.length);
  return filteredRows satisfies LibraryRow[];
}

export function selectedLibraryRow(palette: PromptPaletteRuntime) {
  const rows = libraryRowsForPalette(palette);
  if (rows.length === 0) return null;
  return rows[palette.launcherCommandIndex] ?? rows[0] ?? null;
}

export function libraryCounts(palette: PromptPaletteRuntime) {
  return {
    all: libraryRowCountForFilter(palette, "all"),
    prompts: libraryRowCountForFilter(palette, "prompts"),
    contexts: libraryRowCountForFilter(palette, "contexts"),
    skills: libraryRowCountForFilter(palette, "skills"),
    commands: libraryRowCountForFilter(palette, "commands"),
  } satisfies Record<LauncherLibraryFilter, number>;
}

function libraryRowCountForFilter(
  palette: PromptPaletteRuntime,
  filter: LauncherLibraryFilter,
) {
  const artifactCount = palette.prompts.filter((prompt) =>
    libraryArtifactMatchesFilter(prompt, filter)
  ).length;
  const commandCount = commandFilterMatches(filter)
    ? libraryCommandsForPalette(palette).length
    : 0;
  const issueCount = filter === "all"
    ? libraryIssueRowsForPalette(palette, libraryInventoryContext(palette)).length
    : 0;
  return artifactCount + commandCount + issueCount;
}

function artifactRow(
  prompt: PromptDefinition,
  promptIndex: number,
  context: LibraryInventoryContext,
): LibraryArtifactRow {
  return {
    kind: "artifact",
    prompt,
    promptIndex,
    dependencies: libraryDependencyHandlesForArtifact(prompt, context.prompts),
    issueCount: artifactIssueCount(prompt),
  };
}

function commandRow(
  command: LauncherCommand,
  inventoryIndex: number,
  context: LibraryInventoryContext,
): LibraryCommandRow {
  return {
    kind: "command",
    command,
    dependencies: libraryDependencyHandlesForCommand(command),
    issueCount: commandIssueRows(command, context).length,
    inventoryIndex,
  };
}

function libraryArtifactMatchesFilter(
  prompt: PromptDefinition,
  filter: LauncherLibraryFilter,
) {
  if (!isNonExpiredArtifact(prompt)) return false;
  if (filter === "all") return isLibraryArtifact(prompt);
  if (filter === "prompts") return isLauncherPromptArtifact(prompt);
  if (filter === "contexts") return isPersistentContextArtifact(prompt);
  if (filter === "skills") return isLauncherSkillArtifact(prompt);
  return false;
}

function isLibraryArtifact(prompt: PromptDefinition) {
  const artifactType = promptArtifactType(prompt);
  if (artifactType === "prompt") return isLauncherPromptArtifact(prompt);
  if (artifactType === "skill") return isLauncherSkillArtifact(prompt);
  if (artifactType === "context") return isPersistentContextArtifact(prompt);
  return false;
}

function commandFilterMatches(filter: LauncherLibraryFilter) {
  return filter === "all" || filter === "commands";
}

function libraryCommandsForPalette(palette: PromptPaletteRuntime) {
  const hiddenFromInventory = new Set<LauncherCommand["id"]>([
    "create-prompt",
    "create-context",
    "create-skill",
  ]);
  return [...BASE_COMMANDS, ...userLauncherCommands(palette)]
    .filter((command) => !hiddenFromInventory.has(command.id))
    .sort(compareLibraryCommands);
}

function compareLibraryRows(
  left: LibraryRow,
  right: LibraryRow,
  sort: LauncherLibrarySort,
  context: LibraryInventoryContext,
): number {
  if (sort === "issues") {
    return issueRank(left) - issueRank(right)
      || compareIssueSeverity(left, right)
      || compareLibraryRows(left, right, "recent", context);
  }
  if (sort === "updated") {
    return rowUpdatedMs(right) - rowUpdatedMs(left)
      || defaultInventoryRank(left) - defaultInventoryRank(right)
      || rowStableIndex(left) - rowStableIndex(right)
      || rowLabel(left).localeCompare(rowLabel(right));
  }
  if (sort === "type") {
    return rowTypeRank(left) - rowTypeRank(right)
      || defaultInventoryRank(left) - defaultInventoryRank(right)
      || rowStableIndex(left) - rowStableIndex(right)
      || rowLabel(left).localeCompare(rowLabel(right));
  }
  if (sort === "pinned") {
    return Number(rowPinned(right)) - Number(rowPinned(left))
      || defaultInventoryRank(left) - defaultInventoryRank(right)
      || rowStableIndex(left) - rowStableIndex(right)
      || rowLabel(left).localeCompare(rowLabel(right));
  }
  return rowRecentMs(right, context) - rowRecentMs(left, context)
    || defaultInventoryRank(left) - defaultInventoryRank(right)
    || rowStableIndex(left) - rowStableIndex(right)
    || rowLabel(left).localeCompare(rowLabel(right));
}

function compareLibraryCommands(left: LauncherCommand, right: LauncherCommand) {
  const leftRank = commandInventoryRank(left);
  const rightRank = commandInventoryRank(right);
  if (leftRank !== rightRank) return leftRank - rightRank;
  return left.label.localeCompare(right.label);
}

function commandInventoryRank(command: LauncherCommand) {
  if (command.id === "user-command") return 0;
  if (command.category === "Library") return 1;
  if (command.category === "Create") return 2;
  if (command.category === "Workflow") return 3;
  if (command.category === "Project") return 4;
  if (command.category === "Import") return 5;
  if (command.category === "History") return 6;
  return 7;
}

function libraryRowMatchesQuery(row: LibraryRow, query: string) {
  const normalizedQuery = normalizeLibrarySearch(query);
  if (!normalizedQuery) return true;
  return normalizeLibrarySearch(rowSearchText(row)).includes(normalizedQuery);
}

function rowSearchText(row: LibraryRow) {
  if (row.kind === "artifact") {
    return [
      artifactHandle(row.prompt),
      row.prompt.id,
      row.prompt.title,
      promptArtifactType(row.prompt),
      row.prompt.registry_source_path ?? "",
      ...row.dependencies,
    ].join(" ");
  }
  if (row.kind === "command") {
    return [
      launcherCommandHandle(row.command.userCommand?.id ?? row.command.id),
      row.command.label,
      row.command.category ?? "",
      ...(row.command.aliases ?? []),
      ...(row.command.keywords ?? []),
      row.command.userCommand?.source_path ?? "",
      ...row.dependencies,
    ].join(" ");
  }
  return [row.title, row.subject ?? "", row.detail, row.severity].join(" ");
}

function normalizeLibrarySearch(value: string) {
  return value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function defaultInventoryRank(row: LibraryRow) {
  if (row.kind === "issue") return 0;
  if (row.kind === "artifact") return artifactInventoryRank(row.prompt);
  return 100 + commandInventoryRank(row.command);
}

function artifactInventoryRank(prompt: PromptDefinition) {
  const type = promptArtifactType(prompt);
  if (type === "prompt") return 10;
  if (type === "context") return 20;
  if (type === "skill") return 30;
  return 40;
}

function rowTypeRank(row: LibraryRow) {
  if (row.kind === "issue") return 0;
  if (row.kind === "artifact") return artifactInventoryRank(row.prompt);
  return 100;
}

function issueRank(row: LibraryRow) {
  return row.kind === "issue" || row.issueCount > 0 ? 0 : 1;
}

function compareIssueSeverity(left: LibraryRow, right: LibraryRow) {
  return rowIssueSeverityRank(left) - rowIssueSeverityRank(right);
}

function rowIssueSeverityRank(row: LibraryRow) {
  if (row.kind === "issue") return row.severity === "error" ? 0 : 1;
  return row.issueCount > 0 ? 2 : 3;
}

function rowRecentMs(row: LibraryRow, context: LibraryInventoryContext) {
  if (row.kind !== "artifact") return 0;
  return context.recentUseByArtifactId.get(row.prompt.id) ?? 0;
}

function rowUpdatedMs(row: LibraryRow) {
  if (row.kind !== "artifact") return 0;
  return row.prompt.registry_source_modified_ms
    ?? row.prompt.registry_source_created_ms
    ?? row.prompt.created_at
    ?? 0;
}

function rowPinned(row: LibraryRow) {
  return row.kind === "artifact" && row.prompt.pinned === true;
}

function rowLabel(row: LibraryRow) {
  if (row.kind === "artifact") return row.prompt.title;
  if (row.kind === "command") return row.command.label;
  return row.title;
}

function rowStableIndex(row: LibraryRow) {
  if (row.kind === "artifact") return row.promptIndex;
  if (row.kind === "command") return 10_000 + row.inventoryIndex;
  return 0;
}
