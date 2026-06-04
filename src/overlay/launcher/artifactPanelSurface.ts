import type { PromptPaletteRuntime } from "../../paletteRuntime";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import { renderArtifactActionsPanel } from "./artifactActionsPanelSurface";
import { renderArtifactComposerPanel } from "./artifactComposerPanelSurface";
import { renderArtifactDeletePanel } from "./artifactDeletePanelSurface";
import { renderArtifactReaderPanel } from "./artifactReaderPanelSurface";
import { renderGitHubImportPanel } from "./githubImportPanelSurface";
import { renderProjectSetupPanel } from "./projectSetupPanelSurface";
import { renderProjectWritePanel } from "./projectWritePanelSurface";
import { renderRecoveryPanel } from "./recoveryPanelSurface";
import { renderSkillDiscoveryPanel } from "./skillDiscoveryPanelSurface";
import { renderStarterPacksPanel } from "./starterPacksPanelSurface";
import { renderWorkflowInputPanel } from "./workflowInputPanelSurface";

export function renderArtifactPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const panel = palette.launcherArtifactPanel;
  if (panel?.mode === "github-import") {
    renderGitHubImportPanel(palette, actions, panel);
    return;
  }
  if (panel?.mode === "starter-packs") {
    renderStarterPacksPanel(palette, actions, panel);
    return;
  }
  if (panel?.mode === "skill-discovery") {
    renderSkillDiscoveryPanel(palette, actions, panel);
    return;
  }
  if (panel?.mode === "project-write") {
    renderProjectWritePanel(palette, actions, panel);
    return;
  }
  if (panel?.mode === "project-setup") {
    renderProjectSetupPanel(palette, actions, panel);
    return;
  }
  if (panel?.mode === "workflow-input") {
    renderWorkflowInputPanel(palette, actions, panel);
    return;
  }
  if (panel?.mode === "recovery") {
    renderRecoveryPanel(palette, actions, panel);
    return;
  }
  if (panel?.mode === "composer") {
    renderArtifactComposerPanel(palette, actions, panel);
    return;
  }

  const artifact = launcherPanelArtifact(palette);
  if (!artifact) {
    actions.closeArtifactPanel();
    return;
  }
  if (panel?.mode === "actions") {
    renderArtifactActionsPanel(palette, actions, artifact);
    return;
  }
  if (panel?.mode === "delete") {
    renderArtifactDeletePanel(palette, actions, artifact);
    return;
  }
  renderArtifactReaderPanel(palette, actions, artifact);
}

function launcherPanelArtifact(palette: PromptPaletteRuntime) {
  const panel = palette.launcherArtifactPanel;
  const artifactId = panel && "artifactId" in panel ? panel.artifactId : null;
  if (!artifactId) return null;
  return palette.prompts.find((prompt): prompt is PromptDefinition =>
    prompt.id === artifactId
  ) ?? null;
}
