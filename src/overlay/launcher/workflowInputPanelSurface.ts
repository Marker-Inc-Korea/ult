import { createElement } from "../../dom";
import type {
  LauncherArtifactPanel,
  PromptPaletteRuntime,
} from "../../paletteRuntime";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  createLauncherBody,
  createLauncherFooter,
  createLauncherShell,
} from "./launcherShell";
import { agentWorkflowInputDefinitionForCommandId } from "./agentWorkflowCommands";

type WorkflowInputPanel = Extract<LauncherArtifactPanel, { mode: "workflow-input" }>;

export function renderWorkflowInputPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: WorkflowInputPanel,
) {
  const definition = agentWorkflowInputDefinitionForCommandId(panel.commandId);
  if (!definition) {
    actions.closeArtifactPanel();
    return;
  }

  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-workflow-input",
    ariaLabel: definition.title,
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;

  const header = createElement("div", "palette-artifact-panel-header");
  header.append(
    createElement("div", "palette-artifact-breadcrumb", "Launcher > Workflow"),
    createElement("h2", undefined, definition.title),
    createElement("p", "palette-artifact-summary", definition.description),
  );

  const body = createLauncherBody("palette-workflow-input-body");
  const form = renderWorkflowInputForm(actions, panel, definition);
  body.append(form.element);
  if (panel.error) {
    body.append(workflowInputNotice(panel.error, "warning"));
  }

  shell.append(
    header,
    body,
    createLauncherFooter([
      { keys: ["Cmd", "Enter"], label: "Continue" },
      { keys: ["Esc"], label: "Back" },
    ], "palette-artifact-footer"),
  );
  shell.addEventListener("keydown", (event) => {
    if (!isCommandOnly(event) || event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    form.submit();
  });
  shell.focus();
}

function renderWorkflowInputForm(
  actions: PaletteRenderActions,
  panel: WorkflowInputPanel,
  definition: NonNullable<ReturnType<typeof agentWorkflowInputDefinitionForCommandId>>,
) {
  const saving = panel.status === "saving";
  const form = createElement("form", "palette-workflow-input-form") as HTMLFormElement;

  const inputField = createElement("label", "palette-artifact-field palette-workflow-input-text");
  inputField.append(createElement("span", undefined, definition.inputTitle));
  const textarea = createElement("textarea") as HTMLTextAreaElement;
  textarea.name = "workflowInputText";
  textarea.value = panel.inputText;
  textarea.placeholder = definition.inputPlaceholder;
  textarea.rows = 9;
  textarea.disabled = saving;
  textarea.spellcheck = false;
  inputField.append(textarea);

  const contextField = createElement("label", "palette-artifact-field");
  contextField.append(createElement("span", undefined, "Context Handles"));
  const contextInput = createElement("input") as HTMLInputElement;
  contextInput.name = "workflowContextHandles";
  contextInput.value = panel.contextHandleText;
  contextInput.placeholder = "@repo-policy @75ac6db";
  contextInput.disabled = saving;
  contextInput.autocomplete = "off";
  contextInput.spellcheck = false;
  contextField.append(contextInput);

  const actionsRow = createElement("div", "palette-workflow-input-actions");
  const submitButton = createElement(
    "button",
    "palette-artifact-button is-primary",
    saving ? "Saving..." : "Continue",
  ) as HTMLButtonElement;
  submitButton.type = "submit";
  submitButton.disabled = saving;
  actionsRow.append(submitButton);

  form.append(
    inputField,
    contextField,
    workflowInputNotice(
      "Input is saved as a 7-day local context only when you continue.",
      "neutral",
    ),
    actionsRow,
  );

  const submit = () => {
    if (saving) return;
    void actions.submitWorkflowInput(
      panel.commandId,
      textarea.value,
      contextInput.value,
    );
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    submit();
  });
  return { element: form, submit };
}

function workflowInputNotice(message: string, tone: "neutral" | "warning") {
  const notice = createElement("div", `palette-workflow-input-notice is-${tone}`);
  notice.setAttribute("role", tone === "warning" ? "alert" : "status");
  notice.append(createElement("span", undefined, message));
  return notice;
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
