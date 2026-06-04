import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  isLauncherContextArtifact,
  isLauncherPromptArtifact,
  isNonExpiredArtifact,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import { PROMPTS_PER_PAGE } from "./searchState";
import type {
  LauncherIndexedArtifactItem,
  LauncherIndexedItem,
  LauncherSearchIntent,
  ScoredArtifact,
} from "./launcherSearchTypes";

const MIN_PROMPTS_PER_PAGE = 3;
const MAX_PROMPTS_PER_PAGE = 9;

export function scoreArtifactMatches(
  items: LauncherIndexedItem[],
  intent: LauncherSearchIntent,
): ScoredArtifact[] {
  return items
    .filter((item): item is LauncherIndexedArtifactItem =>
      "prompt" in item
      && artifactEligibleForIntent(item.prompt, intent)
      && !intent.selectedContextIds.has(item.prompt.id)
      && artifactMatchesSearch(item, intent)
    )
    .map((item) => ({
      item,
      ...artifactScore(item, intent.term.toLowerCase()),
    }))
    .sort((left, right) =>
      left.score - right.score || left.item.promptIndex - right.item.promptIndex
    );
}

export function pageArtifactMatches(
  matches: ScoredArtifact[],
  palette: PromptPaletteRuntime,
) {
  const pageSize = launcherArtifactPageSize(palette);
  const start = Math.max(
    0,
    Math.min(palette.visibleStart, Math.max(0, matches.length - pageSize)),
  );
  return matches.slice(start, start + pageSize);
}

export function artifactMatchesSearch(
  item: LauncherIndexedArtifactItem,
  intent: LauncherSearchIntent,
) {
  const term = intent.term.toLowerCase();
  if (!term) return true;
  return searchableArtifactText(item).includes(term);
}

export function artifactScore(
  item: LauncherIndexedArtifactItem,
  term: string,
) {
  if (!term) return { score: 0, reason: "namespace list" };
  const handle = item.handle.slice(1).toLowerCase();
  const title = item.title.toLowerCase();
  if (handle === term) return { score: 0, reason: "exact handle" };
  if (title === term) return { score: 1, reason: "exact title" };
  if (handle.startsWith(term)) return { score: 2, reason: "handle prefix" };
  if (title.startsWith(term)) return { score: 3, reason: "title prefix" };
  if (handle.includes(term)) return { score: 4, reason: "handle contains" };
  if (title.includes(term)) return { score: 5, reason: "title contains" };
  return { score: 6, reason: "fuzzy contains" };
}

function artifactEligibleForIntent(
  prompt: PromptDefinition,
  intent: LauncherSearchIntent,
) {
  if (!isNonExpiredArtifact(prompt)) return false;
  if (intent.namespace === "command") return false;
  if (intent.namespace === "skill") return false;
  if (intent.namespace === "prompt") return isLauncherPromptArtifact(prompt);
  if (intent.namespace === "context") return isLauncherContextArtifact(prompt);
  if (promptArtifactType(prompt) === "skill") return false;
  if (promptArtifactType(prompt) === "prompt" && promptScope(prompt) === "ephemeral") {
    return false;
  }
  return true;
}

function searchableArtifactText(item: LauncherIndexedArtifactItem) {
  return [
    item.title,
    item.handle,
  ].join(" ").toLowerCase();
}

function launcherArtifactPageSize(palette: PromptPaletteRuntime) {
  const configured = Number(palette.appSettings.palette_visible_count);
  if (!Number.isFinite(configured)) return PROMPTS_PER_PAGE;
  return Math.max(
    MIN_PROMPTS_PER_PAGE,
    Math.min(MAX_PROMPTS_PER_PAGE, Math.round(configured)),
  );
}
