import { createElement } from "../../dom";
import type {
  LauncherArtifactPanel,
  PromptPaletteRuntime,
} from "../../paletteRuntime";
import {
  artifactHandle,
  deliveryLabels,
  isDeliverableArtifact,
  isNonExpiredArtifact,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type {
  LauncherRecoveryActionId,
  PaletteRenderActions,
} from "../shared/renderTypes";
import {
  createLauncherBody,
  createLauncherFooter,
  createLauncherShell,
} from "./launcherShell";
import {
  handleBackShortcut,
} from "./artifactPanelShared";
import { formatHistoryTimestamp } from "./historyCommands";

type RecoveryPanel = Extract<LauncherArtifactPanel, { mode: "recovery" }>;

type RecoveryAction = {
  id: LauncherRecoveryActionId;
  label: string;
  detail: string;
  enabled: boolean;
};

export function renderRecoveryPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: RecoveryPanel,
) {
  const artifact = recoveryArtifact(palette, panel);
  const actionRows = recoveryActions(panel, artifact);
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-recovery",
    ariaLabel: "Delivery recovery",
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;
  shell.addEventListener("keydown", (event) => {
    if (handleBackShortcut(event, actions.closeArtifactPanel)) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      actions.selectPanelActionDelta(1, actionRows.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      actions.selectPanelActionDelta(-1, actionRows.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = actionRows[palette.launcherPanelActionIndex] ?? actionRows[0];
      if (selected?.enabled) actions.runRecoveryAction(selected.id);
    }
  });

  const body = createLauncherBody("palette-recovery-body");
  body.append(
    recoveryHeader(panel),
    recoveryMetadata(panel, artifact),
    recoveryActionList(actionRows, palette.launcherPanelActionIndex, actions),
  );
  if (panel.error) {
    body.append(recoveryNotice(panel.error, "warning"));
  }
  if (panel.message) {
    body.append(recoveryNotice(panel.message, "neutral"));
  }
  if (panel.exportPath) {
    body.append(recoveryNotice(panel.exportPath, "neutral"));
  }

  shell.append(
    body,
    createLauncherFooter([
      { keys: ["Enter"], label: "Run" },
      { keys: ["↑↓"], label: "Navigate" },
      { keys: ["Esc"], label: "Back" },
    ], "palette-artifact-footer"),
  );
  window.setTimeout(() => shell.focus(), 0);
}

function recoveryHeader(panel: RecoveryPanel) {
  const header = createElement("header", "palette-recovery-header");
  header.append(
    createElement("span", "palette-artifact-breadcrumb", "Launcher > Recovery"),
    createElement("strong", undefined, "Delivery Recovery"),
    createElement("small", undefined, recoverySubject(panel)),
  );
  return header;
}

function recoveryMetadata(
  panel: RecoveryPanel,
  artifact: PromptDefinition | null,
) {
  const list = createElement("dl", "palette-recovery-metadata");
  const target = panel.entry.target_application;
  appendMetadata(list, "Artifact", recoverySubject(panel));
  appendMetadata(list, "Local title", artifact?.title ?? "Unavailable");
  appendMetadata(
    list,
    "Mode",
    deliveryLabels[panel.entry.delivery_mode] ?? panel.entry.delivery_mode,
  );
  appendMetadata(list, "Result", panel.entry.result);
  appendMetadata(list, "Time", formatHistoryTimestamp(panel.entry.timestamp_ms));
  appendMetadata(list, "Target app", target?.name ?? "Unavailable");
  appendMetadata(list, "Bundle ID", target?.bundle_id ?? "Unavailable");
  appendMetadata(list, "Diagnostic", panel.entry.diagnostic_code ?? "none");
  return list;
}

function appendMetadata(list: HTMLElement, label: string, value: string) {
  list.append(
    createElement("dt", undefined, label),
    createElement("dd", undefined, value),
  );
}

function recoveryActionList(
  actionRows: RecoveryAction[],
  selectedIndex: number,
  actions: PaletteRenderActions,
) {
  const list = createElement("div", "palette-recovery-action-list");
  for (const [index, action] of actionRows.entries()) {
    list.append(recoveryActionButton(action, index, selectedIndex, actions));
  }
  return list;
}

function recoveryActionButton(
  action: RecoveryAction,
  index: number,
  selectedIndex: number,
  actions: PaletteRenderActions,
) {
  const selected = index === selectedIndex;
  const button = createElement(
    "button",
    [
      "palette-recovery-action-row",
      selected ? "is-selected" : "",
      action.enabled ? "" : "is-disabled",
    ].filter(Boolean).join(" "),
  ) as HTMLButtonElement;
  button.type = "button";
  button.disabled = !action.enabled;
  button.append(
    createElement("strong", undefined, action.label),
    createElement("small", undefined, action.detail),
  );
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!action.enabled) return;
    actions.runRecoveryAction(action.id);
  });
  return button;
}

function recoveryActions(
  panel: RecoveryPanel,
  artifact: PromptDefinition | null,
) {
  const canPrepare = Boolean(
    artifact && isDeliverableArtifact(artifact) && isNonExpiredArtifact(artifact),
  );
  const subject = recoverySubject(panel);
  const actions: RecoveryAction[] = [{
    id: "prepare-again",
    label: "Prepare Again",
    detail: canPrepare
      ? `Prepare ${subject} through the normal explicit delivery flow.`
      : "Local artifact is unavailable or cannot be delivered.",
    enabled: canPrepare,
  }, {
    id: "retry-copy",
    label: "Retry as Copy",
    detail: canPrepare
      ? "Prepare the artifact with Copy selected instead of native delivery."
      : "Copy retry requires an available prompt or context artifact.",
    enabled: canPrepare,
  }, {
    id: "reveal-source",
    label: "Reveal Source",
    detail: artifact
      ? `Open the local package for ${subject}.`
      : "Local source is unavailable for this failed delivery.",
    enabled: Boolean(artifact),
  }];
  if (panel.entry.diagnostic_code === "accessibility-required") {
    actions.push({
      id: "open-accessibility",
      label: "Open Accessibility Guidance",
      detail: "Open Preferences for the native delivery permission fix.",
      enabled: true,
    });
  }
  actions.push({
    id: "export-diagnostics",
    label: panel.status === "exporting" ? "Exporting Diagnostics" : "Export Diagnostics",
    detail: "Write a metadata-only diagnostics file for debugging this failure.",
    enabled: panel.status !== "exporting",
  });
  return actions;
}

function recoveryNotice(message: string, tone: "neutral" | "warning") {
  const notice = createElement("div", `palette-recovery-notice is-${tone}`);
  notice.setAttribute("role", tone === "warning" ? "alert" : "status");
  notice.append(createElement("span", undefined, message));
  return notice;
}

function recoveryArtifact(
  palette: PromptPaletteRuntime,
  panel: RecoveryPanel,
) {
  const id = panel.entry.prompt_id;
  if (!id) return null;
  return palette.prompts.find((prompt) => prompt.id === id) ?? null;
}

function recoverySubject(panel: RecoveryPanel) {
  const id = panel.entry.prompt_id;
  return id ? artifactHandle({ id } as PromptDefinition) : "scratch prompt";
}
