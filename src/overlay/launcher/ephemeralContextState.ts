import type { EphemeralContextCaptureEvent, PromptDefinition } from "../../types";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  artifactHandle,
  isNonExpiredArtifact,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import { ensureSelectedPromptVisible } from "./searchState";

export const MAX_EPHEMERAL_CONTEXT_STACK = 20;
export const EPHEMERAL_CONTEXT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type ClipFeedbackState = {
  handle: string;
  preview: string;
  count: number;
};

export function addEphemeralContextCapture(
  palette: PromptPaletteRuntime,
  capture: EphemeralContextCaptureEvent,
) {
  const context = normalizeCapturedContext(capture);
  if (!context) return null;

  const selectedId = palette.prompts[palette.selectedIndex]?.id ?? null;
  const existingStack = palette.prompts.filter((prompt) =>
    isEphemeralClipContext(prompt) && prompt.id !== context.id
  );
  const persistentArtifacts = palette.prompts.filter((prompt) =>
    !isEphemeralClipContext(prompt) && prompt.id !== context.id
  );

  palette.prompts = [context, ...existingStack, ...persistentArtifacts];
  palette.contextPickerSelectedIndex = 0;
  syncClipFeedbackFromCatalog(palette);

  const selectedIndex = selectedId
    ? palette.prompts.findIndex((prompt) => prompt.id === selectedId)
    : -1;
  palette.selectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  if (palette.surfaceMode === "search" && palette.searchQuery.trim().startsWith("@")) {
    palette.selectedIndex = 0;
  }
  ensureSelectedPromptVisible(palette);
  return context;
}

export function clearClipFeedback(palette: PromptPaletteRuntime) {
  palette.clipFeedback = null;
}

export function syncClipFeedbackFromCatalog(palette: PromptPaletteRuntime) {
  const stack = ephemeralClipContextEntries(palette.prompts);
  palette.ephemeralContextCount = stack.length;
  if (stack.length === 0) {
    palette.clipFeedback = null;
    return false;
  }

  const top = stack[0];
  palette.clipFeedback = {
    handle: artifactHandle(top),
    preview: top.description,
    count: stack.length,
  };
  return true;
}

export function ephemeralClipContextEntries(prompts: PromptDefinition[]) {
  const now = Date.now();
  return prompts
    .filter((prompt) =>
      isEphemeralClipContext(prompt)
      && isNonExpiredArtifact(prompt, now)
    )
    .sort((left, right) =>
      (right.created_at ?? 0) - (left.created_at ?? 0)
      || right.id.localeCompare(left.id),
    )
    .slice(0, MAX_EPHEMERAL_CONTEXT_STACK);
}

export function ephemeralContextPickerEntries(palette: PromptPaletteRuntime) {
  return ephemeralClipContextEntries(palette.prompts);
}

export function selectedEphemeralContext(palette: PromptPaletteRuntime) {
  const entries = ephemeralContextPickerEntries(palette);
  if (entries.length === 0) return null;
  const index = clampContextPickerIndex(palette.contextPickerSelectedIndex, entries.length);
  palette.contextPickerSelectedIndex = index;
  return entries[index] ?? null;
}

export function selectEphemeralContextPickerDelta(
  palette: PromptPaletteRuntime,
  delta: number,
) {
  const entries = ephemeralContextPickerEntries(palette);
  if (entries.length === 0) {
    palette.contextPickerSelectedIndex = 0;
    return false;
  }
  const current = clampContextPickerIndex(palette.contextPickerSelectedIndex, entries.length);
  palette.contextPickerSelectedIndex = (current + delta + entries.length) % entries.length;
  return true;
}

export function setEphemeralContextPickerSelectedIndex(
  palette: PromptPaletteRuntime,
  index: number,
) {
  const entries = ephemeralContextPickerEntries(palette);
  if (entries.length === 0) {
    palette.contextPickerSelectedIndex = 0;
    return false;
  }
  const nextIndex = clampContextPickerIndex(index, entries.length);
  const changed = nextIndex !== palette.contextPickerSelectedIndex;
  palette.contextPickerSelectedIndex = nextIndex;
  return changed;
}

export function isEphemeralClipContext(
  prompt: Pick<PromptDefinition, "artifact_type" | "scope" | "source">,
) {
  return promptArtifactType(prompt) === "context"
    && promptScope(prompt) === "ephemeral"
    && prompt.source === "clipboard";
}

function previewText(text: string) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  return firstLine.length > 96 ? `${firstLine.slice(0, 96)}...` : firstLine;
}

function normalizeCapturedContext(capture: EphemeralContextCaptureEvent) {
  const artifact = capture.artifact;
  if (!artifact.prompt.trim()) return null;
  return {
    ...artifact,
    artifact_type: "context" as const,
    scope: "ephemeral" as const,
    pinned: false,
    description: artifact.description || capture.preview || previewText(artifact.prompt),
    created_at: artifact.created_at ?? capture.timestamp_ms,
    expires_at: artifact.expires_at ?? capture.timestamp_ms + EPHEMERAL_CONTEXT_TTL_MS,
    source: artifact.source ?? "clipboard" as const,
  } satisfies PromptDefinition;
}

function clampContextPickerIndex(index: number, length: number) {
  if (length <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(length - 1, Math.round(index)));
}
