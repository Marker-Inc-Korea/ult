import { STARTER_PACKS, starterPackById } from "../../data/starterPacks";
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

type StarterPacksPanel = Extract<LauncherArtifactPanel, { mode: "starter-packs" }>;

export function renderStarterPacksPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: StarterPacksPanel,
) {
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-starter-packs",
    ariaLabel: "Browse Packs",
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;

  const header = createElement("div", "palette-artifact-panel-header");
  header.append(
    createElement("div", "palette-artifact-breadcrumb", "Launcher > Packs"),
    createElement("h2", undefined, "Browse Packs"),
    createElement(
      "p",
      "palette-artifact-summary",
      "Choose a starter pack, then preview GitHub packages before local import.",
    ),
  );

  const body = createLauncherBody("palette-starter-pack-body");
  const form = renderStarterPackForm(actions, panel);
  body.append(form.element);

  shell.append(
    header,
    body,
    createLauncherFooter([
      { keys: ["Cmd", "Enter"], label: "Preview selected" },
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

function renderStarterPackForm(
  actions: PaletteRenderActions,
  panel: StarterPacksPanel,
) {
  const form = createElement("form", "palette-starter-pack-form") as HTMLFormElement;
  const list = createElement("div", "palette-starter-pack-list");
  const selectedPack = starterPackById(panel.selectedPackId);

  for (const pack of STARTER_PACKS) {
    const row = createElement("label", "palette-starter-pack-row");
    const radio = createElement("input") as HTMLInputElement;
    radio.type = "radio";
    radio.name = "starterPackId";
    radio.value = pack.id;
    radio.checked = pack.id === selectedPack.id;

    const text = createElement("span", "palette-starter-pack-text");
    text.append(
      createElement("strong", undefined, pack.title),
      createElement("small", undefined, pack.description),
      createElement("small", undefined, pack.includes.join(" / ")),
    );

    const meta = createElement("span", "palette-starter-pack-meta");
    meta.append(
      createElement("span", "palette-github-import-badge is-prompt", "pack"),
      createElement("span", "palette-github-import-badge is-new", pack.reference ?? "default"),
    );

    row.append(radio, text, meta);
    list.append(row);
  }

  const actionsRow = createElement("div", "palette-github-import-form-actions");
  const button = createElement(
    "button",
    "palette-artifact-button is-primary",
    "Preview Selected Pack",
  ) as HTMLButtonElement;
  button.type = "submit";
  actionsRow.append(button);

  form.append(list, actionsRow);
  const submit = () => {
    const pack = starterPackById(selectedStarterPackId(form) ?? panel.selectedPackId);
    void actions.previewGitHubImport(pack.sourceUrl, pack.reference);
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    submit();
  });
  return { element: form, submit };
}

function selectedStarterPackId(form: HTMLFormElement) {
  return Array.from(form.elements)
    .map((element) => element as HTMLInputElement)
    .find((element) => element.name === "starterPackId" && element.checked)
    ?.value ?? null;
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
