import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  contextArtifactHandle,
  promptArtifactHandle,
} from "../../promptUtils";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  actionHint,
  handleBackShortcut,
  isCommandOnly,
} from "./artifactPanelShared";
import {
  createDraftHandle,
  createDraftToSavePayload,
  initialCreateDraft,
  validateCreateDraft,
  type ArtifactCreateDraft,
} from "./artifactCreateDraft";
import {
  artifactCreateTemplates,
  type ArtifactCreateTemplate,
} from "./artifactCreateTemplates";
import type {
  ArtifactCreateType,
  LauncherArtifactCreatePanel,
} from "./artifactCreateState";
import { setControlValidity } from "./artifactComposerValidation";
import {
  createLauncherBody,
  createLauncherShell,
} from "./launcherShell";

export function renderArtifactCreateCanvasPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  state: LauncherArtifactCreatePanel,
) {
  const initialDraft = initialCreateDraft(palette.prompts, state);
  const copy = createCanvasCopy(state.artifactType);
  const promptOptionsEnabled = state.artifactType === "prompt";
  let isSaving = false;
  let bodyTouched = false;
  let submitted = false;

  const form = createElement(
    "form",
    "palette-artifact-create-canvas",
  ) as HTMLFormElement;
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-create-canvas",
    ariaLabel: copy.ariaLabel,
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;
  shell.addEventListener("keydown", (event) => {
    if (handleBackShortcut(event, actions.closeArtifactPanel)) return;
    if (isCommandOnly(event) && event.key === "Enter") {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  const topbar = createElement("header", "palette-artifact-create-topbar");
  const topActions = createElement("div", "palette-artifact-create-top-actions");
  const info = createElement("button", "palette-artifact-create-icon", "i") as HTMLButtonElement;
  info.type = "button";
  info.setAttribute("aria-label", "Creation info");
  info.title = "Creation info";
  const template = createElement("button", "palette-artifact-secondary-action", "Use template") as HTMLButtonElement;
  template.type = "button";
  template.setAttribute("aria-expanded", "false");
  const close = createElement("button", "palette-artifact-create-icon", "x") as HTMLButtonElement;
  close.type = "button";
  close.setAttribute("aria-label", "Close");
  close.addEventListener("click", (event) => {
    event.preventDefault();
    actions.closeArtifactPanel();
  });
  topActions.append(info);
  if (promptOptionsEnabled) {
    topActions.append(template);
  }
  topActions.append(close);
  topbar.append(createElement("span", "palette-artifact-create-spacer"), topActions);

  const body = createLauncherBody("palette-artifact-create-body");
  const title = createElement("input", "palette-artifact-create-title") as HTMLInputElement;
  title.type = "text";
  title.placeholder = copy.titlePlaceholder;
  title.autocomplete = "off";
  title.spellcheck = false;
  title.value = initialDraft.title;

  const prompt = createElement("textarea", "palette-artifact-create-text") as HTMLTextAreaElement;
  prompt.placeholder = copy.bodyPlaceholder;
  prompt.spellcheck = true;
  prompt.value = initialDraft.body;

  const handlePreview = createElement("strong", "palette-artifact-create-handle");
  const status = createElement("div", "palette-artifact-create-status");
  status.setAttribute("role", "status");
  const bodyMessage = createElement("span", "palette-artifact-composer-message");

  const templateRegion = createElement("div", "palette-artifact-create-template-region");
  const canvas = createElement("div", "palette-artifact-create-inputs");
  canvas.append(title, prompt, bodyMessage);
  body.append(templateRegion, canvas, status);

  info.addEventListener("click", (event) => {
    event.preventDefault();
    status.textContent = copy.infoMessage;
  });

  template.addEventListener("click", (event) => {
    event.preventDefault();
    if (!promptOptionsEnabled) return;
    toggleTemplatePicker();
  });

  const footer = createElement("footer", "palette-artifact-create-footer");
  const options = createElement("div", "palette-artifact-create-options");
  const typeOption = createOptionChip("Type", copy.typeLabel);
  const destination = createOptionChip("Destination", "Personal Library");
  const project = createOptionChip(
    "Project",
    "None",
    "Project writes stay in explicit Project Setup flows.",
  );
  const showInPalette = createOptionToggle(
    "Show in Palette",
    initialDraft.showInPalette,
    "showInPalette",
  );
  const confirmBeforeDelivery = createOptionToggle(
    "Confirm before delivery",
    initialDraft.confirmBeforeDelivery,
    "confirmBeforeDelivery",
  );
  const advanced = createElement("button", "palette-artifact-create-chip", "Advanced Editor") as HTMLButtonElement;
  advanced.type = "button";
  advanced.setAttribute("aria-label", "Open Advanced Editor");
  advanced.addEventListener("click", (event) => {
    event.preventDefault();
    const draft = createDraftToSavePayload(currentDraft(), palette.prompts);
    actions.openArtifactComposer(
      "new",
      state.artifactType,
      null,
      draft.id,
      draft,
    );
  });
  options.append(
    typeOption,
    destination,
    project,
  );
  if (promptOptionsEnabled) {
    options.append(showInPalette.root, confirmBeforeDelivery.root);
  }
  options.append(advanced);

  const controls = createElement("div", "palette-artifact-create-controls");
  const cancel = createElement("button", "palette-artifact-secondary-action", "Cancel") as HTMLButtonElement;
  cancel.type = "button";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    actions.closeArtifactPanel();
  });
  const create = createElement("button", "palette-artifact-primary-action", "Create") as HTMLButtonElement;
  create.type = "submit";
  const createAndLoad = createElement(
    "button",
    "palette-artifact-secondary-action",
    "Create and Load",
  ) as HTMLButtonElement;
  createAndLoad.type = "button";
  createAndLoad.title = "Save locally, then prepare the saved artifact without delivering.";
  createAndLoad.addEventListener("click", (event) => {
    event.preventDefault();
    submitDraft({ loadAfterSave: true });
  });
  controls.append(
    actionHint("Create", ["⌘", "Enter"]),
    cancel,
    createAndLoad,
    create,
  );
  footer.append(options, controls);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitDraft({ loadAfterSave: false });
  });

  const handlebar = createHandleBar(handlePreview, copy.handlebarLabel);
  form.append(body, topbar, handlebar, footer);
  shell.append(form);

  function currentDraft(): ArtifactCreateDraft {
    return {
      ...initialDraft,
      title: title.value,
      body: prompt.value,
      projectSelection: "none",
      showInPalette: promptOptionsEnabled ? showInPalette.input.checked : false,
      confirmBeforeDelivery: promptOptionsEnabled
        ? confirmBeforeDelivery.input.checked
        : false,
    };
  }

  function updateValidation() {
    const draft = currentDraft();
    const handle = createDraftHandle(draft, palette.prompts);
    const handleText = createDraftHandleText(draft.artifactType, handle);
    handlePreview.textContent = handleText;
    const validation = validateCreateDraft(palette, draft);
    const hasErrors = Object.keys(validation).length > 0;
    bodyMessage.textContent = bodyTouched || submitted
      ? validation.prompt ?? ""
      : "";
    status.textContent = statusText(copy, draft.body, handleText, hasErrors, isSaving);
    status.classList.toggle("is-ready", !hasErrors && !isSaving);
    status.classList.toggle("is-warning", hasErrors && (bodyTouched || submitted));
    setControlValidity(prompt, validation.prompt ?? "");
    if (promptOptionsEnabled) {
      showInPalette.update();
      confirmBeforeDelivery.update();
    }
    create.disabled = isSaving || hasErrors;
    create.setAttribute("aria-disabled", create.disabled ? "true" : "false");
    createAndLoad.disabled = isSaving || hasErrors;
    createAndLoad.setAttribute("aria-disabled", createAndLoad.disabled ? "true" : "false");
    return validation;
  }

  function toggleTemplatePicker() {
    if (templateRegion.children.length > 0) {
      closeTemplatePicker();
      return;
    }
    renderTemplatePicker();
  }

  function closeTemplatePicker() {
    templateRegion.replaceChildren();
    template.setAttribute("aria-expanded", "false");
  }

  function renderTemplatePicker() {
    templateRegion.replaceChildren(createTemplatePicker({
      onApply: applyTemplate,
      onCancel: closeTemplatePicker,
    }));
    template.setAttribute("aria-expanded", "true");
  }

  function applyTemplate(createTemplate: ArtifactCreateTemplate) {
    const previousBody = prompt.value.trim();
    let message = "";
    if (!previousBody) {
      if (!title.value.trim()) title.value = createTemplate.title;
      prompt.value = createTemplate.body;
      message = `Filled from ${createTemplate.title} template.`;
    } else {
      prompt.value = `${previousBody}\n\n${createTemplate.body}`;
      message = `Appended ${createTemplate.title} template after existing prompt.`;
    }
    bodyTouched = true;
    closeTemplatePicker();
    updateValidation();
    status.textContent = message;
    window.setTimeout(() => prompt.focus(), 0);
  }

  function submitDraft(options: { loadAfterSave: boolean }) {
    submitted = true;
    const validation = updateValidation();
    if (Object.keys(validation).length > 0) {
      status.textContent = copy.submitErrorMessage;
      return;
    }
    const draft = createDraftToSavePayload(currentDraft(), palette.prompts);
    isSaving = true;
    create.disabled = true;
    createAndLoad.disabled = true;
    status.textContent = options.loadAfterSave
      ? copy.savingAndLoadingMessage
      : copy.savingMessage;
    void actions.saveArtifactDraft(null, draft)
      .then(() => {
        if (options.loadAfterSave) {
          actions.prepareCreatedArtifact(draft);
        }
      })
      .catch((error) => {
        status.textContent = errorMessage(error, copy.saveErrorMessage);
      })
      .finally(() => {
        isSaving = false;
        updateValidation();
      });
  }

  title.addEventListener("input", updateValidation);
  title.addEventListener("change", updateValidation);
  prompt.addEventListener("input", () => {
    bodyTouched = true;
    updateValidation();
  });
  prompt.addEventListener("change", () => {
    bodyTouched = true;
    updateValidation();
  });
  if (promptOptionsEnabled) {
    for (const control of [showInPalette.input, confirmBeforeDelivery.input]) {
      control.addEventListener("input", updateValidation);
      control.addEventListener("change", updateValidation);
    }
  }

  updateValidation();
  window.setTimeout(() => prompt.focus(), 0);
}

