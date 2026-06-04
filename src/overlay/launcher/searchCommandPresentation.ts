import type { LauncherCommand } from "./launcherCommands";
import { launcherCommandHandle } from "../../promptUtils";
import {
  commandCategoryLabelFromCapability,
  commandKindLabelFromCapability,
  commandPrimaryActionFromCapability,
  commandSectionLabelFromCapability,
  commandTitleFromCapability,
} from "./launcherCommandCapabilities";

export function commandTitle(command: LauncherCommand) {
  return commandTitleFromCapability(command);
}

export function commandCategoryLabel(command: LauncherCommand) {
  return commandCategoryLabelFromCapability(command);
}

export function commandKindLabel(command: LauncherCommand) {
  return commandKindLabelFromCapability(command);
}

export function commandSectionLabel(command: LauncherCommand) {
  return commandSectionLabelFromCapability(command);
}

export function commandPrimaryAction(command: LauncherCommand) {
  return commandPrimaryActionFromCapability(command);
}

export function commandHandle(command: LauncherCommand) {
  return launcherCommandHandle(command.userCommand?.id ?? command.id);
}
