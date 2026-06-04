import type { PromptPaletteRuntime } from "../../paletteRuntime";
import type { PromptArtifactType, PromptDefinition } from "../../types";
import { skillMarkdownBody } from "./skillMarkdown";

export type ArtifactComposerKind = "new" | "edit" | "duplicate";

export function composerInitialDraft(
  prompts: PromptPaletteRuntime["prompts"],
  options: {
    kind: ArtifactComposerKind;
    initialId?: string | null;
  },
  sourceArtifact: PromptDefinition | null,
  artifactType: PromptArtifactType,
): PromptDefinition {
  if (sourceArtifact && options.kind === "duplicate") {
    return {
      ...sourceArtifact,
      id: uniqueArtifactId(`${sourceArtifact.id}-copy`, prompts, null),
      title: `${sourceArtifact.title} Copy`,
      pinned: false,
      shortcut: null,
      prompt: artifactType === "skill"
        ? skillMarkdownBody(sourceArtifact.prompt)
        : sourceArtifact.prompt,
    };
  }
  if (sourceArtifact) {
    return {
      ...sourceArtifact,
      prompt: artifactType === "skill"
        ? skillMarkdownBody(sourceArtifact.prompt)
        : sourceArtifact.prompt,
    };
  }
  const initialId = slugifyArtifactId(options.initialId ?? "");
  return {
    id: initialId,
    title: initialId ? titleFromHandle(initialId) : "",
    artifact_type: artifactType,
    scope: "persistent",
    pinned: false,
    description: "",
    prompt: "",
    contexts: [],
    shortcut: null,
    confirm: false,
    template_arguments: [],
  };
}

export function composerBodyValue(
  draft: PromptDefinition,
  artifactType: PromptArtifactType,
) {
  return artifactType === "skill" ? skillMarkdownBody(draft.prompt) : draft.prompt;
}

export function slugifyArtifactId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleFromHandle(handle: string) {
  return handle
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function uniqueArtifactId(
  base: string,
  prompts: PromptDefinition[],
  originalId: string | null,
) {
  const fallback = base || "new-item";
  const existing = new Set(
    prompts
      .filter((prompt) => prompt.id !== originalId)
      .map((prompt) => prompt.id),
  );
  if (!existing.has(fallback)) return fallback;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${fallback}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${fallback}-${Date.now()}`;
}
