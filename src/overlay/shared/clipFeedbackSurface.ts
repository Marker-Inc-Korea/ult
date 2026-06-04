import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";

export function renderClipFeedback(palette: PromptPaletteRuntime) {
  if (!palette.clipFeedback) return;
  const feedback = createElement("div", "palette-clip-feedback");
  feedback.title = `${palette.clipFeedback.count} stacked context${
    palette.clipFeedback.count === 1 ? "" : "s"
  }. Press Ctrl+V in Launcher to choose.`;
  feedback.setAttribute("aria-label", feedback.title);
  feedback.append(
    createElement("span", "palette-clip-dot"),
    createElement("span", "palette-clip-count", `@${palette.clipFeedback.count}`),
  );
  palette.container.append(feedback);
}
