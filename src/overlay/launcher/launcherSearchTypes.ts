import type { VisiblePromptEntry } from "../../paletteRuntime";
import type {
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import type {
  SearchNamespace,
  SearchTerm,
} from "../../searchComposer";
import type { LauncherCommand } from "./launcherCommandTypes";

export type LauncherIndexedItem =
  | {
    type: "prompt-artifact" | "context-artifact" | "skill-package";
    key: string;
    prompt: PromptDefinition;
    promptIndex: number;
    handle: string;
    title: string;
    artifactType: PromptArtifactType;
  }
  | {
    type:
      | "built-in-command"
      | "user-defined-command"
      | "workflow-command"
      | "recovery-system-command";
    key: string;
    command: LauncherCommand;
    handle: string;
    title: string;
    keywords: readonly string[];
    aliases: readonly string[];
  };

export type LauncherIndexedCommandItem = Extract<
  LauncherIndexedItem,
  { command: LauncherCommand }
>;

export type LauncherIndexedArtifactItem = Extract<
  LauncherIndexedItem,
  { prompt: PromptDefinition }
>;

export type LauncherSearchIntent = {
  query: string;
  namespace: SearchNamespace | "home";
  term: string;
  commandTerm: string;
  searchTerm: SearchTerm | null;
  selectedContextIds: Set<string>;
  home: boolean;
};

export type RankingTraceEntry = {
  key: string;
  type: LauncherIndexedItem["type"] | "compose-scratch" | "create-command";
  label: string;
  score: number;
  reason: string;
  available?: boolean;
  primaryAction?: string;
};

export type RankingTrace = {
  query: string;
  intent: Pick<LauncherSearchIntent, "namespace" | "term" | "commandTerm" | "home">;
  indexedItemCount: number;
  indexedItemTypes: Record<LauncherIndexedItem["type"], number>;
  matches: RankingTraceEntry[];
};

export type LauncherSearchResult = {
  intent: LauncherSearchIntent;
  entries: VisiblePromptEntry[];
  commands: LauncherCommand[];
  commandsLead: boolean;
  trace: RankingTrace;
};

export type LauncherSearchOptions = {
  hasArtifactMatches?: boolean;
};

export type ScoredArtifact = {
  item: LauncherIndexedArtifactItem;
  score: number;
  reason: string;
};

export type ScoredCommand = {
  item: LauncherIndexedCommandItem;
  score: number;
  reason: string;
};
