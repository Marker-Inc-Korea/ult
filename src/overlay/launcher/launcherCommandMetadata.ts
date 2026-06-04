import type {
  LauncherCommandCapability,
} from "./launcherCommandEffects";
import type { LauncherCommand } from "./launcherCommandTypes";

export function fallbackCommandCategoryLabel(command: LauncherCommand) {
  if (command.detailLabel) return command.detailLabel;
  return command.category ?? "Command";
}

export function fallbackCommandSectionLabel(command: LauncherCommand) {
  if (isWorkflowCommand(command)) return "Workflow";
  if (command.category === "History") return "History";
  if (command.category === "Create") return "Create";
  if (command.category === "Import") return "Import";
  if (command.category === "Project") return "Project";
  if (command.category === "Library") return "Library";
  if (command.category === "Settings") return "Settings";
  if (command.category === "Scratch") return "Scratch";
  return "Commands";
}

export function fallbackCommandKindLabel(command: LauncherCommand) {
  if (command.id === "user-command") return "Command";
  return "Command";
}

export function commandTitleFromResolvedCapability(
  command: LauncherCommand,
  capability: LauncherCommandCapability,
) {
  return capability.title?.(command) ?? command.label;
}

export function commandCategoryLabelFromResolvedCapability(
  command: LauncherCommand,
  capability: LauncherCommandCapability,
) {
  return capability.categoryLabel?.(command)
    ?? fallbackCommandCategoryLabel(command);
}

export function commandKindLabelFromResolvedCapability(
  command: LauncherCommand,
  capability: LauncherCommandCapability,
) {
  return capability.kindLabel?.(command)
    ?? fallbackCommandKindLabel(command);
}

export function commandSectionLabelFromResolvedCapability(
  command: LauncherCommand,
  capability: LauncherCommandCapability,
) {
  return capability.sectionLabel?.(command)
    ?? fallbackCommandSectionLabel(command);
}

function isWorkflowCommand(command: LauncherCommand) {
  return command.category === "Workflow";
}
