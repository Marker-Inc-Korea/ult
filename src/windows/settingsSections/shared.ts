import { createElement } from "../../dom";
import { createNativeInlineStatus } from "../nativeShell";

export function createInlineActions() {
  return createElement("div", "settings-row-actions");
}

export function createActionButton(label: string, onClick: () => void) {
  const button = createElement("button", undefined, label);
  button.type = "button";
  button.addEventListener("click", onClick);
  return button;
}

export function createValueText(value: string) {
  return createElement("span", "settings-value-text", value);
}

export function createStatusPill(label: string, tone: "ok" | "warning") {
  const status = createNativeInlineStatus(label, tone);
  status.classList.add("status-pill");
  return status;
}
