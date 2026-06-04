import { createElement } from "../../dom";
import {
  artifactHandle,
  artifactTypeLabels,
  promptArtifactType,
} from "../../promptUtils";
import type {
  ProjectArtifactWriteFile,
  ProjectArtifactWriteKind,
  PromptDefinition,
} from "../../types";
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

type ProjectWritePanel = Extract<LauncherArtifactPanel, { mode: "project-write" }>;

export function renderProjectWritePanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: ProjectWritePanel,
) {
  const artifact = palette.prompts.find((prompt) => prompt.id === panel.artifactId) ?? null;
  if (!artifact) {
    actions.closeArtifactPanel();
    return;
  }

  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-project-write",
    ariaLabel: projectWriteTitle(panel.writeKind),
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;

  const header = createElement("div", "palette-artifact-panel-header");
  header.append(
    createElement("div", "palette-artifact-breadcrumb", `Launcher > ${artifactHandle(artifact)} > Project`),
    createElement("h2", undefined, projectWriteTitle(panel.writeKind)),
    createElement(
      "p",
      "palette-artifact-summary",
      projectWriteSummary(artifact, panel.writeKind),
    ),
  );

  const body = createLauncherBody("palette-project-write-body");
  const formView = renderProjectWriteForm(actions, panel, artifact);
  body.append(formView.element);
  let submitShortcut = formView.submit;
  if (panel.error) {
    body.append(projectNotice(panel.error, "warning"));
  }
  if (panel.preview) {
    const previewView = renderProjectWritePreview(actions, panel);
    body.append(previewView.element);
    submitShortcut = previewView.submit;
  }
  if (panel.result) {
    body.append(renderProjectWriteResult(panel));
  }

  shell.append(
    header,
    body,
    createLauncherFooter(projectWriteFooterItems(panel), "palette-artifact-footer"),
  );
  shell.addEventListener("keydown", (event) => {
    if (!isCommandOnly(event) || event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    submitShortcut();
  });
  shell.focus();
}

function renderProjectWriteForm(
  actions: PaletteRenderActions,
  panel: ProjectWritePanel,
  artifact: PromptDefinition,
) {
  const form = createElement("form", "palette-project-write-form") as HTMLFormElement;
  const busy = panel.status === "previewing" || panel.status === "writing";
  const locked = busy || Boolean(panel.preview) || Boolean(panel.result);
  form.append(projectWriteField({
    label: "Target Directory",
    name: "targetDirectory",
    value: panel.targetDirectory,
    placeholder: "/Users/you/Workspace/project",
    required: true,
    disabled: locked,
  }));
  const actionsRow = createElement("div", "palette-project-write-form-actions");
  const previewButton = createElement(
    "button",
    "palette-artifact-button is-primary",
    panel.status === "previewing" ? "Previewing..." : "Preview Files",
  ) as HTMLButtonElement;
  previewButton.type = "submit";
  previewButton.disabled = locked;
  actionsRow.append(previewButton);
  form.append(actionsRow);
  const submit = () => {
    if (locked) return;
    void actions.previewProjectArtifactWrite(
      artifact.id,
      panel.writeKind,
      formValue(form, "targetDirectory"),
      false,
    );
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    submit();
  });
  return { element: form, submit };
}

function projectWriteField(options: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  required: boolean;
  disabled: boolean;
}) {
  const label = createElement("label", "palette-artifact-field");
  label.append(createElement("span", undefined, options.label));
  const input = createElement("input", undefined) as HTMLInputElement;
  input.name = options.name;
  input.value = options.value;
  input.placeholder = options.placeholder;
  input.required = options.required;
  input.disabled = options.disabled;
  input.autocomplete = "off";
  input.spellcheck = false;
  label.append(input);
  return label;
}

