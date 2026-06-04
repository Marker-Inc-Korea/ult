import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  nextPromptTemplateArgumentName,
  syncPromptTemplateArguments,
} from "../../promptArguments";
import {
  artifactHandle,
  artifactTypeLabels,
  promptArtifactType,
} from "../../promptUtils";
import type {
  PromptArtifactType,
  PromptDefinition,
} from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  createLauncherBody,
  createLauncherShell,
} from "./launcherShell";
import {
  actionHint,
  handleBackShortcut,
  isCommandOnly,
} from "./artifactPanelShared";
import {
  argumentInspectorRow,
  createArgumentInspector,
} from "./artifactArgumentInspector";
import { createContextSelector } from "./artifactContextSelector";
import {
  composerBodyValue,
  composerInitialDraft,
  slugifyArtifactId,
  uniqueArtifactId,
} from "./artifactComposerDraft";
import {
  setControlValidity,
  validateComposerDraft,
} from "./artifactComposerValidation";
import { skillMarkdownBody } from "./skillMarkdown";

type ComposerPanelState = Extract<
  PromptPaletteRuntime["launcherArtifactPanel"],
  { mode: "composer" }
>;

export function renderArtifactComposerPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  state: ComposerPanelState,
) {
  const sourceArtifact = state.artifactId
    ? palette.prompts.find((prompt) => prompt.id === state.artifactId) ?? null
    : null;
  if ((state.kind === "edit" || state.kind === "duplicate") && !sourceArtifact) {
    actions.closeArtifactPanel();
    return;
  }

  const artifactType = sourceArtifact
    ? promptArtifactType(sourceArtifact)
    : state.artifactType;
  const initialDraft = composerInitialDraft(
    palette.prompts,
    state,
    sourceArtifact,
    artifactType,
  );
  const originalId = state.kind === "edit" ? sourceArtifact?.id ?? null : null;
  const form = createElement(
    "form",
    `palette-artifact-composer is-${artifactType}`,
  ) as HTMLFormElement;
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-composer",
    ariaLabel: `${composerVerb(state.kind)} ${artifactTypeLabels[artifactType]}`,
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

  let argumentDrafts = syncPromptTemplateArguments(
    initialDraft.prompt,
    initialDraft.template_arguments ?? [],
  );
  let isSaving = false;

  const header = createElement("header", "palette-artifact-actions-header");
  header.append(
    createElement("span", "palette-artifact-breadcrumb", composerBreadcrumb(state, artifactType)),
    createElement("strong", undefined, composerTitle(state.kind, artifactType)),
    createElement("small", undefined, composerSubtitle(sourceArtifact, artifactType)),
  );

  const body = createLauncherBody("palette-artifact-composer-body");
  const title = createElement("input", "palette-artifact-composer-title") as HTMLInputElement;
  title.type = "text";
  title.placeholder = "Title";
  title.autocomplete = "off";
  title.spellcheck = false;
  title.value = initialDraft.title;

  const id = createElement("input", "palette-artifact-composer-handle") as HTMLInputElement;
  id.type = "text";
  id.placeholder = handlePlaceholder(artifactType);
  id.autocomplete = "off";
  id.spellcheck = false;
  id.value = initialDraft.id;

  const description = createElement(
    "input",
    "palette-artifact-composer-description",
  ) as HTMLInputElement;
  description.type = "text";
  description.placeholder = "Description";
  description.autocomplete = "off";
  description.spellcheck = false;
  description.value = initialDraft.description;

  const prompt = createElement("textarea", "palette-artifact-composer-text") as HTMLTextAreaElement;
  prompt.placeholder = composerBodyPlaceholder(artifactType);
  prompt.spellcheck = true;
  prompt.value = composerBodyValue(initialDraft, artifactType);

  const titleMessage = createElement("span", "palette-artifact-composer-message");
  const idMessage = createElement("span", "palette-artifact-composer-message");
  const bodyMessage = createElement("span", "palette-artifact-composer-message");
  const status = createElement("div", "palette-artifact-composer-status");
  status.setAttribute("role", "status");

  let idTouched = state.kind !== "new" || Boolean(initialDraft.id);
  id.addEventListener("input", () => {
    idTouched = true;
  });
  title.addEventListener("input", () => {
    if (idTouched) return;
    id.value = uniqueArtifactId(slugifyArtifactId(title.value), palette.prompts, originalId);
  });

  const titleRow = createComposerField("Title", title, titleMessage);
  const idRow = createComposerField("Handle", id, idMessage);
  const descriptionRow = createComposerField("Description", description);
  const bodyRow = createComposerField("Body", prompt, bodyMessage);
  const fields = createElement("div", "palette-artifact-composer-fields");
  fields.append(titleRow, idRow, descriptionRow, bodyRow);

  const sidebar = createElement("aside", "palette-artifact-composer-sidebar");
  const metadata = createComposerMetadata(artifactType, state.kind);
  sidebar.append(metadata);

  const contexts = createContextSelector(palette, initialDraft, originalId);
  if (artifactType === "prompt") {
    const argumentSection = createArgumentInspector();
    const pinned = createCheckbox("Show in Palette", Boolean(initialDraft.pinned));
    const confirm = createCheckbox("Confirm before delivery", Boolean(initialDraft.confirm));
    const options = createElement("section", "palette-artifact-composer-card");
    options.append(
      createElement("h2", undefined, "Options"),
      pinned.root,
      confirm.root,
    );
    sidebar.append(contexts.root, argumentSection.root, options);

    const renderArguments = () => {
      argumentDrafts = syncPromptTemplateArguments(prompt.value, argumentDrafts);
      argumentSection.list.replaceChildren();
      if (argumentDrafts.length === 0) {
        argumentSection.list.append(
          createElement("p", undefined, "No {{argument}} tokens detected."),
        );
        return;
      }
      for (const argument of argumentDrafts) {
        argumentSection.list.append(argumentInspectorRow(argument));
      }
    };
    argumentSection.add.addEventListener("click", () => {
      const name = nextPromptTemplateArgumentName(prompt.value, argumentDrafts);
      const token = `{{${name}}}`;
      const start = prompt.selectionStart ?? prompt.value.length;
      const end = prompt.selectionEnd ?? start;
      prompt.setRangeText(token, start, end, "end");
      renderArguments();
      updateValidation();
      prompt.focus();
    });
    prompt.addEventListener("input", renderArguments);
    renderArguments();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitDraft({
        pinned: pinned.input.checked,
        confirm: confirm.input.checked,
        contexts: contexts.selectedIds(),
      });
    });
  } else {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submitDraft({
        pinned: false,
        confirm: false,
        contexts: [],
      });
    });
  }

  const layout = createElement("div", "palette-artifact-composer-layout");
  layout.append(fields, sidebar);
  body.append(layout, status);

  const footer = createElement("div", "palette-artifact-footer");
  const save = createElement("button", "palette-artifact-primary-action", "Save");
  save.type = "submit";
  const cancel = createElement("button", "palette-artifact-secondary-action", "Cancel");
  cancel.type = "button";
  cancel.addEventListener("click", (event) => {
    event.preventDefault();
    actions.closeArtifactPanel();
  });
  footer.append(
    actionHint("Save", ["⌘", "Enter"]),
    actionHint("Back", ["Esc"]),
    cancel,
    save,
  );

  form.append(header, body, footer);
  shell.append(form);

  const updateValidation = () => {
    const validation = validateComposerDraft(
      palette,
      originalId,
      artifactType,
      id.value,
      title.value,
      prompt.value,
    );
    idMessage.textContent = validation.id ?? "";
    titleMessage.textContent = validation.title ?? "";
    bodyMessage.textContent = validation.prompt ?? "";
    setControlValidity(id, validation.id ?? "");
    setControlValidity(title, validation.title ?? "");
    setControlValidity(prompt, validation.prompt ?? "");
    save.disabled = isSaving || Object.keys(validation).length > 0;
    return validation;
  };

  function submitDraft(options: {
    pinned: boolean;
    confirm: boolean;
    contexts: string[];
  }) {
    const validation = updateValidation();
    if (Object.keys(validation).length > 0) {
      status.textContent = "Fix highlighted fields.";
      return;
    }
    const draft: PromptDefinition = {
      id: id.value.trim(),
      title: title.value.trim(),
      artifact_type: artifactType,
      scope: "persistent",
      pinned: artifactType === "prompt" ? options.pinned : false,
      description: description.value.trim(),
      prompt: artifactType === "skill" ? skillMarkdownBody(prompt.value) : prompt.value,
      contexts: artifactType === "prompt" ? options.contexts : [],
      shortcut: null,
      confirm: artifactType === "prompt" ? options.confirm : false,
      template_arguments: artifactType === "prompt"
        ? syncPromptTemplateArguments(prompt.value, argumentDrafts)
        : [],
    };
    isSaving = true;
    save.disabled = true;
    status.textContent = "Saving...";
    void actions.saveArtifactDraft(originalId, draft)
      .catch((error) => {
        status.textContent = errorMessage(error, "Failed to save artifact.");
      })
      .finally(() => {
        isSaving = false;
        updateValidation();
      });
  }

  for (const control of [title, id, description, prompt, ...contexts.controls]) {
    control.addEventListener("input", updateValidation);
    control.addEventListener("change", updateValidation);
  }

  updateValidation();
  window.setTimeout(() => title.focus(), 0);
}

