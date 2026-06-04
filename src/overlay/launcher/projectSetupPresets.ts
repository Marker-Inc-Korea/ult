import { STARTER_PACKS } from "../../data/starterPacks";
import {
  isNonExpiredArtifact,
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import type {
  PromptArtifactType,
  PromptDefinition,
} from "../../types";

export const CUSTOM_PROJECT_SETUP_PRESET_ID = "custom";
export const DEFAULT_PROJECT_SETUP_PRESET_ID = STARTER_PACKS[0]?.id ?? "agent-control";

export type ProjectSetupPreset = {
  id: string;
  title: string;
  description: string;
  includes: string[];
  keywords: string[];
  packId: string | null;
};

export type ProjectSetupPresetSelection = {
  presetId: string;
  selectedArtifactIds: string[];
  includeAgentsSnippet: boolean;
  agentsSnippetArtifactId: string | null;
  matchedArtifactIds: string[];
  usesFallback: boolean;
  totalProjectItems: number;
};

const MAX_PROJECT_SETUP_ARTIFACTS = 7;

const FALLBACK_TYPE_LIMITS: Record<PromptArtifactType, number> = {
  prompt: 3,
  context: 2,
  skill: 2,
};

const PRESET_KEYWORD_EXTRAS: Record<string, string[]> = {
  "agent-control": ["pause", "redirect", "stuck", "handoff", "scope", "summary"],
  "pr-review": ["change", "patch", "regression", "risk", "test", "qa"],
  debugging: ["triage", "reproduce", "diagnostic", "logs", "failing", "fix"],
  planning: ["breakdown", "steps", "proposal", "roadmap", "task", "todo"],
  "release-prep": ["deploy", "deployment", "rc", "checklist", "changelog", "qa"],
};

export function projectSetupPresets(): ProjectSetupPreset[] {
  return [
    ...STARTER_PACKS.map((pack) => ({
      id: pack.id,
      title: pack.title,
      description: pack.description,
      includes: pack.includes,
      keywords: [
        pack.id,
        pack.title,
        ...pack.keywords,
        ...(PRESET_KEYWORD_EXTRAS[pack.id] ?? []),
      ],
      packId: pack.id,
    })),
    {
      id: CUSTOM_PROJECT_SETUP_PRESET_ID,
      title: "Custom Selection",
      description: "Choose exact local artifacts manually.",
      includes: ["manual prompt, context, skill, and AGENTS.md selection"],
      keywords: ["custom", "manual", "advanced"],
      packId: null,
    },
  ];
}

export function normalizeProjectSetupPresetId(id: string | null | undefined) {
  const presetIds = new Set(projectSetupPresets().map((preset) => preset.id));
  return id && presetIds.has(id) ? id : DEFAULT_PROJECT_SETUP_PRESET_ID;
}

export function projectSetupCandidates(prompts: PromptDefinition[]) {
  return prompts.filter((prompt) =>
    promptScope(prompt) === "persistent" && isNonExpiredArtifact(prompt)
  );
}

export function projectSetupPresetSelection(
  candidates: PromptDefinition[],
  presetId: string | null | undefined,
  customSelection: {
    selectedArtifactIds?: string[];
    includeAgentsSnippet?: boolean;
    agentsSnippetArtifactId?: string | null;
  } = {},
): ProjectSetupPresetSelection {
  const normalizedPresetId = normalizeProjectSetupPresetId(presetId);
  if (normalizedPresetId === CUSTOM_PROJECT_SETUP_PRESET_ID) {
    return customProjectSetupSelection(candidates, customSelection);
  }

  const preset = projectSetupPresets().find((option) => option.id === normalizedPresetId)
    ?? projectSetupPresets()[0];
  const matchedArtifactIds = rankedPresetArtifacts(candidates, preset)
    .slice(0, MAX_PROJECT_SETUP_ARTIFACTS)
    .map((entry) => entry.artifact.id);
  const selectedArtifactIds = matchedArtifactIds.length > 0
    ? fillPresetSelection(candidates, matchedArtifactIds)
    : defaultProjectSetupArtifactIds(candidates);
  const agentsSnippetArtifactId = defaultAgentsSnippetArtifactId(candidates, selectedArtifactIds);
  const includeAgentsSnippet = Boolean(agentsSnippetArtifactId);
  return {
    presetId: normalizedPresetId,
    selectedArtifactIds,
    includeAgentsSnippet,
    agentsSnippetArtifactId,
    matchedArtifactIds,
    usesFallback: matchedArtifactIds.length === 0 && selectedArtifactIds.length > 0,
    totalProjectItems: selectedArtifactIds.length + (includeAgentsSnippet ? 1 : 0),
  };
}

export function defaultProjectSetupArtifactIds(candidates: PromptDefinition[]) {
  const selected: string[] = [];
  const selectedByType: Record<PromptArtifactType, number> = {
    prompt: 0,
    context: 0,
    skill: 0,
  };
  for (const type of ["prompt", "context", "skill"] as PromptArtifactType[]) {
    for (const artifact of candidates) {
      if (selected.length >= MAX_PROJECT_SETUP_ARTIFACTS) return selected;
      if (promptArtifactType(artifact) !== type) continue;
      if (selectedByType[type] >= FALLBACK_TYPE_LIMITS[type]) break;
      if (selected.includes(artifact.id)) continue;
      selected.push(artifact.id);
      selectedByType[type] += 1;
    }
  }
  return selected;
}

export function defaultAgentsSnippetArtifactId(
  candidates: PromptDefinition[],
  selectedArtifactIds: string[],
) {
  const byId = new Map(candidates.map((artifact) => [artifact.id, artifact]));
  return selectedArtifactIds.find((id) =>
    promptArtifactType(byId.get(id) ?? { artifact_type: "prompt" }) === "prompt"
  )
    ?? selectedArtifactIds[0]
    ?? null;
}

function customProjectSetupSelection(
  candidates: PromptDefinition[],
  customSelection: {
    selectedArtifactIds?: string[];
    includeAgentsSnippet?: boolean;
    agentsSnippetArtifactId?: string | null;
  },
): ProjectSetupPresetSelection {
  const validCandidateIds = new Set(candidates.map((artifact) => artifact.id));
  const selectedArtifactIds = uniqueIds(customSelection.selectedArtifactIds ?? [])
    .filter((id) => validCandidateIds.has(id));
  const agentsSnippetArtifactId = customSelection.agentsSnippetArtifactId
    && validCandidateIds.has(customSelection.agentsSnippetArtifactId)
    ? customSelection.agentsSnippetArtifactId
    : defaultAgentsSnippetArtifactId(candidates, selectedArtifactIds);
  const includeAgentsSnippet = Boolean(customSelection.includeAgentsSnippet && agentsSnippetArtifactId);
  return {
    presetId: CUSTOM_PROJECT_SETUP_PRESET_ID,
    selectedArtifactIds,
    includeAgentsSnippet,
    agentsSnippetArtifactId,
    matchedArtifactIds: [],
    usesFallback: false,
    totalProjectItems: selectedArtifactIds.length + (includeAgentsSnippet ? 1 : 0),
  };
}

function rankedPresetArtifacts(
  candidates: PromptDefinition[],
  preset: ProjectSetupPreset,
) {
  return candidates
    .map((artifact, index) => ({
      artifact,
      index,
      score: projectSetupPresetScore(artifact, preset),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function fillPresetSelection(
  candidates: PromptDefinition[],
  matchedArtifactIds: string[],
) {
  const selected = uniqueIds(matchedArtifactIds);
  for (const artifactId of defaultProjectSetupArtifactIds(candidates)) {
    if (selected.length >= MAX_PROJECT_SETUP_ARTIFACTS) break;
    if (!selected.includes(artifactId)) selected.push(artifactId);
  }
  return selected;
}

function projectSetupPresetScore(
  artifact: PromptDefinition,
  preset: ProjectSetupPreset,
) {
  const haystack = normalizeSearchText([
    artifact.id,
    artifact.title,
    artifact.description ?? "",
    promptArtifactType(artifact),
  ].join(" "));
  let score = 0;
  for (const keyword of preset.keywords) {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (!normalizedKeyword) continue;
    if (haystack.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 4 : 2;
    }
  }
  if (preset.packId && haystack.includes(normalizeSearchText(preset.packId.replace(/-/g, " ")))) {
    score += 4;
  }
  return score;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueIds(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}
