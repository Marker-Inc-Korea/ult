import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  artifactHandle,
  isDeliverableArtifact,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import type { PromptArtifactType, PromptDefinition } from "../../types";
import type {
  LauncherArtifactActionId,
  PaletteRenderActions,
} from "../shared/renderTypes";
import {
  createLauncherBody,
  createLauncherShell,
} from "./launcherShell";
import {
  actionHint,
  handleBackShortcut,
  sourcePathLabel,
} from "./artifactPanelShared";

type ArtifactAction = {
  id: LauncherArtifactActionId;
  label: string;
  detail: string;
};

export function renderArtifactActionsPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  artifact: PromptDefinition,
) {
  const actionRows = artifactActions(artifact);
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-actions",
    ariaLabel: `${artifactHandle(artifact)} actions`,
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
      if (selected) actions.runArtifactAction(selected.id, artifact.id);
    }
  });

  const body = createLauncherBody("palette-artifact-actions-body");
  body.append(artifactActionsHeader(artifact));
  for (const [index, action] of actionRows.entries()) {
    body.append(artifactActionButton(
      action,
      index,
      palette.launcherPanelActionIndex,
      artifact.id,
      actions,
    ));
  }
  shell.append(body, artifactActionsFooter());
  window.setTimeout(() => shell.focus(), 0);
}

function artifactActionsHeader(artifact: PromptDefinition) {
  const header = createElement("header", "palette-artifact-actions-header");
  header.append(
    createElement("span", "palette-artifact-breadcrumb", sourcePathLabel(artifact)),
    createElement("strong", undefined, artifactHandle(artifact)),
    createElement("small", undefined, artifact.title),
  );
  return header;
}

function artifactActions(artifact: PromptDefinition): ArtifactAction[] {
  const rows: ArtifactAction[] = [];
  const editable = artifact.registry_editable !== false;
  const artifactType = promptArtifactType(artifact);
  if (isDeliverableArtifact(artifact)) {
    rows.push({
      id: "load",
      label: artifactType === "context" ? "Load Context" : "Load Prompt",
      detail: "Prepare this artifact for explicit delivery.",
    });
  }
  rows.push({
    id: "read",
    label: "Read",
    detail: "Open the document reader inside Launcher.",
  });
  rows.push({
    id: "copy-handle",
    label: "Copy Handle",
    detail: `Copy ${artifactHandle(artifact)} to the clipboard.`,
  });
  rows.push({
    id: "copy-body",
    label: artifactType === "skill" ? "Copy Source" : "Copy Body",
    detail: artifactType === "skill"
      ? "Copy the SKILL.md source text."
      : "Copy this artifact body text.",
  });
  if (artifactType === "prompt" && promptScope(artifact) === "persistent" && editable) {
    rows.push({
      id: "toggle-pin",
      label: artifact.pinned ? "Unpin Prompt" : "Pin Prompt",
      detail: artifact.pinned
        ? "Remove this prompt from the quick Palette."
        : "Show this prompt in the quick Palette.",
    });
  }
  if (isDeliverableArtifact(artifact)) {
    rows.push({
      id: "duplicate-scratch",
      label: "Duplicate as Scratch",
      detail: "Open this body as an editable scratch prompt.",
    });
  }
  if (editable) {
    rows.push({
      id: "edit",
      label: "Advanced Editor",
      detail: advancedEditorDetail(artifactType),
    });
  }
  rows.push({
    id: "duplicate",
    label: "Duplicate",
    detail: "Create a new local package from this artifact.",
  });
  if (editable) {
    rows.push({
      id: "delete",
      label: "Delete Artifact",
      detail: "Remove this local package from Personal Library.",
    });
  }
  if (artifactType === "prompt") {
    rows.push({
      id: "export-project",
      label: "Export Prompt to Project...",
      detail: "Preview exact project files before writing.",
    });
  } else if (artifactType === "context") {
    rows.push({
      id: "export-project",
      label: "Export Context to Project...",
      detail: "Preview exact project files before writing.",
    });
  } else {
    rows.push({
      id: "install-project",
      label: "Install Skill to Project...",
      detail: "Preview the .codex skill file before writing.",
    });
  }
  rows.push({
    id: "agents-snippet",
    label: "Create AGENTS.md Snippet...",
    detail: "Preview the AGENTS.md file before writing.",
  });
  rows.push({
    id: "reveal",
    label: "Reveal Source",
    detail: "Open the backing package file in Finder.",
  });
  return rows;
}

function advancedEditorDetail(artifactType: PromptArtifactType) {
  if (artifactType === "prompt") {
    return "Edit handle, description, arguments, contexts, and delivery defaults.";
  }
  if (artifactType === "context") {
    return "Edit handle, description, and raw context body.";
  }
  return "Edit handle, description, and SKILL.md source.";
}

function artifactActionButton(
  action: ArtifactAction,
  index: number,
  selectedIndex: number,
  artifactId: string,
  actions: PaletteRenderActions,
) {
  const selected = index === selectedIndex;
  const button = createElement(
    "button",
    `palette-artifact-action-row${selected ? " is-selected" : ""}`,
  ) as HTMLButtonElement;
  button.type = "button";
  button.append(
    createElement("strong", undefined, action.label),
    createElement("small", undefined, action.detail),
  );
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.runArtifactAction(action.id, artifactId);
  });
  return button;
}

function artifactActionsFooter() {
  const footer = createElement("div", "palette-artifact-footer");
  footer.append(
    actionHint("Run", ["Enter"]),
    actionHint("Navigate", ["↑↓"]),
    actionHint("Back", ["Esc"]),
  );
  return footer;
}