function createComposerField(
  labelText: string,
  control: HTMLElement,
  message?: HTMLElement,
) {
  const label = createElement("label", "palette-artifact-composer-field");
  label.append(createElement("span", undefined, labelText), control);
  if (message) label.append(message);
  return label;
}

function createComposerMetadata(
  artifactType: PromptArtifactType,
  kind: "new" | "edit" | "duplicate",
) {
  const section = createElement("section", "palette-artifact-composer-card");
  const rows = [
    ["kind", artifactTypeLabels[artifactType]],
    ["lifecycle", "Persistent"],
    ["operation", composerVerb(kind)],
  ];
  section.append(createElement("h2", undefined, "Metadata"));
  const list = createElement("dl", "palette-artifact-composer-meta");
  for (const [label, value] of rows) {
    list.append(
      createElement("dt", undefined, label),
      createElement("dd", undefined, value),
    );
  }
  section.append(list);
  return section;
}

function createCheckbox(labelText: string, checked: boolean) {
  const input = createElement("input") as HTMLInputElement;
  input.type = "checkbox";
  input.checked = checked;
  const root = createElement("label", "palette-artifact-composer-check");
  root.append(input, createElement("span", undefined, labelText));
  return { root, input };
}

function composerVerb(kind: "new" | "edit" | "duplicate") {
  if (kind === "edit") return "Edit";
  if (kind === "duplicate") return "Duplicate";
  return "Create";
}

