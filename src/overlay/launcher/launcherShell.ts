import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { stopPaletteChromePointerDown } from "../shared/renderShared";
import type { PaletteRenderActions } from "../shared/renderTypes";

type LauncherShellOptions<K extends keyof HTMLElementTagNameMap> = {
  tagName: K;
  className?: string;
  ariaLabel?: string;
  onEscape?: () => void;
};

export function createLauncherShell<K extends keyof HTMLElementTagNameMap>(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  options: LauncherShellOptions<K>,
): HTMLElementTagNameMap[K] {
  const dismissLayer = createElement("div", "palette-launcher-dismiss-layer");
  dismissLayer.setAttribute("aria-hidden", "true");
  dismissLayer.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.unload();
  });

  const shell = createElement(
    options.tagName,
    [
      "palette-launcher",
      "palette-launcher-shell",
      options.className,
    ].filter(Boolean).join(" "),
  ) as HTMLElementTagNameMap[K];
  if (options.ariaLabel) {
    shell.setAttribute("aria-label", options.ariaLabel);
  }
  shell.addEventListener("pointerdown", (event: Event) => {
    stopPaletteChromePointerDown(event as PointerEvent);
  });
  shell.addEventListener("keydown", (event: Event) => {
    handleLauncherEscape(event as KeyboardEvent, options.onEscape ?? actions.unload);
  });

  palette.container.append(dismissLayer, shell);
  return shell;
}

export function handleLauncherEscape(
  event: KeyboardEvent,
  onEscape: () => void,
) {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  event.stopPropagation();
  onEscape();
  return true;
}

export function createLauncherFooter(
  hints: Array<{ keys: string[]; label: string }>,
  className = "",
  hintClassName = "",
) {
  const footer = createElement(
    "div",
    ["palette-launcher-footer", className].filter(Boolean).join(" "),
  );
  for (const hint of hints) {
    footer.append(createLauncherHint(hint.keys, hint.label, hintClassName));
  }
  return footer;
}

export function createLauncherBody(className = "") {
  return createElement(
    "div",
    ["palette-launcher-body", className].filter(Boolean).join(" "),
  );
}

function createLauncherHint(
  keys: string[],
  label: string,
  className = "",
) {
  const hint = createElement(
    "span",
    ["palette-launcher-hint", className].filter(Boolean).join(" "),
  );
  for (const key of keys) {
    hint.append(createElement("kbd", undefined, key));
  }
  hint.append(createElement("span", undefined, label));
  return hint;
}
