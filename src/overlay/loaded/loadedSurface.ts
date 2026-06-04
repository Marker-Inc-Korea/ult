import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { deliveryLabels } from "../../promptUtils";
import type { PaletteRenderActions } from "../shared/renderTypes";

export function renderLoadedIntervention(
  palette: PromptPaletteRuntime,
  _actions: PaletteRenderActions,
) {
  const prepared = palette.preparedExecution;
  if (!prepared) return;
  const form = createElement(
    "form",
    `palette-loaded is-delivery-${prepared.deliveryMode}`,
  ) as HTMLFormElement;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });
  form.title = `${loadedTargetInstruction(prepared.deliveryMode)}. Shift+Tab changes delivery mode. Esc closes.`;
  const primaryLabel = loadedPrimaryLabel(prepared);
  form.setAttribute(
    "aria-label",
    `Loaded ${primaryLabel}. ${loadedDeliveryDescription(prepared.deliveryMode)}. ${loadedTargetInstruction(prepared.deliveryMode)}.`,
  );

  form.append(
    loadedIdentity(prepared),
    loadedStatus(prepared),
  );
  palette.container.append(form);
}

function loadedIdentity(
  prepared: NonNullable<PromptPaletteRuntime["preparedExecution"]>,
) {
  const identity = createElement("span", "palette-loaded-identity");
  identity.append(createElement("strong", "palette-loaded-label", loadedPrimaryLabel(prepared)));
  return identity;
}

function loadedStatus(
  prepared: NonNullable<PromptPaletteRuntime["preparedExecution"]>,
) {
  const status = createElement("span", "palette-loaded-status");
  status.append(
    targetClickState(prepared.deliveryMode),
    currentDeliveryMode(prepared.deliveryMode),
  );
  return status;
}

function targetClickState(
  mode: NonNullable<PromptPaletteRuntime["preparedExecution"]>["deliveryMode"],
) {
  const state = createElement("span", "palette-loaded-target-state");
  state.append(
    createElement("span", undefined, targetClickLabel(mode)),
  );
  return state;
}

function currentDeliveryMode(
  mode: NonNullable<PromptPaletteRuntime["preparedExecution"]>["deliveryMode"],
) {
  const modeElement = createElement("span", "palette-loaded-mode");
  modeElement.title = loadedDeliveryDescription(mode);
  modeElement.append(createElement("span", "palette-loaded-mode-label", loadedDeliveryLabel(mode)));
  return modeElement;
}

function loadedDeliveryLabel(
  mode: NonNullable<PromptPaletteRuntime["preparedExecution"]>["deliveryMode"],
) {
  return deliveryLabels[mode];
}

function loadedDeliveryDescription(
  mode: NonNullable<PromptPaletteRuntime["preparedExecution"]>["deliveryMode"],
) {
  if (mode === "send") return "Paste and enter";
  if (mode === "interrupt-send") return "Interrupt, paste, and enter";
  if (mode === "copy") return "Copy";
  return "Paste";
}

function targetClickLabel(
  mode: NonNullable<PromptPaletteRuntime["preparedExecution"]>["deliveryMode"],
) {
  return mode === "copy" ? "Click to copy" : "Click target app";
}

function loadedTargetInstruction(
  mode: NonNullable<PromptPaletteRuntime["preparedExecution"]>["deliveryMode"],
) {
  return mode === "copy" ? "Click to copy" : "Click the target app to apply";
}

function loadedHandle(
  prepared: NonNullable<PromptPaletteRuntime["preparedExecution"]>,
) {
  return prepared.artifactHandle ?? prepared.label;
}

function loadedPrimaryLabel(
  prepared: NonNullable<PromptPaletteRuntime["preparedExecution"]>,
) {
  return loadedHandle(prepared);
}
