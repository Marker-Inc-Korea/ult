import { beforeEach, describe, expect, test } from "bun:test";

import type { PromptPaletteRuntime } from "../../src/paletteRuntime";
import type { PromptDefinition } from "../../src/types";
import {
  FakeElement,
  actions,
  clipContext,
  context,
  findAllByClass,
  findAllByTag,
  findByClass,
  findByTag,
  installPaletteRendererDom,
  keyEvent,
  prompt,
  renderPromptPalette,
  runtime,
  textOf,
} from "./support/paletteRendererHarness";

beforeEach(() => {
  installPaletteRendererDom();
});

describe("palette renderer search row behavior", () => {
  test("renders search results without palette number labels", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#Prompt";
    palette.prompts = [{
      ...prompt(0),
      description: "Run the first saved prompt.",
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-results")).not.toBeNull();
    const result = findByClass(root, "palette-search-intervention");
    expect(result).not.toBeNull();
    expect(findByClass(root, "palette-search-title")).toBeNull();
    const resultText = findByClass(result!, "palette-search-result-text");
    expect(findByClass(result!, "palette-search-result-icon")).toBeNull();
    expect(resultText?.className).not.toContain("prompt-title");
    expect(resultText?.className).toContain("palette-launcher-row-text");
    expect(rowIcon(result!)).toBe("#");
    expect(rowPrimary(result!)).toBe("#prompt-0");
    expect(rowDescription(result!)).toBe("Run the first saved prompt.");
    expect(findByClass(resultText!, "palette-search-result-name")?.title)
      .toBe("#prompt-0 - Prompt 0");
    expect(result?.dataset.rowKind).toBe("artifact");
    expect(findByClass(root, "prompt-key")).toBeNull();
  });

  test("renders search matches as namespace icon, handle, and description", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#title";
    const longTitle =
      "Use this when the task needs a deliberately long visible title that should stay in the Launcher row metadata column instead of turning into a wrapped management form.";
    palette.prompts = [{
      ...prompt(0),
      id: "extremely-long-prompt-handle-for-launcher-rendering",
      title: longTitle,
      description: "This description should appear after the handle.",
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const resultText = findByClass(root, "palette-search-result-text");
    expect(resultText).not.toBeNull();
    expect(resultText?.children).toHaveLength(2);
    expect(resultText?.className).not.toContain("is-title-only");
    expect(rowIcon(root)).toBe("#");
    expect(rowPrimary(root))
      .toBe("#extremely-long-prompt-handle-for-launcher-rendering");
    expect(findByClass(resultText!, "palette-search-result-name")?.title)
      .toBe(`#extremely-long-prompt-handle-for-launcher-rendering - ${longTitle}`);
    expect(rowDescription(root)).toBe("This description should appear after the handle.");
  });

  test("keeps selection clamped by unified rows instead of command count", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "new #Prompt";
    palette.launcherCommandIndex = 4;
    palette.prompts = [prompt(0), prompt(1), prompt(2), prompt(3), prompt(4)];

    renderPromptPalette(palette, actions());

    const rows = findAllByClass(
      palette.container as unknown as FakeElement,
      "palette-search-intervention",
    );
    expect(rows.length).toBeGreaterThan(5);
    expect(rowPrimary(rows[4])).toBe("#prompt-4");
    expect(rows[4].className).toContain("is-selected");
  });

  test("renders command rows with the same two-column density", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const command = findAllByClass(root, "palette-search-command")
      .find((row) => textOf(row).includes("Review Current Change"));
    const text = findByClass(command!, "palette-search-command-text");
    expect(command).not.toBeNull();
    expect(text).not.toBeNull();
    expect(command?.className).toContain("is-command-row");
    expect(command?.dataset.rowKind).toBe("command");
    expect(text?.children).toHaveLength(2);
    expect(rowIcon(command!)).toBe("/");
    expect(rowPrimary(command!)).toBe("Review Current Change");
    expect(rowDescription(command!)).toBe("Review a user-provided diff or current agent context.");
    expect(findByClass(command!, "palette-search-row-kind")).toBeNull();
  });

  test("renders hash, slash, and at namespace lists from the search input", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#";
    palette.prompts = [prompt(0), context(1)];

    renderPromptPalette(palette, actions());

    let root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-title")).toBeNull();
    let result = findByClass(root, "palette-search-intervention");
    expect(findByClass(result!, "palette-search-result-icon")).toBeNull();
    expect(rowIcon(result!)).toBe("#");
    expect(rowPrimary(result!)).toBe("#prompt-0");

    palette.searchQuery = "/";
    renderPromptPalette(palette, actions());

    root = palette.container as unknown as FakeElement;
    result = findByClass(root, "palette-search-intervention");
    expect(result?.dataset.rowKind).toBe("command");
    expect(findByClass(result!, "palette-search-command-text")).not.toBeNull();
    expect(rowIcon(result!)).toBe("/");

    palette.searchQuery = "@";
    renderPromptPalette(palette, actions());

    root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-title")).toBeNull();
    result = findByClass(root, "palette-search-intervention");
    expect(findByClass(result!, "palette-search-result-icon")).toBeNull();
    expect(rowIcon(result!)).toBe("@");
    expect(rowPrimary(result!)).toBe("@context-1");
  });

  test("renders search composer tokens and removes handles inline", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#prompt-0 @context-1";
    palette.prompts = [prompt(0), context(1)];
    let removedHandle = "";

    renderPromptPalette(palette, actions({
      removeSearchHandle: (handle) => {
        removedHandle = handle;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const tokens = findAllByClass(root, "palette-search-token");
    expect(tokens).toHaveLength(2);
    expect(tokens[0].children[0]?.textContent).toBe("#prompt-0");
    expect(tokens[1].children[0]?.textContent).toBe("@context-1");

    tokens[1].dispatch("click", keyEvent("click"));
    expect(removedHandle).toBe("@context-1");
  });

  test("renders actionable create commands for no-match searches", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "@missing";
    palette.prompts = [];
    let commandId = "";

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        commandId = command.id;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-filter")).toBeNull();
    const command = findByClass(root, "palette-search-command");
    expect(command).not.toBeNull();
    expect(textOf(command!)).toContain("Create @missing");
    command?.dispatch("click", keyEvent("click"));
    expect(commandId).toBe("create-context");
  });

  test("ranks plain command intent ahead of Scratch fallback", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "fix failing tests";
    palette.prompts = [{
      ...prompt(0),
      title: "Fix failing tests",
      description: "Visible description",
    }];
    let commandId = "";

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        commandId = command.id;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-result-text")).not.toBeNull();
    const rows = findAllByClass(root, "palette-search-intervention");
    expect(rows[0]?.dataset.rowKind).toBe("command");
    const command = findByClass(root, "palette-search-command");
    expect(command).not.toBeNull();
    expect(findAllByClass(root, "palette-search-command-text").map(rowPrimary)).toEqual([
      "Fix Failing Tests",
    ]);
    expect(rowDescription(command!)).toBe("Drive a focused failing-test debugging loop.");
    command?.dispatch("click", keyEvent("click"));
    expect(commandId).toBe("workflow-fix-failing-tests");
  });

  test("keeps Scratch first for free-form drafting intent", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "write a concise handoff note for the coding agent.";
    palette.prompts = [];
    let scratchText = "";

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        scratchText = command.scratchText ?? "";
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const commands = findAllByClass(root, "palette-search-command-text").map(rowPrimary);
    expect(commands[0]).toBe('Scratch "write a concise handoff note for the co..."');
    const command = findByClass(root, "palette-search-command");
    command?.dispatch("click", keyEvent("click"));
    expect(scratchText).toBe("write a concise handoff note for the coding agent.");
  });

  test("renders $ search as skill commands instead of prompt delivery rows", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "$diag";
    palette.prompts = [
      {
        ...prompt(0),
        id: "diagnose",
        title: "diagnose",
        artifact_type: "skill",
        description: "Debug failures with a repeatable workflow.",
        prompt: "---\nname: diagnose\ndescription: Debug failures\n---\n\nInspect logs.",
      },
      {
        ...prompt(1),
        id: "diagnose-temp",
        title: "diagnose temp",
        artifact_type: "skill",
        scope: "ephemeral",
        prompt: "---\nname: diagnose-temp\n---\n\nShould not be searchable.",
      },
    ];
    let openedArtifactId = "";

    renderPromptPalette(palette, actions({
      openArtifactReader: (artifactId) => {
        openedArtifactId = artifactId ?? "";
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const row = findByClass(root, "palette-search-intervention");
    expect(row).not.toBeNull();
    expect(row?.dataset.rowKind).toBe("artifact");
    expect(findByClass(row!, "palette-search-result-text")).not.toBeNull();
    expect(rowIcon(row!)).toBe("$");
    expect(rowPrimary(row!)).toBe("$diagnose");
    expect(rowDescription(row!)).toBe("Debug failures with a repeatable workflow.");
    expect(textOf(row!)).not.toContain("$diagnose-temp");

    const search = findByClass(root, "palette-search");
    const open = keyEvent(" ");
    search?.dispatch("keydown", open);
    expect(open.prevented).toBe(true);
    expect(openedArtifactId).toBe("diagnose");
  });

  test("renders $ no-match as a create skill command", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "$new-skill";
    palette.prompts = [];
    let commandId = "";
    let draftId = "";

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        commandId = command.id;
        draftId = command.draftId ?? "";
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const command = findByClass(root, "palette-search-command");
    expect(command).not.toBeNull();
    expect(textOf(command!)).toContain("Create $new-skill");
    command?.dispatch("click", keyEvent("click"));
    expect(commandId).toBe("create-skill");
    expect(draftId).toBe("new-skill");
  });
});

function rowIcon(row: FakeElement) {
  return findByClass(row, "palette-launcher-row-icon")?.textContent ?? "";
}

function rowPrimary(row: FakeElement) {
  return findByClass(row, "palette-search-result-name")?.textContent
    ?? findByClass(row, "palette-search-command-name")?.textContent
    ?? "";
}

function rowDescription(row: FakeElement) {
  return findByClass(row, "palette-search-result-description")?.textContent
    ?? findByClass(row, "palette-search-command-description")?.textContent
    ?? "";
}