function createHandleBar(handlePreview: HTMLElement, label = "Persistent prompt in Personal Library") {
  const bar = createElement("div", "palette-artifact-create-handlebar");
  bar.append(handlePreview, createElement("span", undefined, label));
  return bar;
}

function createOptionChip(label: string, value: string, title?: string) {
  const chip = createElement("span", "palette-artifact-create-chip is-static");
  if (title) chip.title = title;
  chip.append(
    createElement("span", "palette-artifact-create-chip-label", label),
    createElement("strong", "palette-artifact-create-chip-value", value),
  );
  return chip;
}

function createOptionToggle(labelText: string, checked: boolean, name: string) {
  const input = createElement("input") as HTMLInputElement;
  input.type = "checkbox";
  input.checked = checked;
  input.name = name;
  const root = createElement("label", "palette-artifact-create-chip is-toggle");
  const value = createElement("strong", "palette-artifact-create-chip-value");
  const update = () => {
    value.textContent = input.checked ? "On" : "Off";
    root.classList.toggle("is-on", input.checked);
    root.setAttribute("aria-label", `${labelText}: ${input.checked ? "On" : "Off"}`);
  };
  root.append(
    input,
    createElement("span", "palette-artifact-create-chip-label", labelText),
    value,
  );
  update();
  return { root, input, update };
}

