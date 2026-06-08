import {
  COMMAND_CREATION_CONTRACT,
  type CommandCreationActionType,
  type CommandCreationResultSurface,
} from "./commandCreationContract";

export type WorkflowBuilderModel = "prompt-command-pair";

export type WorkflowBuilderInputSource =
  | "pasted-text"
  | "manual-text"
  | "explicit-context-handles";

export type WorkflowBuilderReferenceField =
  | "prompt_id"
  | "contexts"
  | "skills";

export type WorkflowBuilderResultSurface =
  | "workflow-input-panel"
  | CommandCreationResultSurface;

export type WorkflowBuilderInputStorage = "ephemeral-context-on-continue";

export type WorkflowBuilderContract = {
  model: WorkflowBuilderModel;
  promptPackagePathPattern: "persistent/prompts/<workflow-id>/PROMPT.md";
  commandPackagePathPattern: typeof COMMAND_CREATION_CONTRACT.packagePathPattern;
  visiblePromptHandlePrefix: "#";
  visibleCommandHandlePrefix: "/";
  separateArtifactType: false;
  commandAction: CommandCreationActionType;
  resultSurfaces: readonly WorkflowBuilderResultSurface[];
  inputSources: readonly WorkflowBuilderInputSource[];
  savedInputStorage: WorkflowBuilderInputStorage;
  referenceFields: readonly WorkflowBuilderReferenceField[];
  referencePrivacy: "ids-and-handles-only";
  copiedPrivateBodiesToHistoryOrSearch: false;
  terminalReads: false;
  projectScans: false;
  implicitPromptDelivery: false;
  clipboardReads: "explicit-command-only";
  markdownBodyRole: typeof COMMAND_CREATION_CONTRACT.markdownBodyRole;
};

export const WORKFLOW_BUILDER_CONTRACT: WorkflowBuilderContract = {
  model: "prompt-command-pair",
  promptPackagePathPattern: "persistent/prompts/<workflow-id>/PROMPT.md",
  commandPackagePathPattern: COMMAND_CREATION_CONTRACT.packagePathPattern,
  visiblePromptHandlePrefix: "#",
  visibleCommandHandlePrefix: "/",
  separateArtifactType: false,
  commandAction: COMMAND_CREATION_CONTRACT.defaultAction,
  resultSurfaces: [
    "workflow-input-panel",
    COMMAND_CREATION_CONTRACT.resultSurfaceByAction.prepare,
  ],
  inputSources: [
    "pasted-text",
    "manual-text",
    "explicit-context-handles",
  ],
  savedInputStorage: "ephemeral-context-on-continue",
  referenceFields: [
    "prompt_id",
    "contexts",
    "skills",
  ],
  referencePrivacy: "ids-and-handles-only",
  copiedPrivateBodiesToHistoryOrSearch: false,
  terminalReads: false,
  projectScans: false,
  implicitPromptDelivery: false,
  clipboardReads: "explicit-command-only",
  markdownBodyRole: COMMAND_CREATION_CONTRACT.markdownBodyRole,
};
