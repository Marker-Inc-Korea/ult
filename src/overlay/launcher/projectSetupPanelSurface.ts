import { createElement } from "../../dom";
import {
  artifactHandle,
  artifactTypeLabels,
  promptArtifactType,
} from "../../promptUtils";
import type { ProjectArtifactWriteFile, PromptDefinition } from "../../types";
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
import {
  CUSTOM_PROJECT_SETUP_PRESET_ID,
  normalizeProjectSetupPresetId,
  projectSetupCandidates,
  projectSetupPresets,
  projectSetupPresetSelection,
  type ProjectSetupPreset,
} from "./projectSetupPresets";
import { libraryDependencyHandlesForArtifact } from "./libraryRows";

type ProjectSetupPanel = Extract<LauncherArtifactPanel, { mode: "project-setup" }>;

export function renderProjectSetupPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: ProjectSetupPanel,
) {
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-project-setup",
    ariaLabel: "Project Setup",
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;

  const header = createElement("div", "palette-artifact-panel-header");
  header.append(
    createElement("div", "palette-artifact-breadcrumb", "Launcher > Project Setup"),
    createElement("h2", undefined, "Project Setup"),
    createElement(
      "p",
      "palette-artifact-summary",
      "Choose a setup purpose, preview exact project files, then confirm the write.",
    ),
  );

  const body = createLauncherBody("palette-project-write-body palette-project-setup-body");
  const formView = renderProjectSetupForm(palette, actions, panel);
  body.append(formView.element);
  let submitShortcut = formView.submit;
  if (panel.error) {
    body.append(projectSetupNotice(panel.error, "warning"));
  }
  if (panel.preview) {
    const previewView = renderProjectSetupPreview(palette, actions, panel);
    body.append(previewView.element);
    submitShortcut = previewView.submit;
  }
  if (panel.result) {
    body.append(renderProjectSetupResult(palette, panel));
  }

  shell.append(
    header,
    body,
    createLauncherFooter(projectSetupFooterItems(panel), "palette-artifact-footer"),
  );
  shell.addEventListener("keydown", (event) => {
    if (!isCommandOnly(event) || event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    submitShortcut();
  });
  shell.focus();
}

function renderProjectSetupForm(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: ProjectSetupPanel,
) {
  const candidates = projectSetupCandidates(palette.prompts);
  const selectedIds = new Set(panel.selectedArtifactIds);
  const selectedPresetId = panel.presetId
    ? normalizeProjectSetupPresetId(panel.presetId)
    : CUSTOM_PROJECT_SETUP_PRESET_ID;
  const busy = panel.status === "previewing" || panel.status === "writing";
  const locked = busy || Boolean(panel.preview) || Boolean(panel.result);
  const form = createElement("form", "palette-project-write-form palette-project-setup-form") as HTMLFormElement;
  const targetInput = projectSetupTextInput({
    label: "Target Directory",
    name: "targetDirectory",
    value: panel.targetDirectory,
    placeholder: "/Users/you/Workspace/project",
    disabled: locked,
  });
  form.append(targetInput.label);

  if (locked) {
    form.append(projectSetupSectionHeader(
      "Selection",
      projectSetupSelectionDetail(candidates, panel),
    ));
    form.append(projectSetupSelectionSummary(candidates, panel));
    return { element: form, submit: () => undefined };
  }

  const presetInputs: HTMLInputElement[] = [];
  form.append(projectSetupSectionHeader(
    "Purpose",
    "Choose a starter-pack aligned setup before selecting individual artifacts.",
  ));
  const presetList = createElement("div", "palette-project-setup-preset-list");
  for (const preset of projectSetupPresets()) {
    const input = createElement("input") as HTMLInputElement;
    input.type = "radio";
    input.name = "projectSetupPreset";
    input.value = preset.id;
    input.checked = preset.id === selectedPresetId;
    input.disabled = locked;
    presetInputs.push(input);
    presetList.append(projectSetupPresetChoice(input, preset, candidates, panel));
  }
  form.append(presetList);

  const artifactInputs: HTMLInputElement[] = [];
  const customSection = createElement("section", "palette-project-setup-custom");
  customSection.append(projectSetupSectionHeader(
    "Custom Selection",
    "Advanced path for choosing exact local artifacts manually.",
  ));
  const artifactList = createElement("div", "palette-project-setup-choice-list");
  for (const artifact of candidates) {
    const input = createElement("input") as HTMLInputElement;
    input.type = "checkbox";
    input.name = "setupArtifact";
    input.value = artifact.id;
    input.checked = selectedIds.has(artifact.id);
    input.disabled = locked;
    artifactInputs.push(input);
    artifactList.append(projectSetupChoice(input, artifact, candidates));
  }
  if (candidates.length === 0) {
    artifactList.append(createElement("div", "palette-project-write-notice is-neutral", "No local project-ready artifacts."));
  }
  customSection.append(artifactList);
  form.append(customSection);

  form.append(projectSetupSectionHeader(
    "AGENTS.md",
    "Optionally create one project instruction snippet from a selected local artifact.",
  ));
  const agentsInput = createElement("input") as HTMLInputElement;
  agentsInput.type = "checkbox";
  agentsInput.name = "includeAgentsSnippet";
  agentsInput.checked = panel.includeAgentsSnippet;
  agentsInput.disabled = locked;
  const agentsLabel = createElement("label", "palette-artifact-composer-check palette-project-setup-agents-toggle");
  agentsLabel.append(
    agentsInput,
    createElement("span", undefined, "Create AGENTS.md snippet"),
  );
  form.append(agentsLabel);

  const agentsSourceInputs: HTMLInputElement[] = [];
  const agentsSources = createElement("div", "palette-project-setup-choice-list is-agents-sources");
  for (const artifact of candidates) {
    const input = createElement("input") as HTMLInputElement;
    input.type = "radio";
    input.name = "agentsSnippetArtifactId";
    input.value = artifact.id;
    input.checked = panel.agentsSnippetArtifactId === artifact.id;
    input.disabled = locked;
    agentsSourceInputs.push(input);
    agentsSources.append(projectSetupChoice(input, artifact, candidates));
  }
  form.append(agentsSources);
  syncProjectSetupPresetUi(
    selectedPresetId,
    candidates,
    presetInputs,
    artifactInputs,
    agentsInput,
    agentsSourceInputs,
    customSection,
  );
  for (const input of presetInputs) {
    input.addEventListener("change", () => {
      syncProjectSetupPresetUi(
        selectedProjectSetupPresetId(presetInputs) ?? selectedPresetId,
        candidates,
        presetInputs,
        artifactInputs,
        agentsInput,
        agentsSourceInputs,
        customSection,
      );
    });
  }

  const actionsRow = createElement("div", "palette-project-write-form-actions");
  const previewButton = createElement(
    "button",
    "palette-artifact-button is-primary",
    panel.status === "previewing" ? "Previewing..." : "Preview Setup",
  ) as HTMLButtonElement;
  previewButton.type = "submit";
  previewButton.disabled = locked;
  actionsRow.append(previewButton);
  form.append(actionsRow);

  const submit = () => {
    if (locked) return;
    const presetId = selectedProjectSetupPresetId(presetInputs) ?? selectedPresetId;
    const selection = presetId === CUSTOM_PROJECT_SETUP_PRESET_ID
      ? {
        selectedArtifactIds: artifactInputs.filter((input) => input.checked).map((input) => input.value),
        includeAgentsSnippet: agentsInput.checked,
        agentsSnippetArtifactId: agentsSourceInputs.find((input) => input.checked)?.value ?? null,
      }
      : {
        ...projectSetupPresetSelection(candidates, presetId),
        includeAgentsSnippet: agentsInput.checked,
        agentsSnippetArtifactId: agentsSourceInputs.find((input) => input.checked)?.value ?? null,
      };
    void actions.previewProjectSetup(
      targetInput.input.value,
      selection.selectedArtifactIds,
      selection.includeAgentsSnippet,
      selection.agentsSnippetArtifactId,
      false,
      presetId,
    );
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    submit();
  });
  return { element: form, submit };
}