function renderProjectWritePreview(
  actions: PaletteRenderActions,
  panel: ProjectWritePanel,
) {
  const preview = panel.preview;
  if (!preview) {
    return { element: createElement("section"), submit: () => undefined };
  }

  const section = createElement("section", "palette-project-write-preview");
  section.append(projectSectionHeader(
    "Files to Write",
    preview.target_directory,
  ));
  section.append(projectWriteFileList(preview.files));
  if (preview.requires_overwrite_confirmation) {
    section.append(projectNotice(
      "A project file already exists. Confirm overwrite before writing.",
      "warning",
    ));
  }

  const form = createElement("form", "palette-project-write-confirm") as HTMLFormElement;
  let overwriteControl: HTMLInputElement | null = null;
  if (preview.requires_overwrite_confirmation) {
    overwriteControl = createElement("input") as HTMLInputElement;
    overwriteControl.type = "checkbox";
    overwriteControl.name = "overwrite";
    overwriteControl.checked = panel.overwrite;
    const label = createElement("label", "palette-artifact-composer-check");
    label.append(
      overwriteControl,
      createElement("span", undefined, "Overwrite existing project file"),
    );
    form.append(label);
  }
  const writeButton = createElement(
    "button",
    "palette-artifact-button is-primary",
    panel.status === "writing" ? "Writing..." : "Write to Project",
  ) as HTMLButtonElement;
  writeButton.type = "submit";
  writeButton.disabled = panel.status === "writing";
  form.append(writeButton);
  const submit = () => {
    if (panel.status === "writing" || panel.status === "result") return;
    const overwrite = overwriteControl?.checked ?? false;
    void actions.writeProjectArtifact(
      panel.artifactId,
      panel.writeKind,
      preview.target_directory,
      overwrite,
    );
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    submit();
  });
  section.append(form);
  return { element: section, submit };
}

function projectWriteFileList(files: ProjectArtifactWriteFile[]) {
  const list = createElement("div", "palette-project-write-file-list");
  for (const file of files) {
    const row = createElement("div", "palette-project-write-file");
    const text = createElement("span", "palette-project-write-file-text");
    text.append(
      createElement("strong", undefined, file.relative_path),
      createElement("small", undefined, file.path),
    );
    const badges = createElement("span", "palette-project-write-badges");
    badges.append(
      createElement("span", `palette-project-write-badge is-${file.action}`, file.action),
      createElement("span", "palette-project-write-badge", file.exists ? "exists" : "new"),
    );
    row.append(text, badges);
    list.append(row);
  }
  return list;
}

function renderProjectWriteResult(panel: ProjectWritePanel) {
  const result = panel.result;
  if (!result) return createElement("section");
  const section = createElement("section", "palette-project-write-result");
  section.append(projectSectionHeader("Project Write Complete", result.target_directory));
  const list = createElement("div", "palette-project-write-result-list");
  for (const path of result.written_files) {
    list.append(createElement("span", undefined, path));
  }
  section.append(list);
  return section;
}

function projectSectionHeader(title: string, detail: string) {
  const header = createElement("div", "palette-project-write-section-header");
  header.append(
    createElement("h3", undefined, title),
    createElement("span", undefined, detail),
  );
  return header;
}

function projectNotice(message: string, tone: "neutral" | "warning") {
  const notice = createElement("div", `palette-project-write-notice is-${tone}`);
  notice.setAttribute("role", tone === "warning" ? "alert" : "status");
  notice.append(createElement("span", undefined, message));
  return notice;
}

function projectWriteFooterItems(panel: ProjectWritePanel) {
  const items = [];
  if (panel.status !== "result") {
    items.push({
      keys: ["Cmd", "Enter"],
      label: panel.preview ? "Write files" : "Preview",
    });
  }
  items.push({ keys: ["Esc"], label: "Back" });
  return items;
}

function projectWriteTitle(kind: ProjectArtifactWriteKind) {
  if (kind === "context") return "Export Context to Project";
  if (kind === "skill") return "Install Skill to Project";
  if (kind === "agents-snippet") return "Create AGENTS.md Snippet";
  return "Export Prompt to Project";
}

function projectWriteSummary(artifact: PromptDefinition, kind: ProjectArtifactWriteKind) {
  if (kind === "agents-snippet") {
    return `Write an explicit AGENTS.md snippet for ${artifactHandle(artifact)}.`;
  }
  return `Write ${artifactTypeLabels[promptArtifactType(artifact)].toLowerCase()} files for ${artifactHandle(artifact)} into the selected project directory.`;
}

function formValue(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  return input?.value ?? "";
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
