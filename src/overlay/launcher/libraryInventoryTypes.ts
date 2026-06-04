import type {
  LauncherLibraryFilter,
  LauncherLibrarySort,
} from "../../paletteRuntime";
import type { PromptDefinition } from "../../types";
import type { LauncherCommand } from "./launcherCommandTypes";

export type LibraryArtifactRow = {
  kind: "artifact";
  prompt: PromptDefinition;
  promptIndex: number;
  dependencies: string[];
  issueCount: number;
};

export type LibraryCommandRow = {
  kind: "command";
  command: LauncherCommand;
  dependencies: string[];
  issueCount: number;
  inventoryIndex: number;
};

export type LibraryIssueRow = {
  kind: "issue";
  id: string;
  severity: "warning" | "error";
  title: string;
  detail: string;
  subject?: string;
  actionCommand?: LauncherCommand;
};

export type LibraryRow = LibraryArtifactRow | LibraryCommandRow | LibraryIssueRow;

export type LibraryInventoryContext = {
  prompts: PromptDefinition[];
  promptById: Map<string, PromptDefinition>;
  recentUseByArtifactId: Map<string, number>;
  clearExpiredCommand: LauncherCommand | null;
  openLibraryCommand: LauncherCommand | null;
};

export const LIBRARY_FILTERS: Array<{
  id: LauncherLibraryFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "prompts", label: "Prompts" },
  { id: "contexts", label: "Contexts" },
  { id: "skills", label: "Skills" },
  { id: "commands", label: "Commands" },
];

export const LIBRARY_SORTS: Array<{
  id: LauncherLibrarySort;
  label: string;
}> = [
  { id: "recent", label: "Recent" },
  { id: "updated", label: "Updated" },
  { id: "type", label: "Type" },
  { id: "pinned", label: "Pinned" },
  { id: "issues", label: "Issues" },
];
