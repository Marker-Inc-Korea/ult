export type SkillScaffoldField =
  | "name"
  | "description"
  | "skill_md_body"
  | "destination"
  | "import_source";

export type SkillScaffoldResultSurface =
  | "skill-scaffold-panel"
  | "advanced-editor-draft"
  | "github-import-preview";

export type SkillScaffoldContract = {
  packagePathPattern: "persistent/skills/<handle>/SKILL.md";
  visibleHandlePrefix: "$";
  sourceFile: "SKILL.md";
  lifecycle: "persistent-only";
  requiredFields: readonly SkillScaffoldField[];
  optionalFields: readonly SkillScaffoldField[];
  resultSurfaces: readonly SkillScaffoldResultSurface[];
  sourceOriented: true;
  deliverablePromptArtifact: false;
  promptContextCreateCanvas: false;
  projectInstallSurface: "project-setup-or-install-preview";
  templatesAreLocalOnly: true;
  readsProjectFiles: false;
  readsTerminalOutput: false;
  readsAgentOutput: false;
  writesProjectFiles: false;
  installsExternalPackages: false;
};

export const SKILL_SCAFFOLD_CONTRACT: SkillScaffoldContract = {
  packagePathPattern: "persistent/skills/<handle>/SKILL.md",
  visibleHandlePrefix: "$",
  sourceFile: "SKILL.md",
  lifecycle: "persistent-only",
  requiredFields: [
    "name",
    "description",
    "skill_md_body",
    "destination",
  ],
  optionalFields: [
    "import_source",
  ],
  resultSurfaces: [
    "skill-scaffold-panel",
    "advanced-editor-draft",
    "github-import-preview",
  ],
  sourceOriented: true,
  deliverablePromptArtifact: false,
  promptContextCreateCanvas: false,
  projectInstallSurface: "project-setup-or-install-preview",
  templatesAreLocalOnly: true,
  readsProjectFiles: false,
  readsTerminalOutput: false,
  readsAgentOutput: false,
  writesProjectFiles: false,
  installsExternalPackages: false,
};
