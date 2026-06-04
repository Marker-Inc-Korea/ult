import type { ExternalSkillDiscoveryIntent } from "../../data/externalSkillDiscovery";
import type {
  LauncherLibraryFilter,
  PromptPaletteRuntime,
} from "../../paletteRuntime";
import type {
  LauncherMode,
  ProjectArtifactWriteKind,
  PromptArtifactType,
  PromptDefinition,
  UsageHistoryEntry,
} from "../../types";
import type { PreparePromptOptions } from "../loaded/deliveryController";
import type {
  LauncherCommand,
  LauncherCommandId,
} from "./launcherCommandTypes";

export type LauncherCommandEffect =
  | {
    type: "prepare-prompt";
    prompt: PromptDefinition;
    contextIds: string[];
    options?: PreparePromptOptions;
  }
  | {
    type: "open-launcher-mode";
    mode: LauncherMode;
  }
  | {
    type: "open-library-mode";
    filter: LauncherLibraryFilter;
  }
  | {
    type: "set-scratch-text";
    text: string;
  }
  | {
    type: "set-search-query";
    query: string;
  }
  | {
    type: "feedback";
    message: string;
    tone?: "neutral" | "warning";
  }
  | {
    type: "rerender";
  }
  | {
    type: "capture-clipboard-context";
  }
  | {
    type: "reveal-skill-source";
    artifactId: string;
  }
  | {
    type: "open-preferences";
  }
  | {
    type: "open-artifact-composer";
    kind: "new" | "edit" | "duplicate";
    artifactType: PromptArtifactType;
    initialId?: string | null;
    fallbackMessage: string;
  }
  | {
    type: "open-github-import";
    fallbackMessage: string;
  }
  | {
    type: "open-starter-packs";
    fallbackMessage: string;
  }
  | {
    type: "open-skill-discovery";
    intent: ExternalSkillDiscoveryIntent;
  }
  | {
    type: "open-project-write";
    writeKind: ProjectArtifactWriteKind;
    artifactType: PromptArtifactType | null;
    artifactId?: string | null;
    unavailableMessage: string;
    fallbackMessage: string;
  }
  | {
    type: "open-project-setup";
    fallbackQuery: string;
    fallbackMessage: string;
  }
  | {
    type: "open-workflow-input";
    commandId: string;
    contextHandleText: string;
  }
  | {
    type: "open-recovery-panel";
    entry: UsageHistoryEntry;
  }
  | {
    type: "clear-expired-contexts";
  }
  | {
    type: "open-library-folder";
  };

export type LauncherCommandExecutionContext = {
  palette: PromptPaletteRuntime;
  command: LauncherCommand;
};

export type LauncherCommandExecutionResult =
  | LauncherCommandEffect
  | LauncherCommandEffect[]
  | null;

export type LauncherCommandAvailabilityRule = (
  palette: PromptPaletteRuntime,
) => boolean;

export type LauncherCommandHandler = (
  context: LauncherCommandExecutionContext,
) => LauncherCommandExecutionResult;

export type LauncherCommandCapability = {
  id: LauncherCommandId;
  available?: LauncherCommandAvailabilityRule;
  title?: (command: LauncherCommand) => string;
  categoryLabel?: (command: LauncherCommand) => string;
  kindLabel?: (command: LauncherCommand) => string;
  sectionLabel?: (command: LauncherCommand) => string;
  primaryAction: (command: LauncherCommand) => string;
  execute: LauncherCommandHandler;
};
