import { promptArtifactType } from "../../promptUtils";
import type {
  ProjectArtifactWriteKind,
  PromptDefinition,
} from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import type { LibraryRow } from "./libraryRows";

export function runLibraryRowPrimary(
  row: LibraryRow,
  actions: PaletteRenderActions,
) {
  if (row.kind === "issue") {
    if (row.actionCommand) actions.runLauncherCommand(row.actionCommand);
    return;
  }
  if (row.kind === "command") {
    actions.runLauncherCommand(row.command);
    return;
  }
  if (promptArtifactType(row.prompt) === "skill") {
    actions.openArtifactReader(row.prompt.id);
    return;
  }
  actions.runArtifactAction("load", row.prompt.id);
}

export function openLibraryRowReader(
  row: LibraryRow | null | undefined,
  actions: PaletteRenderActions,
) {
  if (row?.kind !== "artifact") return false;
  actions.openArtifactReader(row.prompt.id);
  return true;
}

export function copyLibraryRowHandle(
  row: LibraryRow | null | undefined,
  actions: PaletteRenderActions,
) {
  if (row?.kind === "artifact") {
    actions.runArtifactAction("copy-handle", row.prompt.id);
    return true;
  }
  if (row?.kind === "command") {
    actions.copyLauncherCommandHandle(row.command);
    return true;
  }
  return false;
}

export function openLibraryRowProjectWrite(
  row: LibraryRow | null | undefined,
  actions: PaletteRenderActions,
) {
  if (row?.kind !== "artifact") return false;
  actions.openProjectArtifactWrite(libraryProjectWriteKind(row.prompt), row.prompt.id);
  return true;
}

export function openLibraryRowActions(
  row: LibraryRow | null | undefined,
  actions: PaletteRenderActions,
) {
  if (row?.kind !== "artifact") return false;
  actions.openArtifactActions(row.prompt.id);
  return true;
}

export function libraryProjectWriteActionLabel(prompt: PromptDefinition) {
  return promptArtifactType(prompt) === "skill"
    ? "Install Skill to Project"
    : "Export to Project";
}

function libraryProjectWriteKind(
  prompt: PromptDefinition,
): Extract<ProjectArtifactWriteKind, "prompt" | "context" | "skill"> {
  const type = promptArtifactType(prompt);
  if (type === "context") return "context";
  if (type === "skill") return "skill";
  return "prompt";
}
