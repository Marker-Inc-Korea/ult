export type CommandCreationActionType = "prepare";

export type CommandCreationResultSurface = "loaded-state";

export type CommandCreationField =
  | "id"
  | "title"
  | "description"
  | "prompt_id"
  | "contexts"
  | "variable_values"
  | "keywords"
  | "aliases"
  | "actions"
  | "home"
  | "source_path";

export type CommandCreationContract = {
  packagePathPattern: "persistent/commands/<handle>/COMMAND.md";
  visibleHandlePrefix: "/";
  requiredFields: readonly CommandCreationField[];
  optionalFields: readonly CommandCreationField[];
  actionTypes: readonly CommandCreationActionType[];
  defaultAction: CommandCreationActionType;
  resultSurfaceByAction: Readonly<Record<CommandCreationActionType, CommandCreationResultSurface>>;
  markdownBodyRole: "local-notes-only";
  indexedMetadataFields: readonly CommandCreationField[];
  bodyIndexed: false;
  promptDeliveryArtifact: false;
};

export const COMMAND_CREATION_CONTRACT: CommandCreationContract = {
  packagePathPattern: "persistent/commands/<handle>/COMMAND.md",
  visibleHandlePrefix: "/",
  requiredFields: [
    "id",
    "title",
    "prompt_id",
  ],
  optionalFields: [
    "description",
    "contexts",
    "variable_values",
    "keywords",
    "aliases",
    "actions",
    "home",
    "source_path",
  ],
  actionTypes: ["prepare"],
  defaultAction: "prepare",
  resultSurfaceByAction: {
    prepare: "loaded-state",
  },
  markdownBodyRole: "local-notes-only",
  indexedMetadataFields: [
    "id",
    "title",
    "description",
    "prompt_id",
    "contexts",
    "keywords",
    "aliases",
    "source_path",
  ],
  bodyIndexed: false,
  promptDeliveryArtifact: false,
};
