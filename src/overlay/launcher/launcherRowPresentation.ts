import { createElement } from "../../dom";
import {
  artifactHandle,
  promptArtifactType,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { LauncherCommand } from "./launcherCommandTypes";
import {
  commandCategoryLabel,
  commandHandle,
  commandTitle,
} from "./searchCommandPresentation";

type RowNamespace = {
  symbol: string;
  className: string;
  label: string;
};

export function launcherArtifactRowText(prompt: PromptDefinition) {
  const handle = artifactHandle(prompt);
  const type = promptArtifactType(prompt);
  return launcherRowText({
    namespace: artifactNamespace(type),
    primary: handle,
    primaryTitle: `${handle} - ${prompt.title}`,
    secondary: prompt.description.trim() || prompt.title,
    rootClassName: "palette-search-result-text",
    primaryClassName: "palette-search-result-name palette-search-result-handle",
    secondaryClassName: "palette-search-result-description",
  });
}

export function launcherCommandRowText(command: LauncherCommand) {
  const handle = commandHandle(command);
  return launcherRowText({
    namespace: {
      symbol: "/",
      className: "is-command",
      label: "Command",
    },
    primary: commandTitle(command),
    primaryTitle: `${handle} - ${commandTitle(command)}`,
    secondary: command.detailLabel?.trim()
      || command.description.trim()
      || commandCategoryLabel(command),
    rootClassName: "palette-search-command-text",
    primaryClassName: "palette-search-command-name",
    secondaryClassName: "palette-search-command-description",
  });
}

export function artifactNamespace(
  type: ReturnType<typeof promptArtifactType>,
): RowNamespace {
  if (type === "context") {
    return {
      symbol: "@",
      className: "is-context",
      label: "Context",
    };
  }
  if (type === "skill") {
    return {
      symbol: "$",
      className: "is-skill",
      label: "Skill",
    };
  }
  return {
    symbol: "#",
    className: "is-prompt",
    label: "Prompt",
  };
}

function launcherRowText(options: {
  namespace: RowNamespace;
  primary: string;
  primaryTitle: string;
  secondary: string;
  rootClassName: string;
  primaryClassName: string;
  secondaryClassName: string;
}) {
  const text = createElement("span", `${options.rootClassName} palette-launcher-row-text`);
  text.append(
    launcherRowIcon(options.namespace),
    launcherRowCopy(options),
  );
  return text;
}

function launcherRowIcon(namespace: RowNamespace) {
  const icon = createElement(
    "span",
    `palette-launcher-row-icon ${namespace.className}`,
    namespace.symbol,
  );
  icon.setAttribute("aria-label", namespace.label);
  icon.title = namespace.label;
  return icon;
}

function launcherRowCopy(options: {
  primary: string;
  primaryTitle: string;
  secondary: string;
  primaryClassName: string;
  secondaryClassName: string;
}) {
  const copy = createElement("span", "palette-launcher-row-copy");
  const primary = createElement("strong", options.primaryClassName, options.primary);
  primary.title = options.primaryTitle;
  const secondary = createElement("small", options.secondaryClassName, options.secondary);
  secondary.title = options.secondary;
  copy.append(primary, secondary);
  return copy;
}
