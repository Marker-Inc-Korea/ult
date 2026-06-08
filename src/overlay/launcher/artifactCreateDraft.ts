import { syncPromptTemplateArguments } from "../../promptArguments";
import type {
  PromptDefinition,
  PromptScope,
} from "../../types";
import {
  slugifyArtifactId,
  titleFromHandle,
  uniqueArtifactId,
} from "./artifactComposerDraft";
import { validateComposerDraft } from "./artifactComposerValidation";
import type {
  ArtifactCreateSavePayload,
  ArtifactCreateType,
} from "./artifactCreateState";

export type ArtifactCreateDestination = "personal-library";
export type ArtifactCreateProjectSelection = "none";

export type ArtifactCreateDraft = {
  artifactType: ArtifactCreateType;
  title: string;
  body: string;
  description: string;
  destination: ArtifactCreateDestination;
  projectSelection: ArtifactCreateProjectSelection;
  scope: Extract<PromptScope, "persistent">;
  showInPalette: boolean;
  confirmBeforeDelivery: boolean;
  advancedOverrides: {
    handle: string | null;
    handleTouched: boolean;
  };
};

export function initialCreateDraft(
  prompts: PromptDefinition[],
  options: {
    artifactType: ArtifactCreateType;
    initialId?: string | null;
    initialTitle?: string | null;
    initialBody?: string | null;
  },
): ArtifactCreateDraft {
  const initialHandle = slugifyArtifactId(options.initialId ?? "");
  const handle = initialHandle
    ? uniqueArtifactId(initialHandle, prompts, null)
    : null;
  const title = options.initialTitle?.trim()
    || (handle ? titleFromHandle(handle) : "");
  return {
    artifactType: options.artifactType,
    title,
    body: options.initialBody ?? "",
    description: "",
    destination: "personal-library",
    projectSelection: "none",
    scope: "persistent",
    showInPalette: false,
    confirmBeforeDelivery: false,
    advancedOverrides: {
      handle,
      handleTouched: Boolean(handle),
    },
  };
}

export function createDraftHandle(
  draft: ArtifactCreateDraft,
  prompts: PromptDefinition[],
) {
  const override = draft.advancedOverrides.handleTouched
    ? slugifyArtifactId(draft.advancedOverrides.handle ?? "")
    : "";
  const base = override
    || slugifyArtifactId(draft.title)
    || slugifyArtifactId(firstSentence(draft.body))
    || fallbackArtifactId(draft.artifactType);
  return uniqueArtifactId(base, prompts, null);
}

export function createDraftTitle(
  draft: ArtifactCreateDraft,
  prompts: PromptDefinition[],
) {
  const title = draft.title.trim();
  return title || titleFromHandle(createDraftHandle(draft, prompts));
}

export function createDraftToSavePayload(
  draft: ArtifactCreateDraft,
  prompts: PromptDefinition[],
): ArtifactCreateSavePayload {
  const id = createDraftHandle(draft, prompts);
  const body = draft.body.trim();
  return {
    id,
    title: createDraftTitle(draft, prompts),
    artifact_type: draft.artifactType,
    scope: draft.scope,
    pinned: draft.artifactType === "prompt" ? draft.showInPalette : false,
    description: draft.description.trim(),
    prompt: body,
    contexts: [],
    shortcut: null,
    confirm: draft.artifactType === "prompt" ? draft.confirmBeforeDelivery : false,
    template_arguments: draft.artifactType === "prompt"
      ? syncPromptTemplateArguments(body, [])
      : [],
  };
}

export function validateCreateDraft(
  palette: { prompts: PromptDefinition[] },
  draft: ArtifactCreateDraft,
) {
  const errors = validateComposerDraft(
    palette,
    null,
    draft.artifactType,
    createDraftHandle(draft, palette.prompts),
    createDraftTitle(draft, palette.prompts),
    draft.body,
  );
  if (errors.prompt === "Body is required.") {
    errors.prompt = draft.artifactType === "context"
      ? "Context text is required."
      : "Prompt text is required.";
  }
  return errors;
}

function firstSentence(value: string) {
  return value.trim().split(/[.!?\n]/, 1)[0] ?? "";
}

function fallbackArtifactId(artifactType: ArtifactCreateType) {
  return artifactType === "context" ? "new-context" : "new-prompt";
}
