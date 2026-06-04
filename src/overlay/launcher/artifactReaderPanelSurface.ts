import { createElement } from "../../dom";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  artifactHandle,
  artifactTypeLabels,
  isDeliverableArtifact,
  promptArtifactType,
  promptScope,
  scopeLabels,
} from "../../promptUtils";
import type { PromptDefinition } from "../../types";
import type { PaletteRenderActions } from "../shared/renderTypes";
import {
  createLauncherBody,
  createLauncherShell,
} from "./launcherShell";
import {
  actionHint,
  handleBackShortcut,
  isCommandOnly,
  sourcePathLabel,
} from "./artifactPanelShared";

export function renderArtifactReaderPanel(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
  artifact: PromptDefinition,
) {
  const shell = createLauncherShell(palette, actions, {
    tagName: "section",
    className: "palette-artifact-panel is-reader",
    ariaLabel: `${artifactHandle(artifact)} reader`,
    onEscape: actions.closeArtifactPanel,
  });
  shell.tabIndex = -1;
  shell.addEventListener("keydown", (event) => {
    if (handleBackShortcut(event, actions.closeArtifactPanel)) return;
    if (isCommandOnly(event) && event.key === ".") {
      event.preventDefault();
      event.stopPropagation();
      actions.openArtifactActions(artifact.id);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      actions.runArtifactAction(
        isDeliverableArtifact(artifact) ? "load" : "reveal",
        artifact.id,
      );
    }
  });

  shell.append(
    artifactReaderChrome(artifact),
    artifactReaderBody(artifact),
    artifactReaderFooter(artifact),
  );
  window.setTimeout(() => shell.focus(), 0);
}

function artifactReaderChrome(artifact: PromptDefinition) {
  const chrome = createElement("header", "palette-artifact-reader-header");
  const breadcrumb = createElement(
    "div",
    "palette-artifact-breadcrumb",
    sourcePathLabel(artifact),
  );
  breadcrumb.title = sourcePathLabel(artifact);
  const title = createElement("div", "palette-artifact-title-row");
  title.append(
    createElement("strong", undefined, artifactHandle(artifact)),
    createElement("span", undefined, artifact.title),
  );
  chrome.append(breadcrumb, title, artifactMetadata(artifact));
  return chrome;
}

function artifactMetadata(artifact: PromptDefinition) {
  const grid = createElement("dl", "palette-artifact-metadata");
  const rows = [
    ["name", artifact.title],
    ["description", artifact.description || "No description"],
    ["kind", artifactTypeLabels[promptArtifactType(artifact)]],
    ["lifecycle", scopeLabels[promptScope(artifact)]],
    ["source path", sourcePathLabel(artifact)],
  ];
  if (promptScope(artifact) === "ephemeral") {
    rows.push(["source", artifact.source ?? "user"]);
    rows.push(["ttl", ttlLabel(artifact)]);
  }
  for (const [label, value] of rows) {
    grid.append(
      createElement("dt", undefined, label),
      createElement("dd", undefined, value),
    );
  }
  return grid;
}

function artifactReaderBody(artifact: PromptDefinition) {
  const body = createLauncherBody("palette-artifact-reader-body");
  body.append(renderMarkdownDocument(artifact.prompt));
  return body;
}

function artifactReaderFooter(artifact: PromptDefinition) {
  const footer = createElement("div", "palette-artifact-footer");
  footer.append(
    actionHint(isDeliverableArtifact(artifact) ? "Load" : "Reveal", ["Enter"]),
    actionHint("Back", ["Esc"]),
    actionHint("Back", ["⌘", "["]),
    actionHint("Actions", ["⌘", "."]),
  );
  return footer;
}

function renderMarkdownDocument(markdown: string) {
  const root = createElement("article", "palette-artifact-markdown");
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      const pre = createElement("pre");
      pre.append(createElement("code", undefined, codeLines.join("\n")));
      root.append(pre);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.min(6, heading[1].length) as 1 | 2 | 3 | 4 | 5 | 6;
      const element = createElement(`h${level}`);
      appendInlineMarkdown(element, heading[2]);
      root.append(element);
      index += 1;
      continue;
    }
    if (isTableStart(lines, index)) {
      const table = createElement("table");
      const header = tableRow(lines[index]);
      const thead = createElement("thead");
      const headRow = createElement("tr");
      for (const cell of header) headRow.append(createElement("th", undefined, cell));
      thead.append(headRow);
      table.append(thead);
      index += 2;
      const tbody = createElement("tbody");
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        const row = createElement("tr");
        for (const cell of tableRow(lines[index])) {
          const td = createElement("td");
          appendInlineMarkdown(td, cell);
          row.append(td);
        }
        tbody.append(row);
        index += 1;
      }
      table.append(tbody);
      root.append(table);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const list = createElement("ol");
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        const item = createElement("li");
        appendInlineMarkdown(item, lines[index].replace(/^\s*\d+\.\s+/, ""));
        list.append(item);
        index += 1;
      }
      root.append(list);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const list = createElement("ul");
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        const item = createElement("li");
        appendInlineMarkdown(item, lines[index].replace(/^\s*[-*]\s+/, ""));
        list.append(item);
        index += 1;
      }
      root.append(list);
      continue;
    }
    const paragraphLines = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim()) {
      if (/^(#{1,6})\s+/.test(lines[index]) || lines[index].startsWith("```")) break;
      if (/^\s*(\d+\.|[-*])\s+/.test(lines[index]) || isTableStart(lines, index)) break;
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    const paragraph = createElement("p");
    appendInlineMarkdown(paragraph, paragraphLines.join(" "));
    root.append(paragraph);
  }
  return root;
}

function appendInlineMarkdown(parent: HTMLElement, text: string) {
  const parts = text.split(/(`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      parent.append(createElement("code", undefined, part.slice(1, -1)));
    } else if (part) {
      parent.append(document.createTextNode(part));
    }
  }
}

function isTableStart(lines: string[], index: number) {
  return /^\s*\|.*\|\s*$/.test(lines[index] ?? "")
    && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[index + 1] ?? "");
}

function tableRow(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|")
    .map((cell) => cell.trim());
}

function ttlLabel(artifact: PromptDefinition) {
  if (!artifact.expires_at) return "No expiry";
  const remaining = artifact.expires_at - Date.now();
  if (remaining <= 0) return "Expired";
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  if (remaining >= dayMs) return `${Math.ceil(remaining / dayMs)}d remaining`;
  return `${Math.max(1, Math.ceil(remaining / hourMs))}h remaining`;
}
