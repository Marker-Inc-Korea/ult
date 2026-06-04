import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { artifactHandle } from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  createLauncherBody,
  createLauncherShell,
} from "./launcherShell";
import {
  actionHint,
  handleBackShortcut,
} from "./artifactPanelShared";

export function renderArtifactDeletePanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  artifact: PromptDefinition,
) {
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-delete",
    ariaLabel: `Delete ${artifactHandle(artifact)}`,
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;
  shell.addEventListener("keydown", (event) => {
    if (handleBackShortcut(event, actions.closeArtifactPanel)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      void actions.deleteArtifact(artifact.id);
    }
  });
  const body = createLauncherBody("palette-artifact-delete-body");
  body.append(
    createElement("strong", undefined, `Delete ${artifactHandle(artifact)}?`),
    createElement(
      "p",
      undefined,
      "This removes the local package directory from Personal Library.",
    ),
  );
  const footer = createElement("div", "palette-artifact-footer");
  const cancel = createElement("button", "palette-artifact-secondary-action", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    actions.closeArtifactPanel();
  });
  const remove = createElement("button", "palette-artifact-danger-action", "Delete");
  remove.type = "button";
  remove.addEventListener("click", (event) => {
    event.preventDefault();
    void actions.deleteArtifact(artifact.id);
  });
  footer.append(actionHint("Delete", ["Enter"]), cancel, remove);
  shell.append(body, footer);
  window.setTimeout(() => shell.focus(), 0);
}
