import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  artifactHandle,
  contextArtifactHandle,
  launcherCommandHandle,
  promptArtifactHandle,
  promptArtifactType,
  skillArtifactHandle,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { LauncherCommand } from "./launcherCommandTypes";
import type {
  LibraryInventoryContext,
  LibraryIssueRow,
} from "./libraryInventoryTypes";
import { userLauncherCommands } from "./userLauncherCommands";

export function libraryIssueRowsForPalette(
  palette: PromptPaletteRuntime,
  context: LibraryInventoryContext,
): LibraryIssueRow[] {
  const rows: LibraryIssueRow[] = [];
  rows.push(...palette.launcherLibraryDiagnostics.map((diagnostic, index) => {
    const subject = diagnosticSubject(diagnostic.message);
    return {
      kind: "issue" as const,
      id: `diagnostic:${diagnostic.severity}:${index}`,
      severity: diagnostic.severity,
      title: diagnosticTitle(diagnostic.message, diagnostic.severity),
      detail: diagnosticDetail(diagnostic.message, subject),
      subject,
      actionCommand: context.openLibraryCommand ?? undefined,
    };
  }));

  for (const prompt of palette.prompts) {
    if (isExpiredEphemeralArtifact(prompt)) {
      const subject = artifactHandle(prompt);
      rows.push({
        kind: "issue",
        id: `expired:${prompt.id}`,
        severity: "warning",
        title: "Expired ephemeral artifact",
        detail: "is expired and can be cleared from the local library.",
        subject,
        actionCommand: context.clearExpiredCommand ?? undefined,
      });
    }
    for (const diagnostic of prompt.template_diagnostics ?? []) {
      if (promptArtifactType(prompt) !== "skill") continue;
      const subject = skillArtifactHandle(prompt.id);
      rows.push({
        kind: "issue",
        id: `skill-metadata:${prompt.id}:${diagnostic}`,
        severity: "warning",
        title: "Unsupported skill metadata",
        detail: diagnostic,
        subject,
      });
    }
  }

  for (const command of userLauncherCommands(palette)) {
    rows.push(...commandIssueRows(command, context));
  }

  return rows;
}

export function commandIssueRows(
  command: LauncherCommand,
  context: LibraryInventoryContext,
): LibraryIssueRow[] {
  const userCommand = command.userCommand;
  if (!userCommand) return [];
  const rows: LibraryIssueRow[] = [];
  const prompt = context.promptById.get(userCommand.prompt_id);
  if (!prompt || promptArtifactType(prompt) !== "prompt") {
    const subject = `${launcherCommandHandle(userCommand.id)} references ${promptArtifactHandle(userCommand.prompt_id)}`;
    rows.push({
      kind: "issue",
      id: `command-missing-prompt:${userCommand.id}:${userCommand.prompt_id}`,
      severity: "error",
      title: "Missing command prompt",
      detail: "Missing prompt reference.",
      subject,
    });
  }
  for (const contextId of userCommand.contexts) {
    const artifact = context.promptById.get(contextId);
    if (!artifact || promptArtifactType(artifact) !== "context") {
      const subject = `${launcherCommandHandle(userCommand.id)} references ${contextArtifactHandle(contextId)}`;
      rows.push({
        kind: "issue",
        id: `command-missing-context:${userCommand.id}:${contextId}`,
        severity: "warning",
        title: "Missing command context",
        detail: "Missing context reference.",
        subject,
      });
    }
  }
  return rows;
}

export function artifactIssueCount(prompt: PromptDefinition) {
  if (promptArtifactType(prompt) === "skill") {
    return (prompt.template_diagnostics ?? []).length;
  }
  return 0;
}

function diagnosticTitle(message: string, severity: "warning" | "error") {
  const normalized = message.toLowerCase();
  if (normalized.includes("malformed")) return "Malformed package";
  if (normalized.includes("unsupported") && normalized.includes("skill")) {
    return "Unsupported skill metadata";
  }
  return severity === "error" ? "Library error" : "Library warning";
}

function diagnosticSubject(message: string) {
  return message.match(/(?:persistent|ephemeral)\/[^\s:]+/)?.[0] ?? undefined;
}

function diagnosticDetail(message: string, subject: string | undefined) {
  if (!subject) return message;
  const afterSubject = message.slice(message.indexOf(subject) + subject.length)
    .replace(/^[:\s-]+/, "")
    .trim();
  return afterSubject || message;
}

function isExpiredEphemeralArtifact(prompt: PromptDefinition) {
  return prompt.scope === "ephemeral"
    && prompt.expires_at !== null
    && prompt.expires_at !== undefined
    && prompt.expires_at <= Date.now();
}
