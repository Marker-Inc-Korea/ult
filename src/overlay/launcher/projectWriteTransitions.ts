import type {
  LauncherProjectSetupPanel,
  LauncherProjectWritePanel,
} from "../../paletteRuntimeState";
import type {
  ProjectArtifactWriteKind,
  ProjectArtifactWritePreview,
  ProjectArtifactWriteResult,
} from "../../types";
import type {
  ProjectSetupPreview,
  ProjectSetupResult,
} from "./projectSetupTypes";

export type ProjectWriteDraft = {
  artifactId: string;
  writeKind: ProjectArtifactWriteKind;
  targetDirectory: string;
  overwrite: boolean;
};

export type ProjectSetupDraft = {
  presetId?: string;
  targetDirectory: string;
  selectedArtifactIds: string[];
  includeAgentsSnippet: boolean;
  agentsSnippetArtifactId: string | null;
  overwrite: boolean;
};

export type ProjectWriteGuard =
  | {
    ok: true;
    panel: LauncherProjectWritePanel;
    targetDirectory: string;
    preview: ProjectArtifactWritePreview;
  }
  | { ok: false; panel: LauncherProjectWritePanel };

export type ProjectSetupGuard =
  | {
    ok: true;
    panel: LauncherProjectSetupPanel;
    targetDirectory: string;
    preview: ProjectSetupPreview;
  }
  | { ok: false; panel: LauncherProjectSetupPanel };

export function openProjectWritePanel(
  artifactId: string,
  writeKind: ProjectArtifactWriteKind,
): LauncherProjectWritePanel {
  return projectWriteFormPanel({
    artifactId,
    writeKind,
    targetDirectory: "",
    overwrite: false,
  });
}

export function projectWriteFormPanel(
  draft: ProjectWriteDraft,
  error: string | null = null,
): LauncherProjectWritePanel {
  return {
    mode: "project-write",
    status: "form",
    artifactId: draft.artifactId,
    writeKind: draft.writeKind,
    targetDirectory: draft.targetDirectory,
    overwrite: draft.overwrite,
    preview: null,
    error,
    result: null,
  };
}

export function projectWritePreviewingPanel(
  draft: ProjectWriteDraft,
): LauncherProjectWritePanel {
  return {
    ...projectWriteFormPanel(draft),
    status: "previewing",
  };
}

export function projectWritePreviewPanel(
  draft: ProjectWriteDraft,
  preview: ProjectArtifactWritePreview,
  error: string | null = null,
): LauncherProjectWritePanel {
  return {
    mode: "project-write",
    status: "preview",
    artifactId: draft.artifactId,
    writeKind: draft.writeKind,
    targetDirectory: preview.target_directory,
    overwrite: draft.overwrite,
    preview,
    error,
    result: null,
  };
}

export function projectWriteWritingPanel(
  panel: LauncherProjectWritePanel,
  overwrite: boolean,
): LauncherProjectWritePanel {
  return {
    ...panel,
    status: "writing",
    targetDirectory: panel.preview?.target_directory ?? panel.targetDirectory,
    overwrite,
    error: null,
    result: null,
  };
}

export function projectWriteResultPanel(
  panel: LauncherProjectWritePanel,
  overwrite: boolean,
  result: ProjectArtifactWriteResult,
): LauncherProjectWritePanel {
  return {
    ...panel,
    status: "result",
    targetDirectory: result.target_directory,
    overwrite,
    error: null,
    result,
  };
}

export function projectWritePreviewErrorPanel(
  panel: LauncherProjectWritePanel,
  overwrite: boolean,
  error: string,
): LauncherProjectWritePanel {
  return {
    ...panel,
    status: "preview",
    targetDirectory: panel.preview?.target_directory ?? panel.targetDirectory,
    overwrite,
    error,
    result: null,
  };
}

