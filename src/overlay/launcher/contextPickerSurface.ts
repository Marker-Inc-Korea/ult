import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { artifactHandle } from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import { createLauncherBody, createLauncherFooter, createLauncherShell } from "./launcherShell";
import {
  ephemeralContextPickerEntries,
  setEphemeralContextPickerSelectedIndex,
} from "./ephemeralContextState";

export function renderContextPicker(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-context-picker",
    ariaLabel: "Clipboard stack",
    onEscape: actions.unload,
  });
  shell.tabIndex = -1;
  const body = createLauncherBody("palette-context-body");
  body.append(contextPickerHeader());

  const entries = ephemeralContextPickerEntries(palette);
  if (entries.length === 0) {
    body.append(createElement("div", "palette-context-empty", "No clipboard clips"));
    body.append(contextPickerFooter());
    shell.append(body);
    window.setTimeout(() => {
      shell.focus();
    }, 0);
    return;
  }
  setEphemeralContextPickerSelectedIndex(
    palette,
    palette.contextPickerSelectedIndex,
  );

  const rail = createElement("div", "palette-context-rail");
  for (const [index, context] of entries.entries()) {
    const row = createElement(
      "button",
      `palette-context-entry${index === palette.contextPickerSelectedIndex ? " is-selected" : ""}`,
    );
    row.type = "button";
    row.setAttribute("role", "menuitem");
    row.tabIndex = index === palette.contextPickerSelectedIndex ? 0 : -1;
    row.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setEphemeralContextPickerSelectedIndex(palette, index);
      actions.rerender();
    });
    row.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      actions.applyContextPicker();
    });
    row.append(
      createElement("strong", "palette-context-handle", artifactHandle(context)),
      createElement("span", "palette-context-preview", contextPickerPreview(context)),
    );
    rail.append(row);
  }

  body.append(rail, contextPickerFooter());
  shell.append(body);

  window.setTimeout(() => {
    const selected = shell.querySelector<HTMLButtonElement>(".palette-context-entry.is-selected");
    selected?.focus();
  }, 0);
}

function contextPickerHeader() {
  const header = createElement("div", "palette-context-title");
  header.append(
    createElement("span", undefined, "clipboard stack"),
  );
  return header;
}

function contextPickerFooter() {
  return createLauncherFooter(
    [
      { keys: ["↑", "↓"], label: "to choose" },
      { keys: ["enter"], label: "to paste clip" },
      { keys: ["esc"], label: "to dismiss" },
    ],
    "palette-context-footer",
    "palette-context-hint",
  );
}

function contextPickerPreview(context: PromptDefinition) {
  return [
    context.description || context.prompt,
    context.source === "clipboard" ? "Captured from clipboard" : "",
    context.expires_at ? `Expires in ${formatCompactLifetime(context.expires_at - Date.now())}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatCompactLifetime(durationMs: number) {
  const safeDurationMs = Math.max(0, durationMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  if (safeDurationMs >= dayMs) {
    return `${Math.ceil(safeDurationMs / dayMs)}d`;
  }
  if (safeDurationMs >= hourMs) {
    return `${Math.ceil(safeDurationMs / hourMs)}h`;
  }
  return `${Math.max(1, Math.ceil(safeDurationMs / minuteMs))}m`;
}
