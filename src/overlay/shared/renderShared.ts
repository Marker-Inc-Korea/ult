import { createElement } from "../../dom";
import { promptArtifactType } from "../../promptUtils";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "./renderTypes";

export function createPromptControl(
  palette: PromptPaletteRuntime,
  prompt: PromptDefinition,
  index: number,
  className: string,
  actions: PaletteRenderActions,
) {
  const button = createElement("button", `${className} palette-prompt-control`);
  button.type = "button";
  button.dataset.promptIndex = String(index);
  button.title = `${index + 1}. ${prompt.title} - ${prompt.description}`;
  button.setAttribute("role", "menuitem");
  button.classList.toggle("is-selected", index === palette.selectedIndex);
  button.classList.toggle(
    "is-confirming",
    palette.pendingConfirmPromptId === prompt.id,
  );
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.selectAndLoad(index, button);
  });
  return button;
}

export function appendTemplateMarker(button: HTMLElement, prompt: PromptDefinition) {
  if (!prompt.template_variables?.length) return;
  const marker = createElement("span", "template-marker", "{{}}");
  marker.title = `Template: ${prompt.template_variables.join(", ")}`;
  button.append(marker);
}

export function appendArtifactMarker(button: HTMLElement, prompt: PromptDefinition) {
  if (promptArtifactType(prompt) !== "context") return;
  const marker = createElement("span", "template-marker", "@");
  marker.title = "Context";
  button.append(marker);
}

export function stopPaletteChromePointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null;
  if (!target?.closest(".palette-prompt-control")) {
    event.stopPropagation();
  }
}