function createTemplatePicker(options: {
  onApply: (createTemplate: ArtifactCreateTemplate) => void;
  onCancel: () => void;
}) {
  const picker = createElement("section", "palette-artifact-create-template-picker");
  picker.setAttribute("aria-label", "Prompt templates");
  const header = createElement("div", "palette-artifact-create-template-header");
  header.append(
    createElement("strong", undefined, "Templates"),
    createElement("span", undefined, "Local built-ins only"),
  );
  const cancel = createElement("button", "palette-artifact-secondary-action", "Cancel") as HTMLButtonElement;
  cancel.type = "button";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    options.onCancel();
  });
  header.append(cancel);

  const list = createElement("div", "palette-artifact-create-template-list");
  for (const createTemplate of artifactCreateTemplates()) {
    list.append(createTemplateRow(createTemplate, () => options.onApply(createTemplate)));
  }
  picker.append(header, list);
  return picker;
}

function createTemplateRow(
  createTemplate: ArtifactCreateTemplate,
  onApply: () => void,
) {
  const row = createElement("button", "palette-artifact-create-template-row") as HTMLButtonElement;
  row.type = "button";
  row.addEventListener("click", (event) => {
    event.preventDefault();
    onApply();
  });
  const text = createElement("span", "palette-artifact-create-template-text");
  text.append(
    createElement("strong", undefined, createTemplate.title),
    createElement("span", undefined, createTemplate.description),
    createElement("small", undefined, templatePreview(createTemplate.body)),
  );
  row.append(
    createElement("span", "palette-artifact-create-template-badge", "Local"),
    text,
    createElement("span", "palette-artifact-create-template-action", "Use"),
  );
  return row;
}

