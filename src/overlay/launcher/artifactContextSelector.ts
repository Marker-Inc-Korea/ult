import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { artifactHandle, promptArtifactType } from "../../promptUtils";
import type { PromptDefinition } from "../../types";

export function createContextSelector(
  palette: PromptPaletteRuntime,
  draft: PromptDefinition,
  originalId: string | null,
) {
  const selected = new Set(draft.contexts ?? []);
  const contexts = palette.prompts.filter((prompt) =>
    promptArtifactType(prompt) === "context" && prompt.id !== originalId,
  );
  const section = createElement("section", "palette-artifact-composer-card");
  section.append(createElement("h2", undefined, "Context Dependencies"));
  const controls: HTMLInputElement[] = [];
  if (contexts.length === 0) {
    section.append(createElement("p", undefined, "No contexts available."));
  } else {
    for (const context of contexts) {
      const checkbox = createElement("input") as HTMLInputElement;
      checkbox.type = "checkbox";
      checkbox.value = context.id;
      checkbox.checked = selected.has(context.id);
      const row = createElement("label", "palette-artifact-composer-check");
      row.append(
        checkbox,
        createElement("span", undefined, context.title),
        createElement("small", undefined, artifactHandle(context)),
      );
      section.append(row);
      controls.push(checkbox);
    }
  }
  return {
    root: section,
    controls,
    selectedIds: () => controls
      .filter((control) => control.checked)
      .map((control) => control.value),
  };
}
