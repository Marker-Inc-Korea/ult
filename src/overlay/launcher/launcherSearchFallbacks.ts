import type { LauncherCommand } from "./launcherCommandTypes";

export function createArtifactCommand(
  artifactType: "prompt" | "context" | "skill",
  term: string,
): LauncherCommand {
  const handle = term
    ? `${artifactPrefix(artifactType)}${term}`
    : `a ${artifactType}`;
  return {
    id: artifactType === "prompt"
      ? "create-prompt"
      : artifactType === "context"
      ? "create-context"
      : "create-skill",
    label: `Create ${handle}`,
    description: artifactType === "skill"
      ? "New persistent SKILL.md package."
      : `New ${artifactType} from Launcher.`,
    category: "Create",
    keywords: ["create", "new", artifactType, ...(artifactType === "skill" ? ["SKILL.md"] : [])],
    aliases: createAliases(artifactType),
    artifactRequirement: "none",
    draftId: term,
  };
}

export function findMissingCommand(term: string): LauncherCommand {
  const handle = term ? `/${term}` : "/command";
  return {
    id: "browse-commands",
    label: `Find ${handle}`,
    description: "No command matched. Browse Launcher commands.",
    category: "Command",
    keywords: ["command", "commands", "browse", "create"],
    aliases: ["command library", "show commands", "명령 목록", "런처 명령"],
    artifactRequirement: "none",
  };
}

export function composeScratchCommand(query: string): LauncherCommand {
  return {
    id: "compose-scratch",
    label: "Scratch",
    description: `"${truncateInline(query)}"`,
    category: "Scratch",
    keywords: ["compose", "draft", "temporary prompt"],
    aliases: ["임시 프롬프트"],
    artifactRequirement: "none",
    scratchText: query,
  };
}

function artifactPrefix(artifactType: "prompt" | "context" | "skill") {
  if (artifactType === "prompt") return "#";
  if (artifactType === "context") return "@";
  return "$";
}

function createAliases(artifactType: "prompt" | "context" | "skill") {
  if (artifactType === "prompt") return ["새 프롬프트", "프롬프트 만들기"];
  if (artifactType === "context") return ["새 컨텍스트", "컨텍스트 만들기"];
  return ["새 스킬", "스킬 만들기"];
}

function truncateInline(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 42) return normalized;
  return `${normalized.slice(0, 39)}...`;
}
