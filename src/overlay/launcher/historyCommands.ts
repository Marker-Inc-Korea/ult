import {
  artifactHandle,
  deliveryLabels,
  isDeliverableArtifact,
  isNonExpiredArtifact,
} from "../../promptUtils";
import type { PromptDefinition, UsageHistoryEntry } from "../../types";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { isEphemeralClipContext } from "./ephemeralContextState";

export type HistoryArtifactMatch = {
  entry: UsageHistoryEntry;
  artifact: PromptDefinition;
};

export type FailedDeliveryMatch = {
  entry: UsageHistoryEntry;
  artifact: PromptDefinition | null;
};

export function mostRecentRunnableHistoryArtifact(
  palette: PromptPaletteRuntime,
): HistoryArtifactMatch | null {
  for (const entry of newestHistoryEntries(palette.usageHistory)) {
    if (!entry.prompt_id) continue;
    const artifact = palette.prompts.find((prompt) => prompt.id === entry.prompt_id) ?? null;
    if (!artifact || !isDeliverableArtifact(artifact) || !isNonExpiredArtifact(artifact)) {
      continue;
    }
    return { entry, artifact };
  }
  return null;
}

export function mostRecentFailedDelivery(
  palette: PromptPaletteRuntime,
): FailedDeliveryMatch | null {
  for (const entry of newestHistoryEntries(palette.usageHistory)) {
    if (entry.result !== "failed") continue;
    const artifact = entry.prompt_id
      ? palette.prompts.find((prompt) => prompt.id === entry.prompt_id) ?? null
      : null;
    return { entry, artifact };
  }
  return null;
}

export function expiredEphemeralClipContextCount(
  prompts: PromptDefinition[],
  now = Date.now(),
) {
  return prompts.filter((prompt) =>
    isEphemeralClipContext(prompt)
    && prompt.expires_at !== null
    && prompt.expires_at !== undefined
    && prompt.expires_at <= now
  ).length;
}

export function failedDeliverySummary(match: FailedDeliveryMatch) {
  const { entry, artifact } = match;
  const subject = artifact
    ? artifactHandle(artifact)
    : entry.prompt_id
    ? `artifact ${entry.prompt_id}`
    : "scratch prompt";
  const mode = deliveryLabels[entry.delivery_mode] ?? entry.delivery_mode;
  const timestamp = formatHistoryTimestamp(entry.timestamp_ms);
  return `Last failed delivery: ${subject} via ${mode} at ${timestamp}.`;
}

function newestHistoryEntries(history: UsageHistoryEntry[]) {
  return history
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) =>
      right.entry.timestamp_ms - left.entry.timestamp_ms || left.index - right.index
    )
    .map(({ entry }) => entry);
}

export function formatHistoryTimestamp(timestampMs: number) {
  if (!Number.isFinite(timestampMs)) return "unknown time";
  return new Date(timestampMs).toISOString();
}
