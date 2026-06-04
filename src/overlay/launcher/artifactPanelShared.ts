import { createElement } from "../../dom";
import type { PromptDefinition } from "../../types";
import {
  promptArtifactType,
  promptScope,
} from "../../promptUtils";
import { handleLauncherEscape } from "./launcherShell";

export function actionHint(label: string, keys: string[]) {
  const hint = createElement("span", "palette-artifact-hint");
  hint.append(createElement("strong", undefined, label));
  for (const key of keys) hint.append(createElement("kbd", undefined, key));
  return hint;
}

export function handleBackShortcut(event: KeyboardEvent, close: () => void) {
  if (handleLauncherEscape(event, close)) return true;
  if (isCommandOnly(event) && event.key === "[") {
    event.preventDefault();
    event.stopPropagation();
    close();
    return true;
  }
  return false;
}

export function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}

export function sourcePathLabel(artifact: PromptDefinition) {
  if (artifact.registry_source_path) {
    return compactPath(artifact.registry_source_path);
  }
  const scope = promptScope(artifact);
  const kind = promptArtifactType(artifact);
  const file = kind === "skill" ? "SKILL.md" : kind === "context" ? "CONTEXT.md" : "PROMPT.md";
  const directory = kind === "skill" ? "skills" : kind === "context" ? "contexts" : "prompts";
  return `personal-library > ${scope} > ${directory} > ${artifact.id} > ${file}`;
}

function compactPath(path: string) {
  return path
    .replace(/^.*\/personal-library\//, "personal-library/")
    .split("/")
    .join(" > ");
}
