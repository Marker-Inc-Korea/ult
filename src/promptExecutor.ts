import { native } from "./native";
import { parseTemplateVariables, renderPromptTemplate } from "./templatePrompt";
import type {
  DeliveryCommandResult,
  DeliveryMode,
  DeliveryResultEvent,
  PromptDefinition,
  PromptExecutionKind,
  PromptExecutionState,
  PromptRegistrySource,
} from "./types";
import {
  DEFAULT_LOADED_DELIVERY_MODE,
  artifactHandle,
  isDeliverableArtifact,
  promptArtifactType,
} from "./promptUtils";

export type PreparedPromptExecution = {
  promptId: string | null;
  promptKind: PromptExecutionKind;
  label: string;
  artifactHandle: string | null;
  deliveryMode: DeliveryMode;
  text: string;
  contextTitles: string[];
  contextHandles: string[];
  unresolvedVariables: string[];
  templateValueLabels?: string[];
};

export function prepareRegistryPrompt(
  prompt: PromptDefinition,
  library: PromptDefinition[] = [],
  additionalContextIds: string[] = [],
): PreparedPromptExecution {
  assertDeliverableArtifact(prompt);
  const contexts = mergeContextArtifacts(
    contextArtifactsForPrompt(prompt, library),
    contextArtifactsForIds(additionalContextIds, library),
  );
  return {
    promptId: prompt.id,
    promptKind: promptKindFromArtifact(prompt),
    label: prompt.title,
    artifactHandle: artifactHandle(prompt),
    deliveryMode: DEFAULT_LOADED_DELIVERY_MODE,
    text: composeInterventionText(prompt, prompt.prompt, library, contexts),
    contextTitles: contexts.map((context) => context.title),
    contextHandles: contexts.map(artifactHandle),
    unresolvedVariables: [],
    templateValueLabels: [],
  };
}

export function prepareTemplatePrompt(
  prompt: PromptDefinition,
  values: Record<string, string>,
  library: PromptDefinition[] = [],
  additionalContextIds: string[] = [],
): PreparedPromptExecution {
  assertDeliverableArtifact(prompt);
  const contexts = mergeContextArtifacts(
    mergeContextArtifacts(
      contextArtifactsForPrompt(prompt, library),
      contextArtifactsForIds(additionalContextIds, library),
    ),
    contextArtifactsForTemplateValues(values, library),
  );
  const variables = prompt.template_variables?.length
    ? prompt.template_variables
    : parseTemplateVariables(prompt.prompt).variables;
  return {
    promptId: prompt.id,
    promptKind: "template",
    label: prompt.title,
    artifactHandle: artifactHandle(prompt),
    deliveryMode: DEFAULT_LOADED_DELIVERY_MODE,
    text: composeInterventionText(
      prompt,
      renderPromptTemplate(prompt.prompt, values),
      library,
      contexts,
    ),
    contextTitles: contexts.map((context) => context.title),
    contextHandles: contexts.map(artifactHandle),
    unresolvedVariables: variables.filter((variable) => !values[variable]?.trim()),
    templateValueLabels: templateValueLabelsForValues(variables, values, library),
  };
}

export function prepareScratchPrompt(
  text: string,
  deliveryMode: DeliveryMode,
): PreparedPromptExecution {
  return {
    promptId: null,
    promptKind: "scratch",
    label: "Scratch",
    artifactHandle: null,
    deliveryMode,
    text,
    contextTitles: [],
    contextHandles: [],
    unresolvedVariables: [],
    templateValueLabels: [],
  };
}

export function stateForDeliveryResult(
  result: DeliveryResultEvent,
): PromptExecutionState {
  return result.execution_state;
}

export function applyPreparedPrompt(
  prepared: PreparedPromptExecution,
): Promise<DeliveryCommandResult> {
  return native.deliverPromptAtPointer(
    prepared.text,
    prepared.deliveryMode,
    prepared.promptId,
    prepared.promptKind,
  );
}

