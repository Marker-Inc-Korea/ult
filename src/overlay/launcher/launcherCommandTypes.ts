import type { PromptArtifactType, UserLauncherCommandDefinition } from "../../types";

export type LauncherCommandId =
  | "load-artifact"
  | "open-skill"
  | "scratch"
  | "compose-scratch"
  | "capture-clipboard"
  | "clipboard-to-context"
  | "workflow-review-current-change"
  | "workflow-fix-failing-tests"
  | "workflow-plan-next-step"
  | "workflow-write-pr-description"
  | "workflow-rescue-stuck-agent"
  | "workflow-summarize-thread"
  | "user-command"
  | "run-last-prompt"
  | "open-recent-context-stack"
  | "clear-expired-contexts"
  | "reveal-last-failed-delivery"
  | "browse-library"
  | "browse-prompts"
  | "browse-contexts"
  | "browse-skills"
  | "browse-commands"
  | "add-prompt"
  | "add-context"
  | "add-skill"
  | "create-prompt"
  | "create-context"
  | "create-skill"
  | "browse-packs"
  | "discover-skills"
  | "find-agent-skills"
  | "install-agent-skill"
  | "review-installed-skills"
  | "import-github"
  | "export-prompt-project"
  | "export-context-project"
  | "install-skill-project"
  | "create-agents-snippet"
  | "project-setup"
  | "open-library"
  | "preferences";

export type LauncherCommandCategory =
  | "Scratch"
  | "Clipboard"
  | "Workflow"
  | "Command"
  | "History"
  | "Create"
  | "Import"
  | "Project"
  | "Library"
  | "Settings";

export type LauncherCommandHomePlacement = "home" | "search";

export type LauncherCommandArtifactRequirement =
  | PromptArtifactType
  | "any"
  | "none";

export type LauncherCommand = {
  id: LauncherCommandId;
  label: string;
  description: string;
  category?: LauncherCommandCategory;
  keywords?: readonly string[];
  aliases?: readonly string[];
  homePlacement?: LauncherCommandHomePlacement;
  artifactRequirement?: LauncherCommandArtifactRequirement;
  privacyLabel?: string;
  detailLabel?: string;
  artifactId?: string;
  artifactType?: PromptArtifactType;
  draftId?: string;
  scratchText?: string;
  userCommand?: UserLauncherCommandDefinition;
};
