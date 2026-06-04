import type { DeliveryMode, PromptArtifactType, PromptDefinition, PromptScope } from "./types";

export const DEFAULT_LOADED_DELIVERY_MODE: DeliveryMode = "paste";

export const interventionDeliveryModes = [
  "paste",
  "send",
  "interrupt-send",
  "copy",
] as const satisfies readonly DeliveryMode[];

export const deliveryLabels = {
  copy: "Copy",
  paste: "Paste",
  send: "Paste + Enter",
  "interrupt-send": "Interrupt + Enter",
} as const;

export const artifactTypeLabels = {
  prompt: "Prompt",
  context: "Context",
  skill: "Skill",
} as const satisfies Record<PromptArtifactType, string>;

export const scopeLabels = {
  persistent: "Persistent",
  ephemeral: "Ephemeral",
} as const satisfies Record<PromptScope, string>;

export function promptArtifactType(prompt: Pick<PromptDefinition, "artifact_type">) {
  return prompt.artifact_type ?? "prompt";
}

export function artifactHandle(
  prompt: Pick<PromptDefinition, "artifact_type" | "id">,
) {
  const type = promptArtifactType(prompt);
  const prefix = type === "context" ? "@" : type === "skill" ? "$" : "#";
  return `${prefix}${prompt.id}`;
}

type ArtifactIdLike = string | Pick<PromptDefinition, "id">;

export function promptArtifactHandle(id: ArtifactIdLike) {
  return `#${artifactIdValue(id)}`;
}

export function contextArtifactHandle(id: ArtifactIdLike) {
  return `@${artifactIdValue(id)}`;
}

export function skillArtifactHandle(id: ArtifactIdLike) {
  return `$${artifactIdValue(id)}`;
}

export function launcherCommandHandle(id: string) {
  return `/${id}`;
}

export function canonicalArtifactHandle(
  prompt: Pick<PromptDefinition, "artifact_type" | "id">,
) {
  const type = promptArtifactType(prompt);
  if (type === "context") return contextArtifactHandle(prompt);
  if (type === "skill") return skillArtifactHandle(prompt);
  return promptArtifactHandle(prompt);
}

export function artifactHandleMatches(
  prompt: Pick<PromptDefinition, "artifact_type" | "id">,
  handle: string,
) {
  return handle === canonicalArtifactHandle(prompt);
}

function artifactIdValue(id: ArtifactIdLike) {
  return typeof id === "string" ? id : id.id;
}

export function isArtifactHandleTitleRedundant(handle: string, title: string) {
  return normalizeArtifactLabel(handle) === normalizeArtifactLabel(title);
}

function normalizeArtifactLabel(value: string) {
  return value
    .replace(/^[/#@$]/, "")
    .replace(/[-_]+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function promptScope(prompt: Pick<PromptDefinition, "scope">) {
  return prompt.scope ?? "persistent";
}

export function isNonExpiredArtifact(
  prompt: Pick<PromptDefinition, "scope" | "expires_at">,
  now = Date.now(),
) {
  if (promptScope(prompt) !== "ephemeral") return true;
  return !prompt.expires_at || prompt.expires_at > now;
}

export function isPersistentPrompt(
  prompt: Pick<PromptDefinition, "artifact_type" | "scope">,
) {
  return promptArtifactType(prompt) === "prompt" && promptScope(prompt) === "persistent";
}

export function isLauncherPromptArtifact(
  prompt: Pick<PromptDefinition, "artifact_type" | "scope" | "expires_at">,
) {
  return promptArtifactType(prompt) === "prompt"
    && promptScope(prompt) === "persistent"
    && isNonExpiredArtifact(prompt);
}

export function isLauncherContextArtifact(
  prompt: Pick<PromptDefinition, "artifact_type" | "scope" | "expires_at">,
) {
  return promptArtifactType(prompt) === "context"
    && isNonExpiredArtifact(prompt);
}

export function isPersistentContextArtifact(
  prompt: Pick<PromptDefinition, "artifact_type" | "scope" | "expires_at">,
) {
  return promptArtifactType(prompt) === "context"
    && promptScope(prompt) === "persistent"
    && isNonExpiredArtifact(prompt);
}

export function isLauncherSkillArtifact(
  prompt: Pick<PromptDefinition, "artifact_type" | "scope" | "expires_at">,
) {
  return promptArtifactType(prompt) === "skill"
    && promptScope(prompt) === "persistent"
    && isNonExpiredArtifact(prompt);
}

export function isSkillArtifact(prompt: Pick<PromptDefinition, "artifact_type">) {
  return promptArtifactType(prompt) === "skill";
}

export function isDeliverableArtifact(prompt: Pick<PromptDefinition, "artifact_type">) {
  return !isSkillArtifact(prompt);
}

export function artifactContentLabel(prompt: Pick<PromptDefinition, "artifact_type">) {
  return isSkillArtifact(prompt) ? "Source" : "Preview";
}

export function isPalettePrompt(
  prompt: Pick<PromptDefinition, "artifact_type" | "scope" | "pinned">,
) {
  return isPersistentPrompt(prompt) && prompt.pinned === true;
}

export function mergePromptsWithDiagnostics(
  bundled: PromptDefinition[],
  custom: PromptDefinition[],
) {
  const merged = new Map<string, PromptDefinition>();
  for (const prompt of bundled) merged.set(prompt.id, prompt);
  const bundledIds = new Set(bundled.map((prompt) => prompt.id));
  const warnings: string[] = [];
  for (const prompt of custom) {
    if (bundledIds.has(prompt.id)) {
      warnings.push(`local artifact \`${prompt.id}\` overrides a bundled item`);
    }
    merged.set(prompt.id, prompt);
  }
  return { prompts: [...merged.values()], warnings };
}

export function promptInitials(title: string) {
  const parts = title
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function shortcutLabel(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => {
      const token = part.trim().toLowerCase();
      if (token === "super") return "Cmd";
      if (token === "alt") return "Opt";
      if (token === "control") return "Ctrl";
      if (token === "shift") return "Shift";
      if (token === "space") return "Space";
      if (token === "escape") return "Esc";
      if (token.startsWith("digit")) return token.slice("digit".length);
      if (token.startsWith("key")) return token.slice("key".length).toUpperCase();
      return token.toUpperCase();
    })
    .join("+");
}