export function withDeliveryMode(
  prepared: PreparedPromptExecution,
  deliveryMode: DeliveryMode,
): PreparedPromptExecution {
  return {
    ...prepared,
    deliveryMode,
  };
}

function composeInterventionText(
  prompt: PromptDefinition,
  renderedPromptText: string,
  library: PromptDefinition[],
  contexts = contextArtifactsForPrompt(prompt, library),
) {
  const text = renderedPromptText.trim();
  if (promptArtifactType(prompt) === "context") {
    return contextBlock([prompt]);
  }

  if (contexts.length === 0) return text;
  return `${contextBlock(contexts)}\n\nInstruction:\n${text}`;
}

function assertDeliverableArtifact(prompt: PromptDefinition) {
  if (!isDeliverableArtifact(prompt)) {
    throw new Error("Skills cannot be loaded for delivery.");
  }
}

function contextArtifactsForPrompt(
  prompt: PromptDefinition,
  library: PromptDefinition[],
) {
  const contextIds = prompt.contexts ?? [];
  if (contextIds.length === 0) return [];
  const byId = new Map(library.map((entry) => [entry.id, entry]));
  return contextIds
    .map((id) => byId.get(id))
    .filter((entry): entry is PromptDefinition =>
      Boolean(entry) && promptArtifactType(entry!) === "context",
    );
}

function contextArtifactsForTemplateValues(
  values: Record<string, string>,
  library: PromptDefinition[],
) {
  return mergeContextArtifacts(
    [],
    Object.values(values).flatMap((value) =>
      contextArtifactsForTemplateValue(value, library)
    ),
  );
}

function templateValueLabelsForValues(
  variables: string[],
  values: Record<string, string>,
  library: PromptDefinition[],
) {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const variable of variables) {
    const value = values[variable]?.trim();
    if (!value) continue;
    const contextLabels = contextArtifactsForTemplateValue(value, library).map(artifactHandle);
    const nextLabels = contextLabels.length > 0 ? contextLabels : [variable];
    for (const label of nextLabels) {
      if (seen.has(label)) continue;
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

function contextArtifactsForTemplateValue(
  value: string,
  library: PromptDefinition[],
) {
  const byId = new Map(library.map((entry) => [entry.id, entry]));
  const contextIds = new Set<string>();
  for (const match of value.matchAll(/(^|[\s,;()[\]{}])@([A-Za-z0-9_-]+)/g)) {
    const contextId = match[2];
    if (contextId) contextIds.add(contextId);
  }
  return [...contextIds]
    .map((id) => byId.get(id))
    .filter((entry): entry is PromptDefinition =>
      Boolean(entry) && promptArtifactType(entry!) === "context",
    );
}

function contextArtifactsForIds(
  contextIds: string[],
  library: PromptDefinition[],
) {
  if (contextIds.length === 0) return [];
  const byId = new Map(library.map((entry) => [entry.id, entry]));
  return contextIds
    .map((id) => byId.get(id))
    .filter((entry): entry is PromptDefinition =>
      Boolean(entry) && promptArtifactType(entry!) === "context",
    );
}

function mergeContextArtifacts(
  primary: PromptDefinition[],
  secondary: PromptDefinition[],
) {
  const seen = new Set<string>();
  const merged: PromptDefinition[] = [];
  for (const context of [...primary, ...secondary]) {
    if (seen.has(context.id)) continue;
    seen.add(context.id);
    merged.push(context);
  }
  return merged;
}

function contextBlock(contexts: PromptDefinition[]) {
  return [
    "Context:",
    ...contexts.map((context) => `\n### ${context.title}\n${context.prompt.trim()}`),
  ].join("\n");
}

function promptKindFromArtifact(prompt: PromptDefinition): PromptExecutionKind {
  if (promptArtifactType(prompt) === "context") return "context";
  return promptKindFromRegistrySource(prompt.registry_source);
}

function promptKindFromRegistrySource(
  source: PromptRegistrySource | null | undefined,
): PromptExecutionKind {
  if (source === "bundled") return "bundled";
  return "local";
}
