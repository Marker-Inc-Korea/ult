import type { PromptPaletteRuntime } from "../../paletteRuntime";
import type { LauncherCommand } from "./launcherCommandTypes";
import {
  STATIC_COMMANDS,
} from "./launcherCommandDefinitions";
import {
  DYNAMIC_COMMAND_CAPABILITIES,
  fallbackCapability,
  staticCommandCapability,
} from "./launcherCommandHandlers";
import {
  commandCategoryLabelFromResolvedCapability,
  commandKindLabelFromResolvedCapability,
  commandSectionLabelFromResolvedCapability,
  commandTitleFromResolvedCapability,
} from "./launcherCommandMetadata";
import type {
  LauncherCommandCapability,
} from "./launcherCommandEffects";

export type {
  LauncherCommandCapability,
  LauncherCommandEffect,
  LauncherCommandExecutionContext,
  LauncherCommandExecutionResult,
} from "./launcherCommandEffects";

export {
  artifactCommand,
  BASE_COMMANDS,
  CAPTURE_CLIPBOARD_COMMAND,
  HISTORY_COMMANDS,
  LIBRARY_BROWSE_COMMANDS,
  LIBRARY_HOME_COMMAND,
  MANAGEMENT_COMMANDS,
  SCRATCH_COMMAND,
} from "./launcherCommandDefinitions";

const STATIC_CAPABILITIES: LauncherCommandCapability[] = STATIC_COMMANDS.map(
  staticCommandCapability,
);

const CAPABILITY_BY_ID = new Map(
  [...STATIC_CAPABILITIES, ...DYNAMIC_COMMAND_CAPABILITIES].map((capability) => [
    capability.id,
    capability,
  ]),
);

export function launcherCommandCapability(command: LauncherCommand) {
  return CAPABILITY_BY_ID.get(command.id) ?? fallbackCapability(command);
}

export function launcherCommandAvailable(
  command: LauncherCommand,
  palette: PromptPaletteRuntime,
) {
  return launcherCommandCapability(command).available?.(palette) ?? true;
}

export function launcherCommandDefinitions() {
  return [...CAPABILITY_BY_ID.values()];
}

export function commandTitleFromCapability(command: LauncherCommand) {
  return commandTitleFromResolvedCapability(
    command,
    launcherCommandCapability(command),
  );
}

export function commandCategoryLabelFromCapability(command: LauncherCommand) {
  return commandCategoryLabelFromResolvedCapability(
    command,
    launcherCommandCapability(command),
  );
}

export function commandKindLabelFromCapability(command: LauncherCommand) {
  return commandKindLabelFromResolvedCapability(
    command,
    launcherCommandCapability(command),
  );
}

export function commandSectionLabelFromCapability(command: LauncherCommand) {
  return commandSectionLabelFromResolvedCapability(
    command,
    launcherCommandCapability(command),
  );
}

export function commandPrimaryActionFromCapability(command: LauncherCommand) {
  return launcherCommandCapability(command).primaryAction(command);
}
