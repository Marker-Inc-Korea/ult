import type {
  ProjectArtifactWriteKind,
  ProjectArtifactWriteFile,
  ProjectArtifactWritePreview,
  ProjectArtifactWriteResult,
} from "../../types";

export type ProjectSetupWriteTarget = {
  artifactId: string;
  writeKind: ProjectArtifactWriteKind;
};

export type ProjectSetupPreviewEntry = ProjectSetupWriteTarget & {
  preview: ProjectArtifactWritePreview | null;
  error: string | null;
};

export type ProjectSetupPreview = {
  targetDirectory: string;
  entries: ProjectSetupPreviewEntry[];
  requiresOverwriteConfirmation: boolean;
  readyToWrite: boolean;
  planHash: string;
};

export type ProjectSetupResultEntry = ProjectSetupWriteTarget & {
  result: ProjectArtifactWriteResult | null;
  error: string | null;
  files: ProjectArtifactWriteFile[];
};

export type ProjectSetupResult = {
  targetDirectory: string;
  planHash: string;
  entries: ProjectSetupResultEntry[];
  writtenFiles: string[];
  failedFiles: string[];
  ok: boolean;
};
