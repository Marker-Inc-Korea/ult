import { native } from "../../native";
import {
  positionPromptPalette,
  setPromptPaletteArtifactPanel,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import { promptArtifactType } from "../../promptUtils";
import type {
  ProjectArtifactWriteKind,
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import type { ProjectSetupWriteTarget } from "./projectSetupTypes";
import {
  normalizeProjectSetupPresetId,
  projectSetupCandidates,
  projectSetupPresetSelection,
} from "./projectSetupPresets";
import {
  reportLauncherArtifactUnavailable,
  selectedLauncherArtifact,
} from "./artifactSelection";
import {
  nativeProjectSetupTargets,
  projectSetupPreviewFromNative,
  projectSetupResultFromNative,
} from "./projectWriteNativeConversion";
import {
  guardProjectArtifactWrite,
  guardProjectSetupWrite,
  openProjectSetupPanel,
  openProjectWritePanel,
  projectSetupFormPanel,
  projectSetupPreviewingPanel,
  projectSetupPreviewPanel,
  projectSetupPreviewErrorPanel,
  projectSetupResultPanel,
  projectSetupWritingPanel,
  projectWriteFormPanel,
  projectWritePreviewingPanel,
  projectWritePreviewPanel,
  projectWritePreviewErrorPanel,
  projectWriteResultPanel,
  projectWriteWritingPanel,
  type ProjectSetupDraft,
  type ProjectWriteDraft,
} from "./projectWriteTransitions";

export function createProjectWriteController(options: {
  palette: PromptPaletteRuntime;
  rerender: () => void;
}) {
  const { palette, rerender } = options;
  let projectArtifactRequestGeneration = 0;
  let projectSetupRequestGeneration = 0;

  const openProjectArtifactWrite = (
    writeKind: ProjectArtifactWriteKind,
    artifactId?: string | null,
  ) => {
    projectArtifactRequestGeneration += 1;
    const artifact = selectedLauncherArtifact(palette, artifactId);
    if (!artifact) {
      reportLauncherArtifactUnavailable(palette, rerender);
      return;
    }
    if (!setPromptPaletteArtifactPanel(
      palette,
      openProjectWritePanel(artifact.id, writeKind),
    )) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const openProjectSetup = () => {
    projectSetupRequestGeneration += 1;
    const selection = projectSetupPresetSelection(projectSetupCandidates(palette.prompts), null);
    if (!setPromptPaletteArtifactPanel(
      palette,
      openProjectSetupPanel({
        presetId: selection.presetId,
        targetDirectory: "",
        selectedArtifactIds: selection.selectedArtifactIds,
        includeAgentsSnippet: selection.includeAgentsSnippet,
        agentsSnippetArtifactId: selection.agentsSnippetArtifactId,
        overwrite: false,
      }),
    )) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const previewProjectArtifactWrite = async (
    artifactId: string,
    writeKind: ProjectArtifactWriteKind,
    targetDirectory: string,
    overwrite: boolean,
  ) => {
    const trimmedTarget = targetDirectory.trim();
    const draft: ProjectWriteDraft = {
      artifactId,
      writeKind,
      targetDirectory: trimmedTarget,
      overwrite,
    };
    if (!trimmedTarget) {
      setPromptPaletteArtifactPanel(
        palette,
        projectWriteFormPanel(draft, "Enter a target project directory."),
      );
      rerender();
      return;
    }
    const requestGeneration = ++projectArtifactRequestGeneration;
    setPromptPaletteArtifactPanel(
      palette,
      projectWritePreviewingPanel(draft),
    );
    rerender();
    try {
      const preview = await native.previewProjectArtifactWrite(
        artifactId,
        writeKind,
        trimmedTarget,
        overwrite,
      );
      if (requestGeneration !== projectArtifactRequestGeneration) return;
      setPromptPaletteArtifactPanel(
        palette,
        projectWritePreviewPanel(draft, preview),
      );
      rerender();
    } catch (error) {
      if (requestGeneration !== projectArtifactRequestGeneration) return;
      setPromptPaletteArtifactPanel(
        palette,
        projectWriteFormPanel(
          draft,
          projectWriteErrorMessage(error, "Project write could not be previewed."),
        ),
      );
      rerender();
    }
  };

  const previewProjectSetup = async (
    targetDirectory: string,
    selectedArtifactIds: string[],
    includeAgentsSnippet: boolean,
    agentsSnippetArtifactId: string | null,
    overwrite: boolean,
    presetId?: string,
  ) => {
    const trimmedTarget = targetDirectory.trim();
    const normalizedPresetId = normalizeProjectSetupPresetId(
      presetId ?? currentProjectSetupPresetId(palette),
    );
    const selection = projectSetupTargets(
      palette.prompts,
      selectedArtifactIds,
      includeAgentsSnippet,
      agentsSnippetArtifactId,
    );
    const draft: ProjectSetupDraft = {
      presetId: normalizedPresetId,
      targetDirectory: trimmedTarget,
      selectedArtifactIds,
      includeAgentsSnippet,
      agentsSnippetArtifactId,
      overwrite,
    };
    if (!trimmedTarget) {
      setPromptPaletteArtifactPanel(
        palette,
        projectSetupFormPanel(draft, "Enter a target project directory."),
      );
      rerender();
      return;
    }
    if (selection.length === 0) {
      setPromptPaletteArtifactPanel(
        palette,
        projectSetupFormPanel(draft, "Select at least one project setup item."),
      );
      rerender();
      return;
    }

    const requestGeneration = ++projectSetupRequestGeneration;
    setPromptPaletteArtifactPanel(
      palette,
      projectSetupPreviewingPanel(draft),
    );
    rerender();

    try {
      const preview = await native.previewProjectSetup(
        nativeProjectSetupTargets(selection),
        trimmedTarget,
        overwrite,
      );
      if (requestGeneration !== projectSetupRequestGeneration) return;
      setPromptPaletteArtifactPanel(
        palette,
        projectSetupPreviewPanel(
          draft,
          projectSetupPreviewFromNative(preview),
        ),
      );
      rerender();
    } catch (error) {
      if (requestGeneration !== projectSetupRequestGeneration) return;
      setPromptPaletteArtifactPanel(
        palette,
        projectSetupFormPanel(
          draft,
          projectWriteErrorMessage(error, "Project setup could not be previewed."),
        ),
      );
      rerender();
    }
  };

  const writeProjectArtifact = async (
    artifactId: string,
    writeKind: ProjectArtifactWriteKind,
    targetDirectory: string,
    overwrite: boolean,
  ) => {
    const current = palette.launcherArtifactPanel?.mode === "project-write"
      ? palette.launcherArtifactPanel
      : null;
    const trimmedTarget = targetDirectory.trim();
    const draft: ProjectWriteDraft = {
      artifactId,
      writeKind,
      targetDirectory: trimmedTarget,
      overwrite,
    };
    const guard = guardProjectArtifactWrite(current, draft);
    if (!guard.ok) {
      setPromptPaletteArtifactPanel(palette, guard.panel);
      rerender();
      return;
    }
    const requestGeneration = ++projectArtifactRequestGeneration;
    setPromptPaletteArtifactPanel(
      palette,
      projectWriteWritingPanel(guard.panel, overwrite),
    );
    rerender();
    try {
      const result = await native.writeProjectArtifact(
        artifactId,
        writeKind,
        guard.targetDirectory,
        overwrite,
      );
      if (requestGeneration !== projectArtifactRequestGeneration) return;
      setPromptPaletteArtifactPanel(
        palette,
        projectWriteResultPanel(guard.panel, overwrite, result),
      );
      rerender();
    } catch (error) {
      if (requestGeneration !== projectArtifactRequestGeneration) return;
      setPromptPaletteArtifactPanel(
          palette,
        projectWritePreviewErrorPanel(
          guard.panel,
          overwrite,
          projectWriteErrorMessage(error, "Project files could not be written."),
        ),
      );
      rerender();
    }
  };

  const writeProjectSetup = async (
    targetDirectory: string,
    selectedArtifactIds: string[],
    includeAgentsSnippet: boolean,
    agentsSnippetArtifactId: string | null,
    overwrite: boolean,
  ) => {
    const current = palette.launcherArtifactPanel?.mode === "project-setup"
      ? palette.launcherArtifactPanel
      : null;
    const trimmedTarget = targetDirectory.trim();
    const draft: ProjectSetupDraft = {
      presetId: currentProjectSetupPresetId(palette),
      targetDirectory: trimmedTarget,
      selectedArtifactIds,
      includeAgentsSnippet,
      agentsSnippetArtifactId,
      overwrite,
    };
    const guard = guardProjectSetupWrite(current, draft);
    if (!guard.ok) {
      setPromptPaletteArtifactPanel(palette, guard.panel);
      rerender();
      return;
    }
    const selection: ProjectSetupWriteTarget[] = guard.preview.entries.map((entry) => ({
      artifactId: entry.artifactId,
      writeKind: entry.writeKind,
    }));

    const requestGeneration = ++projectSetupRequestGeneration;
    setPromptPaletteArtifactPanel(
      palette,
      projectSetupWritingPanel(guard.panel, overwrite),
    );
    rerender();

    try {
      const result = await native.writeProjectSetup(
        nativeProjectSetupTargets(selection),
        guard.targetDirectory,
        overwrite,
        guard.preview.planHash,
      );
      if (requestGeneration !== projectSetupRequestGeneration) return;
      setPromptPaletteArtifactPanel(
          palette,
        projectSetupResultPanel(
          guard.panel,
          overwrite,
          projectSetupResultFromNative(result),
        ),
      );
      rerender();
    } catch (error) {
      if (requestGeneration !== projectSetupRequestGeneration) return;
      setPromptPaletteArtifactPanel(
        palette,
        projectSetupPreviewErrorPanel(
          guard.panel,
          overwrite,
          projectWriteErrorMessage(error, "Project files could not be written."),
        ),
      );
      rerender();
    }
  };

  return {
    openProjectArtifactWrite,
    openProjectSetup,
    previewProjectArtifactWrite,
    writeProjectArtifact,
    previewProjectSetup,
    writeProjectSetup,
  };
}

function projectSetupTargets(
  prompts: PromptDefinition[],
  selectedArtifactIds: string[],
  includeAgentsSnippet: boolean,
  agentsSnippetArtifactId: string | null,
): ProjectSetupWriteTarget[] {
  const candidates = new Map(projectSetupCandidates(prompts).map((artifact) => [
    artifact.id,
    artifact,
  ]));
  const targets: ProjectSetupWriteTarget[] = [];
  const seen = new Set<string>();
  for (const artifactId of selectedArtifactIds) {
    const artifact = candidates.get(artifactId);
    if (!artifact || seen.has(artifactId)) continue;
    seen.add(artifactId);
    targets.push({
      artifactId,
      writeKind: projectWriteKindForArtifactType(promptArtifactType(artifact)),
    });
  }
  if (includeAgentsSnippet && agentsSnippetArtifactId) {
    const artifact = candidates.get(agentsSnippetArtifactId);
    if (artifact) {
      targets.push({
        artifactId: artifact.id,
        writeKind: "agents-snippet",
      });
    }
  }
  return targets;
}

function currentProjectSetupPresetId(palette: PromptPaletteRuntime) {
  return normalizeProjectSetupPresetId(
    palette.launcherArtifactPanel?.mode === "project-setup"
      ? palette.launcherArtifactPanel.presetId
      : null,
  );
}

function projectWriteKindForArtifactType(
  artifactType: PromptArtifactType,
): Extract<ProjectArtifactWriteKind, "prompt" | "context" | "skill"> {
  if (artifactType === "context") return "context";
  if (artifactType === "skill") return "skill";
  return "prompt";
}

function projectWriteErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}