function templatePreview(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 112);
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}

type CreateCanvasCopy = {
  ariaLabel: string;
  titlePlaceholder: string;
  bodyPlaceholder: string;
  typeLabel: string;
  handlebarLabel: string;
  infoMessage: string;
  emptyBodyMessage: string;
  fixBodyMessage: string;
  savingMessage: string;
  savingAndLoadingMessage: string;
  submitErrorMessage: string;
  saveErrorMessage: string;
};

function createCanvasCopy(artifactType: ArtifactCreateType): CreateCanvasCopy {
  if (artifactType === "context") {
    return {
      ariaLabel: "Create Context",
      titlePlaceholder: "Context title",
      bodyPlaceholder: "Give the agent reusable context...",
      typeLabel: "Context",
      handlebarLabel: "Persistent context in Personal Library",
      infoMessage: "Creates a local context only; delivery stays explicit.",
      emptyBodyMessage: "Context text required.",
      fixBodyMessage: "Fix context text before creating.",
      savingMessage: "Creating context...",
      savingAndLoadingMessage: "Creating and loading context...",
      submitErrorMessage: "Add context text before creating.",
      saveErrorMessage: "Failed to create context.",
    };
  }
  return {
    ariaLabel: "Create Prompt",
    titlePlaceholder: "Prompt title",
    bodyPlaceholder: "Tell the agent what to do...",
    typeLabel: "Prompt",
    handlebarLabel: "Persistent prompt in Personal Library",
    infoMessage: "Creates a local prompt only; delivery stays explicit.",
    emptyBodyMessage: "Prompt text required.",
    fixBodyMessage: "Fix prompt text before creating.",
    savingMessage: "Creating...",
    savingAndLoadingMessage: "Creating and loading...",
    submitErrorMessage: "Add prompt text before creating.",
    saveErrorMessage: "Failed to create prompt.",
  };
}

function createDraftHandleText(
  artifactType: ArtifactCreateType,
  handle: string,
) {
  return artifactType === "context"
    ? contextArtifactHandle(handle)
    : promptArtifactHandle(handle);
}

function statusText(
  copy: CreateCanvasCopy,
  body: string,
  handleText: string,
  hasErrors: boolean,
  isSaving: boolean,
) {
  if (isSaving) return copy.savingMessage;
  if (!body.trim()) return copy.emptyBodyMessage;
  if (hasErrors) return copy.fixBodyMessage;
  return `Ready to create ${handleText}.`;
}
