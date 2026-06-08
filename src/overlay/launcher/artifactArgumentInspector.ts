import { createElement } from "../../dom";
import type { PromptTemplateArgument } from "../../types";

export function createArgumentInspector() {
  const section = createElement("section", "palette-artifact-composer-card");
  const header = createElement("div", "palette-artifact-composer-card-header");
  const add = createElement("button", "palette-artifact-secondary-action", "Add");
  add.type = "button";
  header.append(createElement("h2", undefined, "Argument Schema"), add);
  const list = createElement("div", "palette-artifact-composer-arguments");
  section.append(header, list);
  return { root: section, list, add };
}

export function argumentInspectorRow(argument: PromptTemplateArgument) {
  const row = createElement("div", "palette-artifact-composer-argument");
  row.append(
    createElement("code", undefined, `{{${argument.name}}}`),
    createElement("span", undefined, argument.description || "Text argument"),
  );
  return row;
}