function renderProjectSetupPreview(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: ProjectSetupPanel,
) {
  const preview = panel.preview;
  if (!preview) {
    return { element: createElement("section"), submit: () => undefined };
  }

  const section = createElement("section", "palette-project-write-preview palette-project-setup-preview");
  section.append(projectSetupSectionHeader("Files to Write", preview.targetDirectory));
  for (const entry of preview.entries) {
    const artifact = palette.prompts.find((prompt) => prompt.id === entry.artifactId) ?? null;
    section.append(projectSetupPreviewEntry(artifact, entry));
  }
  if (preview.requiresOverwriteConfirmation) {
    section.append(projectSetupNotice(
      "One or more project files already exist. Confirm overwrite before writing.",
      "warning",
    ));
  }

  const form = createElement("form", "palette-project-write-confirm palette-project-setup-confirm") as HTMLFormElement;
  let overwriteControl: HTMLInputElement | null = null;
  if (preview.requiresOverwriteConfirmation) {
    overwriteControl = createElement("input") as HTMLInputElement;
    overwriteControl.type = "checkbox";
    overwriteControl.name = "overwrite";
    overwriteControl.checked = panel.overwrite;
    const label = createElement("label", "palette-artifact-composer-check");
    label.append(
      overwriteControl,
      createElement("span", undefined, "Overwrite existing project files"),
    );
    form.append(label);
  }
  const writeButton = createElement(
    "button",
    "palette-artifact-button is-primary",
    panel.status === "writing" ? "Writing..." : "Write Project Setup",
  ) as HTMLButtonElement;
  writeButton.type = "submit";
  writeButton.disabled = panel.status === "writing" || preview.entries.some((entry) => entry.error);
  form.append(writeButton);
  const submit = () => {
    if (panel.status === "writing" || panel.status === "result") return;
    void actions.writeProjectSetup(
      preview.targetDirectory,
      panel.selectedArtifactIds,
      panel.includeAgentsSnippet,
      panel.agentsSnippetArtifactId,
      overwriteControl?.checked ?? false,
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

function projectSetupPreviewEntry(
  artifact: PromptDefinition | null,
  entry: NonNullable<ProjectSetupPanel["preview"]>["entries"][number],
) {
  const section = createElement("section", "palette-project-setup-preview-entry");
  const title = artifact
    ? `${projectSetupWriteKindLabel(entry.writeKind)}: ${artifactHandle(artifact)}`
    : projectSetupWriteKindLabel(entry.writeKind);
  section.append(projectSetupSectionHeader(title, artifact?.title ?? entry.artifactId));
  if (entry.error) {
    section.append(projectSetupNotice(entry.error, "warning"));
  }
  if (entry.preview) {
    section.append(projectSetupFileList(entry.preview.files));
  }
  return section;
}

function projectSetupFileList(files: ProjectArtifactWriteFile[]) {
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

function renderProjectSetupResult(
  palette: PromptPaletteRuntime,
  panel: ProjectSetupPanel,
) {
  const result = panel.result;
  if (!result) return createElement("section");
  const section = createElement("section", "palette-project-write-result palette-project-setup-result");
  section.append(projectSetupSectionHeader(
    result.ok ? "Project Setup Complete" : "Project Setup Partially Complete",
    result.targetDirectory,
  ));
  if (!result.ok) {
    section.append(projectSetupNotice(
      "Some project files could not be written. Review the failed paths below.",
      "warning",
    ));
  }
  const list = createElement("div", "palette-project-write-result-list");
  for (const entry of result.entries) {
    const artifact = palette.prompts.find((prompt) => prompt.id === entry.artifactId) ?? null;
    const label = artifact
      ? `${projectSetupWriteKindLabel(entry.writeKind)} ${artifactHandle(artifact)}`
      : `${projectSetupWriteKindLabel(entry.writeKind)} ${entry.artifactId}`;
    list.append(createElement("span", undefined, label));
    if (entry.error) {
      list.append(createElement("span", undefined, `${label}: ${entry.error}`));
    }
  }
  for (const path of result.writtenFiles) {
    list.append(createElement("span", undefined, path));
  }
  for (const path of result.failedFiles) {
    list.append(createElement("span", undefined, `Failed: ${path}`));
  }
  section.append(list);
  return section;
}

function projectSetupSelectionDetail(
  candidates: PromptDefinition[],
  panel: ProjectSetupPanel,
) {
  const candidateIds = new Set(candidates.map((artifact) => artifact.id));
  const selectedCount = panel.selectedArtifactIds.filter((id) => candidateIds.has(id)).length;
  const agentsCount = panel.includeAgentsSnippet && panel.agentsSnippetArtifactId ? 1 : 0;
  const total = selectedCount + agentsCount;
  const presetTitle = projectSetupPresetTitle(panel.presetId);
  if (total === 1) return `${presetTitle}, 1 project item selected.`;
  return `${presetTitle}, ${total} project items selected.`;
}

function projectSetupSelectionSummary(
  candidates: PromptDefinition[],
  panel: ProjectSetupPanel,
) {
  const byId = new Map(candidates.map((artifact) => [artifact.id, artifact]));
  const summary = createElement("div", "palette-project-setup-summary");
  summary.append(projectSetupSummaryPill(
    projectSetupPresetTitle(panel.presetId),
    "setup purpose",
  ));
  for (const artifactId of panel.selectedArtifactIds) {
    const artifact = byId.get(artifactId);
    if (!artifact) continue;
    summary.append(projectSetupSummaryPill(
      artifactHandle(artifact),
      artifactTypeLabels[promptArtifactType(artifact)],
    ));
  }
  if (panel.includeAgentsSnippet && panel.agentsSnippetArtifactId) {
    const artifact = byId.get(panel.agentsSnippetArtifactId);
    summary.append(projectSetupSummaryPill(
      "AGENTS.md",
      artifact ? `from ${artifactHandle(artifact)}` : panel.agentsSnippetArtifactId,
    ));
  }
  if (summary.children.length === 1) {
    summary.append(createElement("span", undefined, "No project setup items selected."));
  }
  return summary;
}

function projectSetupPresetTitle(presetId: string | null | undefined) {
  const normalizedPresetId = presetId
    ? normalizeProjectSetupPresetId(presetId)
    : CUSTOM_PROJECT_SETUP_PRESET_ID;
  return projectSetupPresets().find((preset) => preset.id === normalizedPresetId)?.title
    ?? "Project Setup";
}

function projectSetupSummaryPill(label: string, detail: string) {
  const pill = createElement("span", "palette-project-setup-summary-pill");
  pill.append(
    createElement("strong", undefined, label),
    createElement("small", undefined, detail),
  );
  return pill;
}

function projectSetupTextInput(options: {
  label: string;
  name: string;
  value: string;
  placeholder: string;
  disabled: boolean;
}) {
  const label = createElement("label", "palette-artifact-field");
  label.append(createElement("span", undefined, options.label));
  const input = createElement("input", undefined) as HTMLInputElement;
  input.name = options.name;
  input.value = options.value;
  input.placeholder = options.placeholder;
  input.required = true;
  input.disabled = options.disabled;
  input.autocomplete = "off";
  input.spellcheck = false;
  label.append(input);
  return { label, input };
}

function projectSetupPresetChoice(
  input: HTMLInputElement,
  preset: ProjectSetupPreset,
  candidates: PromptDefinition[],
  panel: ProjectSetupPanel,
) {
  const selection = projectSetupPresetSelection(
    candidates,
    preset.id,
    preset.id === CUSTOM_PROJECT_SETUP_PRESET_ID
      ? {
        selectedArtifactIds: panel.selectedArtifactIds,
        includeAgentsSnippet: panel.includeAgentsSnippet,
        agentsSnippetArtifactId: panel.agentsSnippetArtifactId,
      }
      : {},
  );
  const label = createElement("label", "palette-project-setup-preset");
  if (input.checked) label.classList.add("is-selected");
  const text = createElement("span", "palette-project-setup-preset-text");
  text.append(
    createElement("strong", undefined, preset.title),
    createElement("small", undefined, preset.description),
    createElement("small", undefined, preset.includes.join(" / ")),
  );
  const meta = createElement("span", "palette-project-setup-preset-meta");
  meta.append(
    createElement(
      "span",
      "palette-project-setup-preset-badge",
      preset.packId ? "pack" : "custom",
    ),
    createElement(
      "span",
      `palette-project-setup-preset-badge ${selection.usesFallback ? "is-muted" : "is-ready"}`,
      projectSetupPresetSelectionLabel(selection),
    ),
  );
  label.append(input, text, meta);
  return label;
}

function syncProjectSetupPresetUi(
  presetId: string,
  candidates: PromptDefinition[],
  presetInputs: HTMLInputElement[],
  artifactInputs: HTMLInputElement[],
  agentsInput: HTMLInputElement,
  agentsSourceInputs: HTMLInputElement[],
  customSection: HTMLElement,
) {
  const normalizedPresetId = normalizeProjectSetupPresetId(presetId);
  for (const input of presetInputs) {
    input.checked = input.value === normalizedPresetId;
    input.closest(".palette-project-setup-preset")?.classList.toggle("is-selected", input.checked);
  }
  const custom = normalizedPresetId === CUSTOM_PROJECT_SETUP_PRESET_ID;
  setElementHidden(customSection, !custom);
  if (custom) return;

  const selection = projectSetupPresetSelection(candidates, normalizedPresetId);
  const selected = new Set(selection.selectedArtifactIds);
  for (const input of artifactInputs) {
    input.checked = selected.has(input.value);
  }
  agentsInput.checked = selection.includeAgentsSnippet;
  for (const input of agentsSourceInputs) {
    input.checked = input.value === selection.agentsSnippetArtifactId;
  }
}

function selectedProjectSetupPresetId(presetInputs: HTMLInputElement[]) {
  return presetInputs.find((input) => input.checked)?.value ?? null;
}

function projectSetupPresetSelectionLabel(selection: {
  totalProjectItems: number;
  usesFallback: boolean;
}) {
  const count = selection.totalProjectItems;
  const label = count === 1 ? "1 item" : `${count} items`;
  return selection.usesFallback ? `${label}, local fallback` : label;
}

function setElementHidden(element: HTMLElement, hidden: boolean) {
  if (hidden) {
    element.setAttribute("hidden", "");
  } else {
    element.removeAttribute("hidden");
  }
}

function projectSetupChoice(
  input: HTMLInputElement,
  artifact: PromptDefinition,
  candidates: PromptDefinition[],
) {
  const label = createElement("label", "palette-project-setup-choice");
  const text = createElement("span", "palette-project-setup-choice-text");
  const dependencies = libraryDependencyHandlesForArtifact(artifact, candidates);
  text.append(
    createElement("strong", undefined, artifactHandle(artifact)),
    createElement(
      "small",
      undefined,
      [
        artifact.title,
        artifactTypeLabels[promptArtifactType(artifact)],
        dependencies.length > 0 ? `uses ${dependencies.join(" ")}` : "",
      ].filter(Boolean).join(" · "),
    ),
  );
  label.append(input, text);
  return label;
}

function projectSetupSectionHeader(title: string, detail: string) {
  const header = createElement("div", "palette-project-write-section-header");
  header.append(
    createElement("h3", undefined, title),
    createElement("span", undefined, detail),
  );
  return header;
}

function projectSetupNotice(message: string, tone: "neutral" | "warning") {
  const notice = createElement("div", `palette-project-write-notice is-${tone}`);
  notice.setAttribute("role", tone === "warning" ? "alert" : "status");
  notice.append(createElement("span", undefined, message));
  return notice;
}

function projectSetupFooterItems(panel: ProjectSetupPanel) {
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

function projectSetupWriteKindLabel(kind: NonNullable<ProjectSetupPanel["preview"]>["entries"][number]["writeKind"]) {
  if (kind === "context") return "Context";
  if (kind === "skill") return "Skill";
  if (kind === "agents-snippet") return "AGENTS.md";
  return "Prompt";
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
