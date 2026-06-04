import { createElement } from "../../dom";
import type {
  GitHubLibraryImportEntry,
  GitHubLibraryImportIssue,
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

type GitHubImportPanel = Extract<LauncherArtifactPanel, { mode: "github-import" }>;

export function renderGitHubImportPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: GitHubImportPanel,
) {
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-github-import",
    ariaLabel: "Import from GitHub",
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;

  const header = createElement("div", "palette-artifact-panel-header");
  header.append(
    createElement("div", "palette-artifact-breadcrumb", "Launcher > GitHub Import"),
    createElement("h2", undefined, "Import from GitHub"),
    createElement(
      "p",
      "palette-artifact-summary",
      "Preview recognized Ult packages before writing local files.",
    ),
  );

  const body = createLauncherBody("palette-github-import-body");
  const formView = renderGitHubImportForm(actions, panel);
  body.append(formView.element);
  let submitShortcut = formView.submit;
  if (panel.error) {
    body.append(importNotice(panel.error, "warning"));
  }
  if (panel.preview) {
    const previewView = renderGitHubImportPreview(actions, panel);
    body.append(previewView.element);
    submitShortcut = previewView.submit;
  }
  if (panel.result) {
    body.append(renderGitHubImportResult(panel));
  }

  shell.append(
    header,
    body,
    createLauncherFooter(githubImportFooterItems(panel), "palette-artifact-footer"),
  );
  shell.addEventListener("keydown", (event) => {
    if (!isCommandOnly(event) || event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    submitShortcut();
  });
  shell.focus();
}

function renderGitHubImportForm(
  actions: PaletteRenderActions,
  panel: GitHubImportPanel,
) {
  const form = createElement("form", "palette-github-import-form") as HTMLFormElement;
  const busy = panel.status === "previewing" || panel.status === "importing";
  const locked = busy || Boolean(panel.preview) || Boolean(panel.result);
  form.append(
    githubImportField({
      label: "Repository URL",
      name: "url",
      value: panel.url,
      placeholder: "https://github.com/owner/repo",
      required: true,
      disabled: locked,
    }),
    githubImportField({
      label: "Branch, Tag, or Commit",
      name: "reference",
      value: panel.reference ?? "",
      placeholder: "default branch",
      required: false,
      disabled: locked,
    }),
  );
  const actionsRow = createElement("div", "palette-github-import-form-actions");
  const previewButton = createElement(
    "button",
    "palette-artifact-button is-primary",
    panel.status === "previewing" ? "Previewing..." : "Preview GitHub Pack",
  ) as HTMLButtonElement;
  previewButton.type = "submit";
  previewButton.disabled = locked;
  actionsRow.append(previewButton);
  form.append(actionsRow);
  const submit = () => {
    if (locked) return;
    void actions.previewGitHubImport(
      formValue(form, "url"),
      emptyToNull(formValue(form, "reference")),
    );
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    submit();
  });
  return { element: form, submit };
}

