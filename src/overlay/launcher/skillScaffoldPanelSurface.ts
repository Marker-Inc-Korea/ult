import { createElement } from "../../dom";
import type {
  LauncherArtifactPanel,
  PromptPaletteRuntime,
} from "../../paletteRuntime";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  handleBackShortcut,
  isCommandOnly,
} from "./artifactPanelShared";
import {
  slugifyArtifactId,
  titleFromHandle,
  uniqueArtifactId,
} from "./artifactComposerDraft";
import {
  createLauncherBody,
  createLauncherFooter,
  createLauncherShell,
} from "./launcherShell";
import { SKILL_SCAFFOLD_CONTRACT } from "./skillScaffoldContract";

type SkillScaffoldPanel = Extract<LauncherArtifactPanel, { mode: "skill-scaffold" }>;

const DEFAULT_SKILL_BODY = [
  "# Skill Instructions",
  "",
  "Use this skill when the user asks for a repeatable agent workflow in this domain.",
  "",
  "## Workflow",
  "",
  "- Clarify the user's goal and constraints.",
  "- Gather only the explicit local context needed for the task.",
  "- Apply the smallest useful change or recommendation.",
  "- Report validation, risks, and next steps.",
].join("\n");

export function renderSkillScaffoldPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: SkillScaffoldPanel,
) {
  const initialHandle = slugifyArtifactId(panel.initialId ?? "");
  const initialTitle = initialHandle ? titleFromHandle(initialHandle) : "";
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-skill-scaffold",
    ariaLabel: "Create Skill",
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;

  const form = createElement("form", "palette-skill-scaffold-form") as HTMLFormElement;
  const header = createElement("div", "palette-artifact-panel-header");
  header.append(
    createElement("div", "palette-artifact-breadcrumb", "Launcher > New Skill"),
    createElement("h2", undefined, "Create Skill"),
    createElement(
      "p",
      "palette-artifact-summary",
      "Scaffold a local SKILL.md package or inspect an external skill through import preview.",
    ),
  );

  const body = createLauncherBody("palette-skill-scaffold-body");
  const nameField = field("Skill Name", "diagnose-agent-loop");
  const name = nameField.control as HTMLInputElement;
  name.name = "skillName";
  name.value = initialTitle;

  const descriptionField = field("Short Description", "Debug failures with a repeatable local workflow.");
  const description = descriptionField.control as HTMLInputElement;
  description.name = "skillDescription";

  const sourceField = textAreaField("SKILL.md Body Or Template", DEFAULT_SKILL_BODY);
  const source = sourceField.control as HTMLTextAreaElement;
  source.name = "skillBody";
  source.value = DEFAULT_SKILL_BODY;
  source.rows = 10;

  const importField = field("Optional Import Source", "https://github.com/owner/repo or owner/repo");
  const importSource = importField.control as HTMLInputElement;
  importSource.name = "skillImportSource";

  const status = createElement("div", "palette-workflow-input-notice is-neutral");
  status.setAttribute("role", "status");
  status.append(createElement(
    "span",
    undefined,
    "Destination: ~/.ult/personal-library/persistent/skills/<handle>/SKILL.md",
  ));

  const facts = createElement("dl", "palette-skill-discovery-facts");
  for (const [label, value] of [
    ["Package", SKILL_SCAFFOLD_CONTRACT.packagePathPattern],
    ["Handle", "$<handle>"],
    ["Project install", "Project Setup / Install Skill to Project preview"],
    ["Delivery", "Never loaded as prompt text by default"],
  ]) {
    facts.append(createElement("dt", undefined, label), createElement("dd", undefined, value));
  }

  const actionsRow = createElement("div", "palette-github-import-form-actions");
  const template = createElement(
    "button",
    "palette-artifact-button",
    "Use Local Template",
  ) as HTMLButtonElement;
  template.type = "button";
  template.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    source.value = DEFAULT_SKILL_BODY;
    setStatus(status, "Local template restored. No remote content was fetched.");
  });

  const importButton = createElement(
    "button",
    "palette-artifact-button",
    "Open Import Preview",
  ) as HTMLButtonElement;
  importButton.type = "button";
  importButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setStatus(status, importSource.value.trim()
      ? "Import preview opens without running installers or writing files."
      : "Import preview opens behind the GitHub import gate.");
    actions.openGitHubImport();
  });

  const create = createElement(
    "button",
    "palette-artifact-button is-primary",
    "Create Local Skill",
  ) as HTMLButtonElement;
  create.type = "submit";
  actionsRow.append(template, importButton, create);

  body.append(
    scaffoldNotice(),
    nameField.root,
    descriptionField.root,
    sourceField.root,
    importField.root,
    status,
    facts,
    actionsRow,
  );
  form.append(header, body);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const draft = skillDraftFromForm(palette, {
      name: name.value,
      description: description.value,
      body: source.value,
      fallbackId: initialHandle,
    });
    actions.openArtifactComposer("new", "skill", null, draft.id, draft);
  });

  shell.addEventListener("keydown", (event) => {
    if (handleBackShortcut(event, actions.closeArtifactPanel)) return;
    if (!isCommandOnly(event) || event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    form.requestSubmit();
  });

  shell.append(
    form,
    createLauncherFooter([
      { keys: ["Cmd", "Enter"], label: "Create Local Skill" },
      { keys: ["Esc"], label: "Back" },
    ], "palette-artifact-footer"),
  );
  shell.focus();
}

function scaffoldNotice() {
  const notice = createElement("div", "palette-github-import-notice");
  notice.append(createElement(
    "span",
    undefined,
    "Skill creation is source-oriented: it creates a local SKILL.md package, not a deliverable prompt. Project installation stays behind explicit preview and confirmation.",
  ));
  return notice;
}

function field(labelText: string, placeholder: string) {
  const root = createElement("label", "palette-artifact-field");
  const control = createElement("input") as HTMLInputElement;
  control.type = "text";
  control.placeholder = placeholder;
  control.autocomplete = "off";
  control.spellcheck = false;
  root.append(createElement("span", undefined, labelText), control);
  return { root, control };
}

function textAreaField(labelText: string, placeholder: string) {
  const root = createElement("label", "palette-artifact-field palette-workflow-input-text");
  const control = createElement("textarea") as HTMLTextAreaElement;
  control.placeholder = placeholder;
  control.spellcheck = true;
  root.append(createElement("span", undefined, labelText), control);
  return { root, control };
}

function skillDraftFromForm(
  palette: PromptPaletteRuntime,
  values: {
    name: string;
    description: string;
    body: string;
    fallbackId: string;
  },
): PromptDefinition {
  const baseId = slugifyArtifactId(values.name) || values.fallbackId || "new-skill";
  const id = uniqueArtifactId(baseId, palette.prompts, null);
  return {
    id,
    title: values.name.trim() || titleFromHandle(id),
    artifact_type: "skill",
    scope: "persistent",
    pinned: false,
    description: values.description.trim() || "Local agent workflow skill.",
    prompt: values.body.trim() || DEFAULT_SKILL_BODY,
    contexts: [],
    shortcut: null,
    confirm: false,
    template_arguments: [],
    source: "user",
  };
}

function setStatus(status: HTMLElement, message: string) {
  status.textContent = "";
  status.append(createElement("span", undefined, message));
}
