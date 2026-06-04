import {
  type PromptPaletteRuntime,
  type VisiblePromptEntry,
} from "../../paletteRuntime";
import {
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import { searchTermForQuery } from "../../searchComposer";
import type { PromptDefinition } from "../../types";
import { ensureLauncherCommandIndex } from "./launcherCommandSelection";
import type { LauncherCommand } from "./launcherCommandTypes";
import { launcherSearchForPalette } from "./launcherSearchIndex";
import { commandSectionLabel } from "./searchCommandPresentation";

export type LauncherArtifactRow = {
  kind: "artifact";
  section: string;
  prompt: PromptDefinition;
  promptIndex: number;
  command?: LauncherCommand;
};

export type LauncherCommandRow = {
  kind: "command";
  section: string;
  command: LauncherCommand;
};

export type LauncherRow = LauncherArtifactRow | LauncherCommandRow;

export type LauncherRows = {
  entries: VisiblePromptEntry[];
  commands: LauncherCommand[];
  rows: LauncherRow[];
  hasCommandRows: boolean;
  hasRows: boolean;
};

const HOME_SECTION_ORDER = [
  "Continue",
  "Library",
  "Create",
  "Agent Workflows",
  "Project",
  "Recovery / System",
] as const;

export function launcherRowsForPalette(palette: PromptPaletteRuntime): LauncherRows {
  const searchResult = launcherSearchForPalette(palette);
  const entries = searchResult.entries;
  const commands = searchResult.commands;
  const home = palette.searchQuery.trim() === "";
  const search = searchResult.intent.searchTerm;
  const artifactRows = entries.map((entry) => artifactRowForEntry(palette, entry, home));
  const commandRows = commands.map((command) => rowForCommand(palette, command, home));
  const rows: LauncherRow[] = searchResult.commandsLead || search?.namespace === "command"
    ? [...commandRows, ...artifactRows]
    : [...artifactRows, ...commandRows];
  const orderedRows = home ? sortHomeRows(rows) : rows;
  ensureLauncherCommandIndex(palette, orderedRows.length);
  return {
    entries,
    commands,
    rows: orderedRows,
    hasCommandRows: orderedRows.some((row) => row.kind === "command" || row.command),
    hasRows: orderedRows.length > 0,
  };
}

export function selectedLauncherRow(palette: PromptPaletteRuntime) {
  const { rows } = launcherRowsForPalette(palette);
  if (rows.length === 0) return null;
  return rows[palette.launcherCommandIndex] ?? rows[0] ?? null;
}

function artifactRowForEntry(
  palette: PromptPaletteRuntime,
  entry: VisiblePromptEntry,
  home: boolean,
): LauncherArtifactRow {
  return {
    kind: "artifact",
    section: home ? homeArtifactSection(palette, entry.prompt) : artifactSectionLabel(palette),
    prompt: entry.prompt,
    promptIndex: entry.index,
  };
}

function rowForCommand(
  palette: PromptPaletteRuntime,
  command: LauncherCommand,
  home: boolean,
): LauncherRow {
  const artifact = artifactForCommand(palette, command);
  if (artifact) {
    return {
      kind: "artifact",
      section: home ? homeArtifactSection(palette, artifact.prompt) : commandSectionLabel(command),
      prompt: artifact.prompt,
      promptIndex: artifact.index,
      command,
    };
  }
  return {
    kind: "command",
    section: home ? homeCommandSection(command) : commandSectionLabel(command),
    command,
  };
}

function artifactForCommand(
  palette: PromptPaletteRuntime,
  command: LauncherCommand,
): { prompt: PromptDefinition; index: number } | null {
  if (command.id !== "load-artifact" && command.id !== "open-skill") return null;
  if (!command.artifactId) return null;
  const index = palette.prompts.findIndex((prompt) => prompt.id === command.artifactId);
  if (index < 0) return null;
  return { prompt: palette.prompts[index], index };
}

function artifactSectionLabel(palette: PromptPaletteRuntime) {
  const search = searchTermForQuery(palette.searchQuery.trim());
  if (search?.artifactType === "prompt") return "Prompts";
  if (search?.artifactType === "context") return "Contexts";
  if (search?.artifactType === "skill") return "Skills";
  return "Results";
}

function homeArtifactSection(
  palette: PromptPaletteRuntime,
  prompt: PromptDefinition,
) {
  return isContinueArtifact(palette, prompt) ? "Continue" : "Library";
}

function isContinueArtifact(
  palette: PromptPaletteRuntime,
  prompt: PromptDefinition,
) {
  if (promptArtifactType(prompt) === "context" && promptScope(prompt) === "ephemeral") {
    return true;
  }
  return palette.usageHistory.some((entry) =>
    entry.prompt_id === prompt.id
    && (entry.result === "delivered" || entry.result === "copied")
  );
}

function homeCommandSection(command: LauncherCommand) {
  if (
    command.id === "run-last-prompt"
    || command.id === "open-recent-context-stack"
  ) return "Continue";
  if (command.id === "user-command" || command.category === "Library") {
    return "Library";
  }
  if (command.category === "Workflow") return "Agent Workflows";
  if (
    command.id === "scratch"
    || command.id === "capture-clipboard"
    || command.id === "clipboard-to-context"
    || command.category === "Create"
  ) return "Create";
  if (command.category === "Import" || command.category === "Project") {
    return "Project";
  }
  return "Recovery / System";
}

function sortHomeRows(rows: LauncherRow[]) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftSection = homeSectionRank(left.row.section);
      const rightSection = homeSectionRank(right.row.section);
      if (leftSection !== rightSection) return leftSection - rightSection;
      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function homeSectionRank(section: string) {
  const index = HOME_SECTION_ORDER.indexOf(section as typeof HOME_SECTION_ORDER[number]);
  return index < 0 ? HOME_SECTION_ORDER.length : index;
}
