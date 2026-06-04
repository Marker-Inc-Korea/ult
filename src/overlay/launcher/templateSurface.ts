import { createElement } from "../../dom";
import { templatePrompt, type PromptPaletteRuntime } from "../../paletteRuntime";
import { artifactHandle, promptArtifactType } from "../../promptUtils";
import type { PromptTemplateArgument } from "../../types";
import { createLauncherBody, createLauncherShell } from "./launcherShell";
import type { PaletteRenderActions } from "../shared/renderTypes";

export function renderTemplateForm(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  const prompt = templatePrompt(palette);
  if (!prompt) return;
  const variables = prompt.template_variables ?? [];
  const form = createLauncherShell(palette, actions, {
    tagName: "form",
    className: "palette-template",
    ariaLabel: "Launcher variables",
    onEscape: actions.cancelTemplate,
  }) as HTMLFormElement;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitTemplateForm(form, variables, actions);
  });

  const body = createLauncherBody("palette-template-body");
  const header = createElement("div", "palette-template-header");
  const variableSummary = variables.join(", ");
  header.append(
    createElement("strong", undefined, `${artifactHandle(prompt)} (${variableSummary})`),
    createElement("span", undefined, prompt.title),
  );
  body.append(header);

  for (const variable of variables) {
    const argument = prompt.template_arguments?.find((entry) => entry.name === variable);
    const error = palette.templateValidationErrors[variable];
    const valueList = createTemplateValueList(palette, variable, argument);
    if (valueList) body.append(valueList);
    const input = createElement("input") as HTMLInputElement;
    input.type = "text";
    input.name = variable;
    input.placeholder = argument?.description || `${variable} · type @context`;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.value = palette.templateValues[variable] ?? argument?.default_value ?? "";
    if (valueList) {
      input.setAttribute("list", valueList.id);
    }
    if (error) {
      input.setAttribute("aria-invalid", "true");
    }
    if (isDynamicEnumArgument(argument)) {
      input.title = "Cmd+R resolves choices from the configured local command.";
    }
    input.addEventListener("input", () => {
      actions.updateTemplateValue(variable, input.value);
    });
    input.addEventListener("keydown", (event) => {
      if (event.isComposing) return;
      if (isCommandOnly(event) && event.key.toLowerCase() === "r") {
        if (!isDynamicEnumArgument(argument)) return;
        event.preventDefault();
        actions.resolveTemplateVariable(variable);
        return;
      }
      if (event.key !== "Enter") return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      const controls = templateInputs(form, variables);
      const currentIndex = controls.indexOf(input);
      const nextInput = controls[currentIndex + 1];
      if (nextInput) {
        nextInput.focus();
        return;
      }
      submitTemplateForm(form, variables, actions);
    });
    const field = createElement(
      "label",
      `palette-template-field${error ? " is-error" : ""}`,
    );
    field.append(createElement("span", undefined, variable), input);
    if (error) {
      field.append(
        createElement("small", "palette-template-dynamic-status is-error", error),
      );
    }
    const dynamicStatus = createTemplateDynamicEnumStatus(palette, variable, argument);
    if (dynamicStatus) field.append(dynamicStatus);
    body.append(field);
  }

  const actionsRow = createElement("div", "palette-template-footer");
  const hasDynamicEnum = variables.some((variable) =>
    isDynamicEnumArgument(prompt.template_arguments?.find((entry) => entry.name === variable)),
  );
  const hint = createElement(
    "span",
    undefined,
    hasDynamicEnum
      ? "Enter next · last Enter loads · Cmd+R choices · Esc back"
      : "Enter next · last Enter loads · @context allowed · Esc back",
  );
  actionsRow.append(hint);
  body.append(actionsRow);
  form.append(body);

  window.setTimeout(() => {
    form.querySelector<HTMLInputElement>("input")?.focus();
  }, 0);
}

function submitTemplateForm(
  form: HTMLFormElement,
  variables: string[],
  actions: PaletteRenderActions,
) {
  const values: Record<string, string> = {};
  for (const variable of variables) {
    const control = form.elements.namedItem(variable) as HTMLInputElement | null;
    values[variable] = control?.value ?? "";
  }
  actions.submitTemplate(values);
}

function templateInputs(form: HTMLFormElement, variables: string[]) {
  return variables
    .map((variable) => form.elements.namedItem(variable) as HTMLInputElement | null)
    .filter((control): control is HTMLInputElement => Boolean(control));
}

function createTemplateValueList(
  palette: PromptPaletteRuntime,
  variable: string,
  argument?: PromptTemplateArgument,
) {
  const contexts = palette.prompts.filter((prompt) => promptArtifactType(prompt) === "context");
  const enumValues = argument?.value_type === "enum"
    ? argument.enum_source === "dynamic"
      ? palette.templateDynamicEnumValues[variable] ?? []
      : argument.enum_values ?? []
    : [];
  if (contexts.length === 0 && enumValues.length === 0) return null;
  const list = createElement("datalist") as HTMLDataListElement;
  list.id = `template-values-${variable}`;
  for (const value of enumValues) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = value;
    option.label = argument?.enum_name || "Enum";
    list.append(option);
  }
  for (const context of contexts) {
    const option = createElement("option") as HTMLOptionElement;
    option.value = artifactHandle(context);
    option.label = context.title;
    list.append(option);
  }
  return list;
}

function createTemplateDynamicEnumStatus(
  palette: PromptPaletteRuntime,
  variable: string,
  argument?: PromptTemplateArgument,
) {
  if (!isDynamicEnumArgument(argument)) return null;
  if (palette.templateDynamicEnumLoading[variable]) {
    return createElement(
      "small",
      "palette-template-dynamic-status",
      "Resolving choices...",
    );
  }
  const error = palette.templateDynamicEnumErrors[variable];
  if (!error && !palette.templateDynamicEnumValues[variable]) {
    return createElement(
      "small",
      "palette-template-dynamic-status",
      "Cmd+R runs the local command for choices. Manual text still works.",
    );
  }
  if (!error) return null;
  return createElement(
    "small",
    "palette-template-dynamic-status is-error",
    `${error} Type any value to continue. Cmd+R retries.`,
  );
}

function isDynamicEnumArgument(argument?: PromptTemplateArgument) {
  return argument?.value_type === "enum" && argument.enum_source === "dynamic";
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
