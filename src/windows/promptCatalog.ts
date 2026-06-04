import { bundledPrompts } from "../data/prompts";
import { native } from "../native";
import { mergePromptsWithDiagnostics } from "../promptUtils";
import type { PromptDefinition, PromptLoadResult, PromptRegistryEntry } from "../types";

export type PromptCatalog = {
  prompts: PromptDefinition[];
  configPath: string;
  bundledPromptIds: Set<string>;
  localPromptIds: Set<string>;
  editablePromptIds: Set<string>;
  entriesById: Map<string, PromptRegistryEntry>;
  errors: string[];
  warnings: string[];
};

export async function loadPromptCatalog(reload = false): Promise<PromptCatalog> {
  const result = reload
    ? await native.reloadInterventionLibrary()
    : await native.loadInterventionLibrary();
  return promptCatalogFromLoadResult(result);
}

export function promptCatalogFromLoadResult(result: PromptLoadResult): PromptCatalog {
  const registryEntries = result.entries ?? [];
  const merged = registryEntries.length > 0
    ? { prompts: result.artifacts, warnings: [] }
    : mergePromptsWithDiagnostics(bundledPrompts, result.artifacts);
  const bundledPromptIds = new Set(bundledPrompts.map((prompt) => prompt.id));
  const entriesById = new Map(registryEntries.map((entry) => [entry.prompt.id, entry]));
  const localPromptIds = registryEntries.length > 0
    ? new Set(
      registryEntries
        .filter((entry) => entry.source !== "bundled")
        .map((entry) => entry.prompt.id),
    )
    : new Set(result.artifacts.map((prompt) => prompt.id));
  const registryDiagnostics = registryEntries.flatMap((entry) =>
    entry.diagnostics.map((diagnostic) => `${entry.prompt.id}: ${diagnostic}`),
  );
  return {
    prompts: merged.prompts,
    configPath: result.registry_path || result.config_path,
    bundledPromptIds,
    localPromptIds,
    editablePromptIds: new Set(result.editable_artifact_ids ?? []),
    entriesById,
    errors: result.errors,
    warnings: [...(result.warnings ?? []), ...merged.warnings, ...registryDiagnostics],
  };
}
