import type {
  ProjectSetupPreview as NativeProjectSetupPreview,
  ProjectSetupResult as NativeProjectSetupResult,
  ProjectSetupWriteTarget as NativeProjectSetupWriteTarget,
} from "../../types";
import type {
  ProjectSetupPreview,
  ProjectSetupResult,
  ProjectSetupWriteTarget,
} from "./projectSetupTypes";

export function nativeProjectSetupTargets(
  targets: ProjectSetupWriteTarget[],
): NativeProjectSetupWriteTarget[] {
  return targets.map((target) => ({
    artifact_id: target.artifactId,
    write_kind: target.writeKind,
  }));
}

export function projectSetupPreviewFromNative(
  preview: NativeProjectSetupPreview,
): ProjectSetupPreview {
  return {
    targetDirectory: preview.target_directory,
    entries: preview.entries.map((entry) => ({
      artifactId: entry.artifact_id,
      writeKind: entry.write_kind,
      preview: entry.preview,
      error: entry.error,
    })),
    requiresOverwriteConfirmation: preview.requires_overwrite_confirmation,
    readyToWrite: preview.ready_to_write,
    planHash: preview.plan_hash,
  };
}

export function projectSetupResultFromNative(
  result: NativeProjectSetupResult,
): ProjectSetupResult {
  return {
    targetDirectory: result.target_directory,
    planHash: result.plan_hash,
    entries: result.entries.map((entry) => ({
      artifactId: entry.artifact_id,
      writeKind: entry.write_kind,
      result: entry.result,
      error: entry.error,
      files: entry.files,
    })),
    writtenFiles: result.written_files,
    failedFiles: result.failed_files,
    ok: result.ok,
  };
}
