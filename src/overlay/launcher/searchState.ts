import type { PromptPaletteRuntime, VisiblePromptEntry } from "../../paletteRuntime";
import {
  canonicalArtifactHandle,
  isLauncherContextArtifact,
  isLauncherPromptArtifact,
  isPalettePrompt,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import { parseSearchComposerQuery, searchTermForQuery } from "../../searchComposer";
import type { PromptDefinition } from "../../types";

export const PROMPTS_PER_PAGE = 5;
const MIN_PROMPTS_PER_PAGE = 3;
const MAX_PROMPTS_PER_PAGE = 9;

export function setPromptPaletteSelectedIndex(
  palette: PromptPaletteRuntime,
  index: number,
) {
  if (palette.prompts.length === 0) {
    palette.selectedIndex = 0;
    return false;
  }

  const nextIndex = Math.max(0, Math.min(palette.prompts.length - 1, index));
  const changed = nextIndex !== palette.selectedIndex;
  palette.selectedIndex = nextIndex;
  if (changed) {
    palette.pendingConfirmPromptId = null;
  }
  ensureSelectedPromptVisible(palette);
  return changed;
}

export function setPromptPaletteSearchQuery(
  palette: PromptPaletteRuntime,
  query: string,
  options: {
    clearFeedback?: boolean;
    clearPanel?: boolean;
    resetSelection?: boolean;
  } = {},
) {
  if (palette.searchQuery === query) return false;
  palette.searchQuery = query;
  if (options.resetSelection !== false) {
    palette.launcherCommandIndex = 0;
  }
  if (options.clearFeedback !== false) {
    palette.launcherFeedback = null;
  }
  if (options.clearPanel === true) {
    palette.launcherArtifactPanel = null;
    palette.launcherPanelActionIndex = 0;
  }
  palette.visibleStart = 0;
  palette.pendingConfirmPromptId = null;
  ensureSelectedPromptVisible(palette);
  return true;
}

export function selectInterventionArtifactInPalette(
  palette: PromptPaletteRuntime,
  delta: number,
) {
  const entries = matchingPromptEntries(palette);
  if (entries.length === 0) return false;
  const currentPosition = Math.max(
    0,
    entries.findIndex((entry) => entry.index === palette.selectedIndex),
  );
  const nextPosition = (currentPosition + delta + entries.length) % entries.length;
  palette.selectedIndex = entries[nextPosition].index;
  palette.pendingConfirmPromptId = null;
  ensureSelectedPromptVisible(palette);
  return true;
}

export function selectedPrompt(palette: PromptPaletteRuntime) {
  const prompt = palette.prompts[palette.selectedIndex];
  if (!prompt) return undefined;
  if (!matchingPromptEntries(palette).some((entry) => entry.index === palette.selectedIndex)) {
    return undefined;
  }
  return prompt;
}

export function visiblePrompts(palette: PromptPaletteRuntime): VisiblePromptEntry[] {
  ensureSelectedPromptVisible(palette);
  return matchingPromptEntries(palette)
    .slice(palette.visibleStart, palette.visibleStart + palettePromptPageSize(palette))
    .map((entry, offset) => ({
      prompt: entry.prompt,
      index: entry.index,
      key: offset + 1,
    }));
}

export function palettePickerPrompts(palette: PromptPaletteRuntime) {
  ensureSelectedPromptVisible(palette);
  const entries = matchingPromptEntries(palette);
  if (entries.length === 0) return [];

  const selectedPosition = Math.max(
    0,
    entries.findIndex((entry) => entry.index === palette.selectedIndex),
  );
  const current = entries[selectedPosition];
  const pickerEntries: Array<VisiblePromptEntry & {
    slot: "previous" | "current" | "next";
  }> = [];

  if (entries.length > 1) {
    const previous = entries[(selectedPosition - 1 + entries.length) % entries.length];
    pickerEntries.push({
      prompt: previous.prompt,
      index: previous.index,
      key: 0,
      slot: "previous",
    });
  }

  pickerEntries.push({
    prompt: current.prompt,
    index: current.index,
    key: 1,
    slot: "current",
  });

  if (entries.length > 2) {
    const next = entries[(selectedPosition + 1) % entries.length];
    pickerEntries.push({
      prompt: next.prompt,
      index: next.index,
      key: 2,
      slot: "next",
    });
  }

  return pickerEntries;
}

export function setPromptPalettePageDelta(
  palette: PromptPaletteRuntime,
  delta: number,
) {
  const entries = matchingPromptEntries(palette);
  const pageSize = palettePromptPageSize(palette);
  if (entries.length <= pageSize) return false;
  const maxStart = Math.max(0, entries.length - pageSize);
  const nextStart = Math.max(
    0,
    Math.min(maxStart, palette.visibleStart + delta * pageSize),
  );
  if (nextStart === palette.visibleStart) return false;
  palette.visibleStart = nextStart;
  palette.selectedIndex = entries[nextStart]?.index ?? 0;
  palette.pendingConfirmPromptId = null;
  return true;
}

export function ensureSelectedPromptVisible(palette: PromptPaletteRuntime) {
  const entries = matchingPromptEntries(palette);
  const pageSize = palettePromptPageSize(palette);
  if (entries.length === 0) {
    palette.selectedIndex = 0;
    palette.visibleStart = 0;
    return;
  }

  let selectedPosition = entries.findIndex((entry) => entry.index === palette.selectedIndex);
  if (selectedPosition < 0) {
    selectedPosition = 0;
    palette.selectedIndex = entries[0].index;
  }

  if (entries.length <= pageSize) {
    palette.visibleStart = 0;
    return;
  }

  const maxStart = Math.max(0, entries.length - pageSize);
  if (selectedPosition < palette.visibleStart) {
    palette.visibleStart = Math.max(0, selectedPosition);
  } else if (selectedPosition >= palette.visibleStart + pageSize) {
    palette.visibleStart = selectedPosition - pageSize + 1;
  }
  palette.visibleStart = Math.min(palette.visibleStart, maxStart);
}

function matchingPromptEntries(palette: PromptPaletteRuntime) {
  const search = palette.surfaceMode === "search"
    ? searchTermForQuery(palette.searchQuery)
    : { namespace: "plain" as const, artifactType: null, term: "" };
  if (!search) return [];
  const selectedContextIds = palette.surfaceMode === "search"
    ? new Set(parseSearchComposerQuery(palette.searchQuery).contextIds)
    : new Set<string>();
  return palette.prompts
    .map((prompt, index) => ({ prompt, index }))
    .filter((entry) =>
      !selectedContextIds.has(entry.prompt.id)
      && promptMatchesSearch(entry.prompt, search),
    )
    .sort((left, right) =>
      compareSearchMatches(left, right, search),
    );
}

function promptMatchesSearch(
  prompt: PromptDefinition,
  search: NonNullable<ReturnType<typeof searchTermForQuery>>,
) {
  const artifactType = promptArtifactType(prompt);
  const scope = promptScope(prompt);
  if (search.namespace === "command") {
    return false;
  }
  if (search.artifactType) {
    if (search.artifactType === "prompt" && !isLauncherPromptArtifact(prompt)) {
      return false;
    }
    if (search.artifactType === "context" && !isLauncherContextArtifact(prompt)) {
      return false;
    }
    if (search.artifactType === "skill") {
      return false;
    }
  } else if (artifactType === "skill") {
    return false;
  } else if (artifactType === "prompt" && scope === "ephemeral") {
    return false;
  }
  if (!search.artifactType && search.term === "" && !isPalettePrompt(prompt)) {
    return false;
  }
  if (search.artifactType === null && search.term === "" && isPalettePrompt(prompt)) {
    return true;
  }
  const term = search.term.toLowerCase();
  if (!term) return true;
  return [
    prompt.title,
    canonicalArtifactHandle(prompt),
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
}

function compareSearchMatches(
  left: { prompt: PromptDefinition; index: number },
  right: { prompt: PromptDefinition; index: number },
  search: NonNullable<ReturnType<typeof searchTermForQuery>>,
) {
  const term = search.term.toLowerCase();
  if (term) {
    const leftScore = promptSearchScore(left.prompt, term);
    const rightScore = promptSearchScore(right.prompt, term);
    if (leftScore !== rightScore) return leftScore - rightScore;
  }

  if (search.artifactType === "prompt") {
    const leftPinned = isPalettePrompt(left.prompt);
    const rightPinned = isPalettePrompt(right.prompt);
    if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;
  }

  if (search.artifactType === "context") {
    const leftScopeRank = contextScopeRank(left.prompt);
    const rightScopeRank = contextScopeRank(right.prompt);
    if (leftScopeRank !== rightScopeRank) return leftScopeRank - rightScopeRank;
    if (leftScopeRank === 0) {
      const leftCreatedAt = left.prompt.created_at ?? 0;
      const rightCreatedAt = right.prompt.created_at ?? 0;
      if (leftCreatedAt !== rightCreatedAt) return rightCreatedAt - leftCreatedAt;
    }
  }

  return left.index - right.index;
}

function contextScopeRank(prompt: PromptDefinition) {
  return promptArtifactType(prompt) === "context" && promptScope(prompt) === "ephemeral"
    ? 0
    : 1;
}

function promptSearchScore(prompt: PromptDefinition, term: string) {
  const handle = canonicalArtifactHandle(prompt).slice(1).toLowerCase();
  const title = prompt.title.toLowerCase();
  if (handle === term) return 0;
  if (title === term) return 1;
  if (handle.startsWith(term)) return 2;
  if (title.startsWith(term)) return 3;
  if (handle.includes(term)) return 4;
  if (title.includes(term)) return 5;
  return 6;
}

function palettePromptPageSize(palette: PromptPaletteRuntime) {
  const configured = Number(palette.appSettings.palette_visible_count);
  if (!Number.isFinite(configured)) return PROMPTS_PER_PAGE;
  return Math.max(
    MIN_PROMPTS_PER_PAGE,
    Math.min(MAX_PROMPTS_PER_PAGE, Math.round(configured)),
  );
}
