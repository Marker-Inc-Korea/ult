import { bundledPrompts } from "../../data/prompts";
import { native } from "../../native";
import {
  isPalettePrompt,
  mergePromptsWithDiagnostics,
} from "../../promptUtils";
import { parseTemplateVariables } from "../../templatePrompt";
import type {
  AccessibilityStatus,
  AppSettings,
  PromptDefinition,
  PromptLoadResult,
  UserLauncherCommandDefinition,
  UsageHistoryEntry,
} from "../../types";
import type { LauncherLibraryDiagnostic } from "../../paletteRuntimeState";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appearance: "dark",
  palette_visible_count: 5,
  pinned_artifact_ids: [],
  launch_at_login: false,
  project_metadata_enabled: false,
  open_palette_shortcut: "Cmd+U",
  search_shortcut: "Option+Space",
  scratch_prompt_shortcut: "Cmd+Option+Control+S",
  meta_prompting_enabled: false,
  meta_prompting_provider: "openai",
  meta_prompting_model: "gpt-5-mini",
  meta_prompting_template: "Refine this rough coding-agent prompt for review and delivery. If it is vague, social, filler, or missing a concrete task, turn it into a concise instruction for the coding agent to pause and ask for the missing task, file path, command, or constraint instead of inventing work.\n\nRough prompt:\n{input}",
};

export async function loadOverlayData() {
  const [library, appSettings, accessibilityStatus, history] = await Promise.all([
    loadOverlayLibrary(),
    loadAppSettings(),
    loadAccessibilityStatus(),
    loadUsageHistory(),
  ]);
  return {
    prompts: library.prompts,
    userCommands: library.userCommands,
    libraryDiagnostics: library.diagnostics,
    appSettings,
    accessibilityStatus,
    history,
  };
}

export async function loadOverlayLibrary(): Promise<{
  prompts: PromptDefinition[];
  userCommands: UserLauncherCommandDefinition[];
  diagnostics: LauncherLibraryDiagnostic[];
}> {
  try {
    const result = await native.loadInterventionLibrary();
    return {
      prompts: promptsFromLoadResult(result),
      userCommands: userCommandsFromLoadResult(result),
      diagnostics: libraryDiagnosticsFromLoadResult(result),
    };
  } catch (error) {
    console.error("Failed to load intervention library", error);
    return {
      prompts: [...bundledPrompts],
      userCommands: [],
      diagnostics: [{
        severity: "error",
        message: "Intervention library could not be loaded; bundled prompts are shown.",
      }],
    };
  }
}

export async function loadOverlayPrompts() {
  return (await loadOverlayLibrary()).prompts;
}

export function promptsFromLoadResult(result: PromptLoadResult) {
  if (result.entries && result.entries.length > 0) {
    if (result.errors.length > 0 || result.warnings.length > 0) {
      console.warn("Intervention library diagnostics", {
        errors: result.errors,
        warnings: result.warnings ?? [],
      });
    }
    return result.entries.map((entry) => ({
      ...entry.prompt,
      registry_source: entry.source,
      registry_source_path: entry.source_path ?? null,
      registry_source_created_ms: entry.source_created_ms ?? null,
      registry_source_modified_ms: entry.source_modified_ms ?? null,
      registry_editable: entry.editable,
      template_variables: entry.template_variables,
      template_diagnostics: entry.diagnostics,
    }));
  }

  const merged = mergePromptsWithDiagnostics(bundledPrompts, result.artifacts);
  if (result.errors.length > 0 || merged.warnings.length > 0 || result.warnings.length > 0) {
    console.warn("Intervention library diagnostics", {
      errors: result.errors,
      warnings: [...(result.warnings ?? []), ...merged.warnings],
    });
  }
  return merged.prompts.map((prompt) => ({
    ...prompt,
    registry_source: "bundled" as const,
    template_variables: parseTemplateVariables(prompt.prompt).variables,
  }));
}

export function userCommandsFromLoadResult(result: PromptLoadResult) {
  return (result.commands ?? []).map((command) => ({
    ...command,
    contexts: [...(command.contexts ?? [])],
    variable_values: { ...(command.variable_values ?? {}) },
    keywords: [...(command.keywords ?? [])],
    aliases: [...(command.aliases ?? [])],
    actions: command.actions?.length ? [...command.actions] : ["prepare" as const],
    home: command.home !== false,
    source_path: command.source_path ?? null,
  }));
}

export function libraryDiagnosticsFromLoadResult(
  result: PromptLoadResult,
): LauncherLibraryDiagnostic[] {
  return [
    ...result.errors.map((message) => ({
      severity: "error" as const,
      message,
    })),
    ...(result.warnings ?? []).map((message) => ({
      severity: "warning" as const,
      message,
    })),
  ];
}

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    return await native.loadAppSettings();
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

async function loadAccessibilityStatus(): Promise<AccessibilityStatus | null> {
  try {
    return await native.accessibilityStatus();
  } catch {
    return null;
  }
}

async function loadUsageHistory(): Promise<UsageHistoryEntry[]> {
  try {
    return await native.loadUsageHistory(100);
  } catch {
    return [];
  }
}

export function orderPaletteArtifacts(
  prompts: PromptDefinition[],
  history: UsageHistoryEntry[],
  pinnedArtifactIds: string[] = [],
) {
  const palettePromptIds = new Set(
    prompts.filter(isPalettePrompt).map((prompt) => prompt.id),
  );
  const pinnedIds = pinnedArtifactIds.filter((id, index) =>
    palettePromptIds.has(id) && pinnedArtifactIds.indexOf(id) === index,
  );
  for (const prompt of prompts) {
    if (isPalettePrompt(prompt) && !pinnedIds.includes(prompt.id)) {
      pinnedIds.push(prompt.id);
    }
  }
  const byId = new Map<string, { count: number; lastTimestamp: number }>();
  for (const entry of history) {
    if (!entry.prompt_id) continue;
    const current = byId.get(entry.prompt_id) ?? { count: 0, lastTimestamp: 0 };
    current.count += 1;
    current.lastTimestamp = Math.max(current.lastTimestamp, entry.timestamp_ms);
    byId.set(entry.prompt_id, current);
  }
  const originalOrder = new Map(prompts.map((prompt, index) => [prompt.id, index]));
  const pinnedOrder = new Map(pinnedIds.map((id, index) => [id, index]));
  return [...prompts].sort((left, right) => {
    const leftPinned = pinnedOrder.get(left.id);
    const rightPinned = pinnedOrder.get(right.id);
    if (leftPinned !== undefined || rightPinned !== undefined) {
      if (leftPinned === undefined) return 1;
      if (rightPinned === undefined) return -1;
      return leftPinned - rightPinned;
    }
    const leftUsage = byId.get(left.id);
    const rightUsage = byId.get(right.id);
    if (leftUsage || rightUsage) {
      if (!leftUsage) return 1;
      if (!rightUsage) return -1;
      if (leftUsage.count !== rightUsage.count) return rightUsage.count - leftUsage.count;
      if (leftUsage.lastTimestamp !== rightUsage.lastTimestamp) {
        return rightUsage.lastTimestamp - leftUsage.lastTimestamp;
      }
    }
    return (originalOrder.get(left.id) ?? 0) - (originalOrder.get(right.id) ?? 0);
  });
}