function composerTitle(kind: "new" | "edit" | "duplicate", artifactType: PromptArtifactType) {
  return `${composerVerb(kind)} ${artifactTypeLabels[artifactType]}`;
}

function composerSubtitle(artifact: PromptDefinition | null, artifactType: PromptArtifactType) {
  if (artifact) return `${artifactHandle(artifact)} ${artifact.title}`;
  return `New persistent ${artifactTypeLabels[artifactType].toLowerCase()} package`;
}

function composerBreadcrumb(
  state: ComposerPanelState,
  artifactType: PromptArtifactType,
) {
  const file = artifactType === "skill" ? "SKILL.md" : artifactType === "context" ? "CONTEXT.md" : "PROMPT.md";
  const directory = artifactType === "skill" ? "skills" : artifactType === "context" ? "contexts" : "prompts";
  return `personal-library > persistent > ${directory} > ${state.initialId || state.artifactId || "<handle>"} > ${file}`;
}

function handlePlaceholder(artifactType: PromptArtifactType) {
  if (artifactType === "context") return "repo-policy";
  if (artifactType === "skill") return "diagnose";
  return "review-reset";
}

function composerBodyPlaceholder(artifactType: PromptArtifactType) {
  if (artifactType === "context") return "Write reusable context.";
  if (artifactType === "skill") return "Write SKILL.md instructions.";
  return "Write the prompt body. Use {{argument_1}} for fill-in values.";
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}