function githubImportField(options: {
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

function renderGitHubImportPreview(
  actions: PaletteRenderActions,
  panel: GitHubImportPanel,
) {
  const preview = panel.preview;
  if (!preview) {
    return { element: createElement("section"), submit: () => undefined };
  }
  const section = createElement("section", "palette-github-import-preview");
  section.append(
    importSectionHeader(
      `${preview.owner}/${preview.repo}`,
      `ref ${preview.resolved_ref} at ${shortCommit(preview.commit)}`,
    ),
  );

  if (preview.warnings.length > 0) {
    section.append(importIssueList("Warnings", preview.warnings.map((reason) => ({
      path: "GitHub",
      reason,
    }))));
  }

  const form = createElement("form", "palette-github-import-selection") as HTMLFormElement;
  const entries = preview.entries;
  if (entries.length > 0) {
    form.append(importEntryList(entries, panel.selectedPaths ?? entries.map((entry) => entry.source_path)));
    const importButton = createElement(
      "button",
      "palette-artifact-button is-primary",
      panel.status === "importing" ? "Importing..." : "Import Selected Packages",
    ) as HTMLButtonElement;
    importButton.type = "submit";
    importButton.disabled = panel.status === "importing";
    const actionRow = createElement("div", "palette-github-import-form-actions");
    actionRow.append(importButton);
    form.append(actionRow);
  } else {
    form.append(importNotice("No importable packages were found.", "warning"));
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    submit();
  });
  section.append(form);

  if (preview.malformed_packages.length > 0) {
    section.append(importIssueList("Malformed", preview.malformed_packages));
  }
  if (preview.ignored_files.length > 0) {
    section.append(importIssueList("Ignored", preview.ignored_files));
  }
  return { element: section, submit };

  function submit() {
    if (entries.length === 0 || panel.status === "importing" || panel.status === "result") {
      return;
    }
    const selectedPaths = selectedImportPaths(form);
    void actions.importGitHubPackages(panel.url, panel.reference, selectedPaths);
  }
}

function importEntryList(entries: GitHubLibraryImportEntry[], selectedPaths: string[]) {
  const selected = new Set(selectedPaths);
  const list = createElement("div", "palette-github-import-entry-list");
  for (const entry of entries) {
    const label = createElement("label", "palette-github-import-entry");
    const checkbox = createElement("input", undefined) as HTMLInputElement;
    checkbox.type = "checkbox";
    checkbox.name = "selectedPaths";
    checkbox.value = entry.source_path;
    checkbox.checked = selected.has(entry.source_path);

    const text = createElement("span", "palette-github-import-entry-text");
    const handle = importPackageHandle(entry);
    text.append(
      createElement("strong", undefined, entry.title || handle),
      createElement("small", undefined, handle),
      createElement("small", undefined, entry.source_path),
      createElement("small", undefined, entry.target_path),
    );

    const badges = createElement("span", "palette-github-import-entry-badges");
    badges.append(
      createElement("span", `palette-github-import-badge is-${entry.artifact_type}`, entry.artifact_type),
      createElement("span", `palette-github-import-badge is-${entry.action}`, entry.action),
    );

    label.append(checkbox, text, badges);
    list.append(label);
  }
  return list;
}

function importPackageHandle(entry: Pick<GitHubLibraryImportEntry, "artifact_id" | "artifact_type">) {
  if (entry.artifact_type === "context") return `@${entry.artifact_id}`;
  if (entry.artifact_type === "skill") return `$${entry.artifact_id}`;
  if (entry.artifact_type === "command") return `/${entry.artifact_id}`;
  return `#${entry.artifact_id}`;
}

function renderGitHubImportResult(panel: GitHubImportPanel) {
  const result = panel.result;
  if (!result) {
    return document.createDocumentFragment();
  }
  const section = createElement("section", "palette-github-import-result");
  section.append(
    importSectionHeader(
      "Import Complete",
      `${result.imported_count} new, ${result.updated_count} overwritten at ${shortCommit(result.commit)}`,
    ),
  );
  if (result.imported_artifact_ids.length > 0) {
    const list = createElement("div", "palette-github-import-result-list");
    for (const id of result.imported_artifact_ids) {
      list.append(createElement("span", undefined, id));
    }
    section.append(list);
  }
  return section;
}

function importSectionHeader(title: string, detail: string) {
  const header = createElement("div", "palette-github-import-section-header");
  header.append(
    createElement("h3", undefined, title),
    createElement("span", undefined, detail),
  );
  return header;
}

function importIssueList(title: string, issues: GitHubLibraryImportIssue[]) {
  const section = createElement("section", "palette-github-import-issues");
  section.append(createElement("h3", undefined, title));
  for (const issue of issues) {
    const row = createElement("div", "palette-github-import-issue");
    row.append(
      createElement("strong", undefined, issue.path),
      createElement("span", undefined, issue.reason),
    );
    section.append(row);
  }
  return section;
}

function importNotice(message: string, tone: "neutral" | "warning") {
  const notice = createElement("div", `palette-github-import-notice is-${tone}`);
  notice.setAttribute("role", tone === "warning" ? "alert" : "status");
  notice.append(createElement("span", undefined, message));
  return notice;
}

function githubImportFooterItems(panel: GitHubImportPanel) {
  const items = [];
  if (panel.status !== "result") {
    items.push({
      keys: ["Cmd", "Enter"],
      label: panel.preview ? "Import selected" : "Preview",
    });
  }
  items.push({ keys: ["Esc"], label: "Back" });
  return items;
}

function selectedImportPaths(form: HTMLFormElement) {
  return Array.from(form.elements)
    .map((element) => element as HTMLInputElement)
    .filter((element) =>
      element.name === "selectedPaths"
      && element.checked
    )
    .map((element) => element.value);
}

function formValue(form: HTMLFormElement, name: string) {
  const input = form.elements.namedItem(name) as HTMLInputElement | null;
  return input?.value ?? "";
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function shortCommit(commit: string) {
  return commit.slice(0, 12);
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
