import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { parseTemplateVariables } from "../../templatePrompt";
import type { PromptArtifactType } from "../../types";

export function validateComposerDraft(
  palette: PromptPaletteRuntime,
  originalId: string | null,
  artifactType: PromptArtifactType,
  id: string,
  title: string,
  body: string,
) {
  const errors: Partial<Record<"id" | "title" | "prompt", string>> = {};
  const handle = id.trim();
  if (!title.trim()) errors.title = "Title is required.";
  if (!handle) {
    errors.id = "Handle is required.";
  } else if (!/^[A-Za-z0-9_-]+$/.test(handle)) {
    errors.id = "Use letters, numbers, hyphen, or underscore.";
  } else if (palette.prompts.some((prompt) =>
    prompt.id === handle && prompt.id !== originalId
  )) {
    errors.id = `Handle "${handle}" already exists.`;
  }
  if (!body.trim()) {
    errors.prompt = artifactType === "skill"
      ? "Skill instructions are required."
      : "Body is required.";
  }
  if (artifactType === "prompt") {
    const template = parseTemplateVariables(body);
    if (template.errors.length > 0) {
      errors.prompt = template.errors[0];
    }
  }
  return errors;
}

export function setControlValidity(
  control: HTMLElement,
  message: string,
) {
  (control as HTMLElement & { setCustomValidity?: (message: string) => void })
    .setCustomValidity?.(message);
}
