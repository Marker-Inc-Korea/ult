import { createElement } from "../../dom";
import { palettePickerPrompts, type PromptPaletteRuntime } from "../../paletteRuntime";
import { artifactHandle } from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  createPromptControl,
  stopPaletteChromePointerDown,
} from "../shared/renderShared";

export function renderPanelPalette(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const shell = createElement("section", "palette-panel");
  shell.addEventListener("pointerdown", stopPaletteChromePointerDown);
  const rail = createElement("div", "panel-rail");
  rail.addEventListener("pointerdown", stopPaletteChromePointerDown);

  const entries = palettePickerPrompts(palette);
  if (entries.length === 0) {
    rail.append(createElement("div", "palette-empty", "No artifacts"));
  }

  for (const entry of entries) {
    const className = `panel-intervention palette-picker-entry is-${entry.slot}`;
    const item = entry.slot === "current"
      ? createPromptControl(palette, entry.prompt, entry.index, className, actions)
      : createElement("div", `${className} is-ghost`);
    if (entry.slot !== "current") {
      item.setAttribute("aria-hidden", "true");
    }
    item.append(palettePickerEntryContent(entry.prompt, entry.slot));
    rail.append(item);
  }

  shell.append(rail);
  palette.container.append(shell);
}

function palettePickerEntryContent(
  prompt: Pick<PromptDefinition, "artifact_type" | "id" | "title">,
  slot: "previous" | "current" | "next",
) {
  const handle = artifactHandle(prompt);
  if (slot !== "current") {
    return createElement("span", "prompt-handle palette-picker-ghost-handle", handle);
  }

  const content = createElement("span", "palette-picker-current-copy");
  content.append(createElement("span", "palette-picker-handle", handle));
  return content;
}
