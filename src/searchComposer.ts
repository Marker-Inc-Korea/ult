import {
  artifactHandleMatches,
  canonicalArtifactHandle,
  isLauncherContextArtifact,
  isPersistentPrompt,
  promptArtifactType,
} from "./promptUtils";
import type { PromptDefinition } from "./types";

export type SearchComposerToken = {
  handle: string;
  kind: "prompt" | "context" | "skill" | "command";
  id: string;
};

export type SearchComposerQuery = {
  tokens: SearchComposerToken[];
  promptId: string | null;
  commandId: string | null;
  contextIds: string[];
  activeToken: string;
  activeStart: number;
  activeEnd: number;
};

export type SearchNamespace = "prompt" | "context" | "skill" | "command" | "plain";

export type SearchTerm = {
  namespace: SearchNamespace;
  artifactType: "prompt" | "context" | "skill" | null;
  term: string;
};

const HANDLE_PATTERN = /^([#/@$])([A-Za-z0-9_-]+)$/;

export function parseSearchComposerQuery(query: string): SearchComposerQuery {
  const spans = queryTokenSpans(query);
  const endsWithSpace = /\s$/.test(query);
  const activeSpan = endsWithSpace ? null : spans[spans.length - 1] ?? null;
  const tokens: SearchComposerToken[] = [];
  let promptId: string | null = null;
  let commandId: string | null = null;
  const contextIds: string[] = [];

  for (const span of spans) {
    const token = tokenFromHandle(span.text);
    if (!token) continue;
    tokens.push(token);
    if (token.kind === "prompt") {
      promptId = token.id;
    } else if (token.kind === "command") {
      commandId = token.id;
    } else if (token.kind === "context" && !contextIds.includes(token.id)) {
      contextIds.push(token.id);
    }
  }

  return {
    tokens,
    promptId,
    commandId,
    contextIds,
    activeToken: activeSpan?.text ?? "",
    activeStart: activeSpan?.start ?? query.length,
    activeEnd: activeSpan?.end ?? query.length,
  };
}

export function searchQueryWithHandle(
  query: string,
  prompt: PromptDefinition,
) {
  if (promptArtifactType(prompt) === "prompt" && !isPersistentPrompt(prompt)) {
    return normalizeComposerQuery(query);
  }
  const handle = canonicalArtifactHandle(prompt);
  const parsed = parseSearchComposerQuery(query);
  const active = parsed.activeToken;
  const replacingActiveHandle =
    active.startsWith("#")
    || active.startsWith("/")
    || active.startsWith("@")
    || active.startsWith("$")
    || active.length > 0;
  const before = replacingActiveHandle ? query.slice(0, parsed.activeStart) : query;
  const after = replacingActiveHandle ? query.slice(parsed.activeEnd) : "";
  const next = `${before}${handle}${after}`.trim();
  return normalizeComposerQuery(
    promptArtifactType(prompt) === "prompt"
      ? replacePromptHandle(next, handle)
      : next,
  );
}

export function removeSearchComposerHandle(query: string, handle: string) {
  const next = queryTokenSpans(query)
    .map((span) => span.text)
    .filter((token) => token !== handle)
    .join(" ");
  return normalizeComposerQuery(next);
}

export function searchComposerHandleBeforeCursor(
  query: string,
  cursor: number,
) {
  const clampedCursor = Math.max(0, Math.min(query.length, cursor));
  const spans = queryTokenSpans(query);
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index];
    if (span.end > clampedCursor) continue;
    if (query.slice(span.end, clampedCursor).trim().length > 0) return null;
    return tokenFromHandle(span.text)?.handle ?? null;
  }
  return null;
}

export function composerPrompt(
  query: string,
  prompts: PromptDefinition[],
) {
  const parsed = parseSearchComposerQuery(query);
  const promptId = parsed.promptId;
  if (!promptId) return null;
  return prompts.find((prompt) =>
    prompt.id === promptId && isPersistentPrompt(prompt),
  ) ?? null;
}

export function composerContextIds(query: string, prompts: PromptDefinition[]) {
  const contextIds = parseSearchComposerQuery(query).contextIds;
  if (contextIds.length === 0) return [];
  const validContextIds = new Set(
    prompts
      .filter(isLauncherContextArtifact)
      .map((prompt) => prompt.id),
  );
  return contextIds.filter((id) => validContextIds.has(id));
}

export function searchTermForQuery(query: string) {
  const parsed = parseSearchComposerQuery(query);
  const token = parsed.activeToken.trim();
  if (!token) return null;
  if (token.startsWith("#")) {
    return {
      namespace: "prompt" as const,
      artifactType: "prompt" as const,
      term: token.slice(1).trim(),
    };
  }
  if (token.startsWith("@")) {
    return {
      namespace: "context" as const,
      artifactType: "context" as const,
      term: token.slice(1).trim(),
    };
  }
  if (token.startsWith("/")) {
    return {
      namespace: "command" as const,
      artifactType: null,
      term: token.slice(1).trim(),
    };
  }
  if (token.startsWith("$")) {
    return {
      namespace: "skill" as const,
      artifactType: "skill" as const,
      term: token.slice(1).trim(),
    };
  }
  return { namespace: "plain" as const, artifactType: null, term: token };
}

function tokenFromHandle(handle: string): SearchComposerToken | null {
  const match = handle.match(HANDLE_PATTERN);
  if (!match) return null;
  const kind = match[1] === "#"
    ? "prompt"
    : match[1] === "@"
    ? "context"
    : match[1] === "$"
    ? "skill"
    : "command";
  return {
    handle,
    kind,
    id: match[2],
  };
}

function replacePromptHandle(query: string, handle: string) {
  let replaced = false;
  const tokens = queryTokenSpans(query).map((span) => {
    if (!span.text.startsWith("#") && !span.text.startsWith("/")) return span.text;
    if (span.text === handle && !replaced) {
      replaced = true;
      return span.text;
    }
    if (!replaced) {
      replaced = true;
      return handle;
    }
    return "";
  }).filter(Boolean);
  if (!replaced) tokens.unshift(handle);
  return tokens.join(" ");
}

export function queryHasArtifactHandle(
  prompt: Pick<PromptDefinition, "artifact_type" | "id">,
  handle: string,
) {
  return artifactHandleMatches(prompt, handle);
}

function normalizeComposerQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

function queryTokenSpans(query: string) {
  const spans: Array<{ text: string; start: number; end: number }> = [];
  for (const match of query.matchAll(/\S+/g)) {
    const text = match[0];
    const start = match.index ?? 0;
    spans.push({
      text,
      start,
      end: start + text.length,
    });
  }
  return spans;
}