export function guardProjectArtifactWrite(
  current: LauncherProjectWritePanel | null,
  draft: ProjectWriteDraft,
): ProjectWriteGuard {
  if (
    !current
    || current.artifactId !== draft.artifactId
    || current.writeKind !== draft.writeKind
    || !current.preview
  ) {
    return {
      ok: false,
      panel: projectWriteFormPanel(draft, "Preview project files before writing."),
    };
  }
  if (current.preview.requires_overwrite_confirmation && !draft.overwrite) {
      return {
        ok: false,
        panel: projectWritePreviewErrorPanel(
          current,
          draft.overwrite,
          "Confirm overwrite before writing existing project files.",
        ),
      };
  }
  return {
    ok: true,
    panel: current,
    targetDirectory: current.preview.target_directory,
    preview: current.preview,
  };
}

export function openProjectSetupPanel(
  draft: ProjectSetupDraft,
): LauncherProjectSetupPanel {
  return projectSetupFormPanel(draft);
}

export function projectSetupFormPanel(
  draft: ProjectSetupDraft,
  error: string | null = null,
): LauncherProjectSetupPanel {
  return {
    mode: "project-setup",
    status: "form",
    presetId: draft.presetId,
    targetDirectory: draft.targetDirectory,
    selectedArtifactIds: [...draft.selectedArtifactIds],
    includeAgentsSnippet: draft.includeAgentsSnippet,
    agentsSnippetArtifactId: draft.agentsSnippetArtifactId,
    overwrite: draft.overwrite,
    preview: null,
    error,
    result: null,
  };
}

export function projectSetupPreviewingPanel(
  draft: ProjectSetupDraft,
): LauncherProjectSetupPanel {
  return {
    ...projectSetupFormPanel(draft),
    status: "previewing",
  };
}

export function projectSetupPreviewPanel(
  draft: ProjectSetupDraft,
  preview: ProjectSetupPreview,
  error: string | null = null,
): LauncherProjectSetupPanel {
  return {
    mode: "project-setup",
    status: "preview",
    presetId: draft.presetId,
    targetDirectory: preview.targetDirectory,
    selectedArtifactIds: [...draft.selectedArtifactIds],
    includeAgentsSnippet: draft.includeAgentsSnippet,
    agentsSnippetArtifactId: draft.agentsSnippetArtifactId,
    overwrite: draft.overwrite,
    preview,
    error,
    result: null,
  };
}

export function projectSetupWritingPanel(
  panel: LauncherProjectSetupPanel,
  overwrite: boolean,
): LauncherProjectSetupPanel {
  return {
    ...panel,
    status: "writing",
    targetDirectory: panel.preview?.targetDirectory ?? panel.targetDirectory,
    overwrite,
    error: null,
    result: null,
  };
}

export function projectSetupResultPanel(
  panel: LauncherProjectSetupPanel,
  overwrite: boolean,
  result: ProjectSetupResult,
): LauncherProjectSetupPanel {
  return {
    ...panel,
    status: "result",
    targetDirectory: result.targetDirectory,
    overwrite,
    error: result.ok ? null : "Some project files could not be written.",
    result,
  };
}

export function projectSetupPreviewErrorPanel(
  panel: LauncherProjectSetupPanel,
  overwrite: boolean,
  error: string,
): LauncherProjectSetupPanel {
  return {
    ...panel,
    status: "preview",
    targetDirectory: panel.preview?.targetDirectory ?? panel.targetDirectory,
    overwrite,
    error,
    result: null,
  };
}

export function guardProjectSetupWrite(
  current: LauncherProjectSetupPanel | null,
  draft: ProjectSetupDraft,
): ProjectSetupGuard {
  if (!current?.preview) {
    return {
      ok: false,
      panel: projectSetupFormPanel(
        draft,
        "Preview project files before writing.",
      ),
    };
  }
  if (current.preview.entries.some((entry) => entry.error)) {
    return {
      ok: false,
      panel: projectSetupPreviewErrorPanel(
        current,
        draft.overwrite,
        "Resolve preview errors before writing project files.",
      ),
    };
  }
  if (!draft.overwrite && current.preview.requiresOverwriteConfirmation) {
    return {
      ok: false,
      panel: projectSetupPreviewErrorPanel(
        current,
        draft.overwrite,
        "Confirm overwrite before writing existing project files.",
      ),
    };
  }
  return {
    ok: true,
    panel: current,
    targetDirectory: current.preview.targetDirectory,
    preview: current.preview,
  };
}
