import { createElement } from "../../dom";
import type { MetaPromptingSettings } from "../../types";
import { createSettingsRow, createSettingsSection } from "../settingsLayout";
import { createInlineActions } from "./shared";

const DEFAULT_META_PROMPTING_PROVIDER = "openai";
const DEFAULT_META_PROMPTING_MODEL = "gpt-5-mini";
const DEFAULT_META_PROMPTING_TEMPLATE = "Refine this rough coding-agent prompt for review and delivery. If it is vague, social, filler, or missing a concrete task, turn it into a concise instruction for the coding agent to pause and ask for the missing task, file path, command, or constraint instead of inventing work.\n\nRough prompt:\n{input}";

export type MetaPromptingFormValues = {
  enabled: boolean;
  provider: string;
  apiKey: string;
  model: string;
  template: string;
};

export function renderMetaPromptingSection(
  settings: MetaPromptingSettings | null,
  onUpdate: (values: MetaPromptingFormValues) => Promise<void>,
  onTestConnection: (values: MetaPromptingFormValues) => Promise<string>,
) {
  const values = metaPromptingFormValues(settings);
  const enabled = createElement("input") as HTMLInputElement;
  enabled.type = "checkbox";
  enabled.checked = values.enabled;

  const provider = createElement("select") as HTMLSelectElement;
  provider.append(createOption(DEFAULT_META_PROMPTING_PROVIDER, "OpenAI"));
  if (values.provider !== DEFAULT_META_PROMPTING_PROVIDER) {
    provider.append(createOption(values.provider, values.provider || "Select provider"));
  }
  provider.value = values.provider;

  const apiKey = createElement("input") as HTMLInputElement;
  apiKey.type = "password";
  apiKey.placeholder = "OpenAI API key";
  apiKey.autocomplete = "off";
  apiKey.spellcheck = false;
  apiKey.value = values.apiKey;

  const model = createElement("input") as HTMLInputElement;
  model.type = "text";
  model.placeholder = DEFAULT_META_PROMPTING_MODEL;
  model.spellcheck = false;
  model.value = values.model;

  const template = createElement("textarea") as HTMLTextAreaElement;
  template.spellcheck = false;
  template.value = values.template;

  const save = createElement("button", undefined, "Save");
  save.type = "button";
  save.addEventListener("click", () => {
    void onUpdate({
      enabled: enabled.checked,
      provider: provider.value,
      apiKey: apiKey.value,
      model: model.value,
      template: template.value,
    });
  });
  const saveActions = createInlineActions();
  saveActions.append(save);

  const testStatus = createElement("span", "settings-inline-note");
  const testConnection = createElement("button", undefined, "Test");
  testConnection.type = "button";
  testConnection.addEventListener("click", () => {
    testConnection.setAttribute("disabled", "true");
    testStatus.textContent = "Testing OpenAI...";
    void onTestConnection({
      enabled: enabled.checked,
      provider: provider.value,
      apiKey: apiKey.value,
      model: model.value,
      template: template.value,
    })
      .then((message) => {
        testStatus.textContent = message;
      })
      .catch((error) => {
        testStatus.textContent = errorMessage(error, "Connection test failed");
      })
      .finally(() => {
        testConnection.removeAttribute("disabled");
      });
  });
  const testActions = createInlineActions();
  testActions.append(testConnection, testStatus);

  return [
    createSettingsSection("Meta Prompting", [
      createSettingsRow("Enable", "Beta. Refines Launcher Scratch drafts before delivery.", enabled),
      createSettingsRow("Provider", "OpenAI is supported in this beta.", provider),
      createSettingsRow("API Key", "Stored locally in Ult settings.", apiKey),
      createSettingsRow("Model", "", model),
      createSettingsRow("Template", "Must include {input}.", template),
      createSettingsRow("Connection", "Uses the current fields without saving.", testActions),
      createSettingsRow("Save", "", saveActions),
    ]),
  ];
}


export function metaPromptingFormValues(
  settings: MetaPromptingSettings | null,
): MetaPromptingFormValues {
  return {
    enabled: settings?.enabled ?? false,
    provider: settings?.provider ?? DEFAULT_META_PROMPTING_PROVIDER,
    apiKey: settings?.api_key ?? "",
    model: settings?.model ?? DEFAULT_META_PROMPTING_MODEL,
    template: settings?.template ?? DEFAULT_META_PROMPTING_TEMPLATE,
  };
}


function createOption(value: string, label: string) {
  const option = createElement("option", undefined, label) as HTMLOptionElement;
  option.value = value;
  return option;
}

function errorMessage(error: unknown, defaultMessage: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return defaultMessage;
}
