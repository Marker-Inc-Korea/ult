import type {
  PromptArtifactType,
  PromptDefinition,
} from "../../types";

export type ArtifactCreateType = Extract<PromptArtifactType, "prompt" | "context">;

export type ArtifactCreateInitialValues = {
  title?: string | null;
  body?: string | null;
};

export type LauncherArtifactCreatePanel = {
  mode: "create";
  artifactType: ArtifactCreateType;
  initialId?: string | null;
  initialTitle?: string | null;
  initialBody?: string | null;
};

export type ArtifactCreateSavePayload = Pick<
  PromptDefinition,
  | "id"
  | "title"
  | "artifact_type"
  | "scope"
  | "pinned"
  | "description"
  | "prompt"
  | "contexts"
  | "shortcut"
  | "confirm"
  | "template_arguments"
>;

export function createLauncherArtifactCreatePanel(
  artifactType: ArtifactCreateType,
  initialId?: string | null,
  initialValues?: ArtifactCreateInitialValues,
): LauncherArtifactCreatePanel {
  return {
    mode: "create",
    artifactType,
    initialId: initialId ?? null,
    initialTitle: initialValues?.title ?? null,
    initialBody: initialValues?.body ?? null,
  };
}

export function artifactCreatePanelSignature(
  panel: LauncherArtifactCreatePanel,
) {
  return [
    panel.artifactType,
    panel.initialId ?? "",
    panel.initialTitle ?? "",
    panel.initialBody ?? "",
  ].join("\u0001");
}
