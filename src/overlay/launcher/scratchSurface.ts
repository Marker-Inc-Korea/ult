import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  createLauncherBody,
  createLauncherShell,
  handleLauncherEscape,
} from "./launcherShell";
import { stopPaletteChromePointerDown } from "../shared/renderShared";
import type { PaletteRenderActions } from "../shared/renderTypes";

export function renderScratchPrompt(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const form = createLauncherShell(palette, actions, {
    tagName: "form",
    className: "palette-scratch",
    ariaLabel: "Launcher Scratch",
    onEscape: actions.cancelScratch,
  }) as HTMLFormElement;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    actions.submitScratch();
  });

  const textarea = createElement("textarea", "palette-scratch-input") as HTMLTextAreaElement;
  textarea.value = palette.scratchText;
  textarea.placeholder = "Write a prompt";
  textarea.spellcheck = true;
  textarea.rows = 1;
  textarea.readOnly = palette.scratchRefining || palette.deliveryInFlight;
  textarea.classList.toggle("is-refining", palette.scratchRefining);
  textarea.setAttribute("aria-label", "Scratch prompt");
  textarea.title = "Enter saves and loads. Command+R refines.";
  textarea.addEventListener("input", () => {
    actions.updateScratchText(textarea.value);
  });
  textarea.addEventListener("keydown", (event) => {
    if (handleLauncherEscape(event, actions.cancelScratch)) {
      return;
    }
    if (palette.scratchRefining || palette.deliveryInFlight) {
      event.preventDefault();
      return;
    }
    if (event.isComposing) return;
    if (
      isCommandOnly(event)
      && event.key.toLowerCase() === "z"
      && palette.scratchRefineSourceText
    ) {
      event.preventDefault();
      actions.restoreScratchOriginal();
      return;
    }
    if (
      isCommandOnly(event)
      && event.key.toLowerCase() === "k"
      && palette.scratchRefineResultText
      && !palette.scratchRefineApplied
    ) {
      event.preventDefault();
      actions.acceptScratchRefinement();
      return;
    }
    if (isCommandOnly(event) && event.key.toLowerCase() === "r") {
      event.preventDefault();
      actions.updateScratchText(textarea.value);
      actions.refineScratch();
      return;
    }
    if (isCommandOnly(event) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      actions.updateScratchText(textarea.value);
      actions.promoteScratchToCreate();
      return;
    }
    if (event.key !== "Enter") return;
    if (isCommandOnly(event)) {
      event.preventDefault();
      insertScratchLineBreak(textarea);
      actions.updateScratchText(textarea.value);
      return;
    }
    if (event.shiftKey) return;
    event.preventDefault();
    actions.updateScratchText(textarea.value);
    actions.submitScratch();
  });

  const body = createLauncherBody("palette-scratch-body");
  body.append(textarea);
  renderScratchRefinement(palette, body);
  renderScratchRefineError(palette, body);
  form.append(body);
  const footer = createElement("div", "palette-scratch-footer");
  const createPrompt = createElement(
    "button",
    "palette-artifact-secondary-action palette-scratch-create-action",
    "Create Prompt",
  ) as HTMLButtonElement;
  createPrompt.type = "button";
  createPrompt.disabled = palette.scratchRefining || palette.deliveryInFlight;
  createPrompt.title = "Open this scratch text in the create canvas.";
  createPrompt.addEventListener("click", (event) => {
    event.preventDefault();
    actions.updateScratchText(textarea.value);
    actions.promoteScratchToCreate();
  });
  footer.append(
    createElement("div", "palette-scratch-notice", scratchNoticeText(palette)),
    createPrompt,
  );
  form.append(footer);

  textarea.focus();
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}

function scratchNoticeText(palette: PromptPaletteRuntime) {
  if (palette.deliveryInFlight) {
    return "Saving scratch prompt...";
  }
  if (palette.scratchNotice) {
    return palette.scratchNotice;
  }
  if (palette.scratchRefineError) {
    return "Enter load · ⌘R retry · Esc";
  }
  if (palette.scratchRefineApplied) {
    return "Enter load · ⌘Z undo · Esc";
  }
  if (palette.scratchRefineResultText) {
    return "Enter load · ⌘K use · ⌘Z undo · Esc";
  }
  return "Enter load · ⌘S create · ⌘R refine · ⌘↵ newline · Esc";
}

function renderScratchRefineError(
  palette: PromptPaletteRuntime,
  body: HTMLElement,
) {
  if (!palette.scratchRefineError) return;
  const row = createElement("div", "palette-scratch-error");
  row.append(
    createElement("span", undefined, palette.scratchRefineError),
    scratchCommandHint("Retry", "⌘R"),
  );
  body.append(row);
}

function insertScratchLineBreak(textarea: HTMLTextAreaElement) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  if (typeof textarea.setRangeText === "function") {
    textarea.setRangeText("\n", start, end, "end");
    return;
  }
  textarea.value = `${textarea.value.slice(0, start)}\n${textarea.value.slice(end)}`;
  const nextPosition = start + 1;
  textarea.selectionStart = nextPosition;
  textarea.selectionEnd = nextPosition;
}

function renderScratchRefinement(
  palette: PromptPaletteRuntime,
  body: HTMLElement,
) {
  const sourceText = palette.scratchRefineSourceText;
  const resultText = palette.scratchRefineResultText;
  if (!palette.scratchRefining && !sourceText && !resultText) return;

  const alternative = createElement(
    "section",
    `palette-scratch-alternative-shell${palette.scratchRefining ? " is-loading" : ""}${
      palette.scratchRefineApplied ? " is-applied" : ""
    }`,
  );
  alternative.addEventListener("pointerdown", stopPaletteChromePointerDown);

  if (palette.scratchRefining) {
    const pending = scratchAlternativeTextarea("", "AI refined prompt");
    pending.className += " is-refining-alternative";
    alternative.append(
      pending,
      scratchChoiceBar([
        createElement("span", "palette-scratch-refine-status", "AI refining..."),
      ]),
    );
    body.append(alternative);
    return;
  }

  if (!sourceText || !resultText) return;

  if (palette.scratchRefineApplied) {
    alternative.append(
      scratchAlternativeTextarea(sourceText, "Original prompt"),
      scratchChoiceBar([
        scratchCommandHint("Undo", "⌘Z"),
      ]),
    );
    body.append(alternative);
    return;
  }

  alternative.append(
    scratchAlternativeTextarea(resultText, "AI refined prompt"),
    scratchChoiceBar([
      scratchCommandHint("Undo", "⌘Z"),
      scratchCommandHint("Use", "⌘K", true),
    ]),
  );
  body.append(alternative);
}

function scratchAlternativeTextarea(text: string, label: string) {
  const textarea = createElement(
    "textarea",
    "palette-scratch-input palette-scratch-alternative",
  ) as HTMLTextAreaElement;
  textarea.value = text;
  textarea.rows = 1;
  textarea.readOnly = true;
  textarea.spellcheck = false;
  textarea.setAttribute("aria-label", label);
  return textarea;
}

function scratchChoiceBar(children: HTMLElement[]) {
  const bar = createElement("div", "palette-scratch-choicebar");
  bar.append(...children);
  return bar;
}

function scratchCommandHint(
  label: string,
  keycap: string,
  primary = false,
) {
  const hint = createElement(
    "span",
    `palette-scratch-command${primary ? " is-primary" : ""}`,
  );
  hint.append(
    createElement("span", undefined, label),
    createElement("kbd", undefined, keycap),
  );
  return hint;
}
