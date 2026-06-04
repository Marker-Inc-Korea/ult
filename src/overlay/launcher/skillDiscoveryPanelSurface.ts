import {
  EXTERNAL_SKILL_DISCOVERY_SOURCES,
  externalSkillDiscoverySummary,
  externalSkillDiscoveryTitle,
} from "../../data/externalSkillDiscovery";
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

type SkillDiscoveryPanel = Extract<LauncherArtifactPanel, { mode: "skill-discovery" }>;

export function renderSkillDiscoveryPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  panel: SkillDiscoveryPanel,
) {
  const title = externalSkillDiscoveryTitle(panel.intent);
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-skill-discovery",
    ariaLabel: title,
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;

  const header = createElement("div", "palette-artifact-panel-header");
  header.append(
    createElement("div", "palette-artifact-breadcrumb", "Launcher > Skill Discovery"),
    createElement("h2", undefined, title),
    createElement(
      "p",
      "palette-artifact-summary",
      externalSkillDiscoverySummary(panel.intent),
    ),
  );

  const body = createLauncherBody("palette-skill-discovery-body");
  body.append(
    discoveryNotice(),
    discoverySourceList(),
    discoveryActions(actions),
  );

  shell.append(
    header,
    body,
    createLauncherFooter([
      { keys: ["Cmd", "Enter"], label: "Open GitHub Import" },
      { keys: ["Esc"], label: "Back" },
    ], "palette-artifact-footer"),
  );
  shell.addEventListener("keydown", (event) => {
    if (!isCommandOnly(event) || event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    actions.openGitHubImport();
  });
  shell.focus();
}

function discoveryNotice() {
  const notice = createElement("div", "palette-github-import-notice");
  notice.append(createElement(
    "span",
    undefined,
    "No project files, prompt bodies, context bodies, terminal output, shell history, clipboard history, or agent output are sent from this gate.",
  ));
  return notice;
}

function discoverySourceList() {
  const list = createElement("section", "palette-skill-discovery-source-list");
  for (const source of EXTERNAL_SKILL_DISCOVERY_SOURCES) {
    const row = createElement("article", "palette-skill-discovery-source");
    const text = createElement("div", "palette-skill-discovery-text");
    text.append(
      createElement("strong", undefined, source.title),
      createElement("small", undefined, source.description),
      discoveryFacts([
        ["Source", source.source],
        ["Package", source.packageIdentity],
        ["Install location", source.installLocation],
        ["Trust / audit", source.trustStatus],
        ["Command", source.exactCommand],
      ]),
    );

    const badges = createElement("span", "palette-starter-pack-meta");
    for (const badge of source.badges) {
      badges.append(createElement("span", "palette-github-import-badge", badge));
    }

    row.append(text, badges);
    list.append(row);
  }
  return list;
}

function discoveryFacts(rows: Array<[string, string]>) {
  const facts = createElement("dl", "palette-skill-discovery-facts");
  for (const [label, value] of rows) {
    facts.append(
      createElement("dt", undefined, label),
      createElement("dd", undefined, value),
    );
  }
  return facts;
}

function discoveryActions(actions: PaletteRenderActions) {
  const row = createElement("div", "palette-github-import-form-actions");
  const button = createElement(
    "button",
    "palette-artifact-button is-primary",
    "Open GitHub Import Preview",
  ) as HTMLButtonElement;
  button.type = "button";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    actions.openGitHubImport();
  });
  row.append(button);
  return row;
}

function isCommandOnly(event: KeyboardEvent) {
  return event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}
