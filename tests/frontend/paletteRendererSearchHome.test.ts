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

describe("palette renderer search home behavior", () => {
  test("renders empty search as a task-oriented Launcher home with lane representatives", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [
      prompt(0),
      context(1),
      { ...prompt(2), title: "Often Used", pinned: false },
    ];
    const base = 1_700_000_000_000;
    palette.usageHistory = [
      {
        timestamp_ms: base + 90_000,
        prompt_id: "prompt-0",
        delivery_mode: "send",
        result: "failed",
      },
      {
        timestamp_ms: base + 10_000,
        prompt_id: "prompt-2",
        delivery_mode: "send",
        result: "delivered",
      },
      {
        timestamp_ms: base + 20_000,
        prompt_id: "prompt-2",
        delivery_mode: "send",
        result: "delivered",
      },
      {
        timestamp_ms: base + 25_000,
        prompt_id: "prompt-2",
        delivery_mode: "send",
        result: "delivered",
      },
      {
        timestamp_ms: base + 70_000,
        prompt_id: "context-1",
        delivery_mode: "copy",
        result: "copied",
      },
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")?.className).not.toContain("is-watermarked");
    expect(findByClass(root, "palette-search")).not.toBeNull();
    expect(findByClass(root, "palette-search-body")).not.toBeNull();
    expect(findByClass(root, "palette-search-filter")).toBeNull();
    const results = findByClass(root, "palette-search-results");
    expect(results).not.toBeNull();
    expect(results?.className).toContain("is-home-results");
    expect(findAllByClass(root, "palette-search-section").map(textOf)).toEqual([
      "Continue",
      "Library",
      "Create",
      "Agent Workflows",
      "Project",
      "Recovery / System",
    ]);
    expect(searchPrimaryTexts(root)).toEqual([
      "#prompt-2",
      "Browse Library",
      "Scratch",
      "New Prompt",
      "Review Current Change",
      "Project Setup",
      "Preferences",
    ]);
    expect(searchDescriptionTexts(root)).toEqual([
      "Often Used",
      "2 prompts / 1 context / 0 skills / 0 cmds",
      "Temporary prompt.",
      "Create a prompt from Launcher.",
      "Review a user-provided diff or current agent context.",
      "Choose a starter-pack preset and preview project files.",
      "Settings.",
    ]);
    expect(findAllByClass(root, "palette-search-row-kind")).toEqual([]);
    expect(findByClass(root, "palette-search-actionbar")).toBeNull();
    const selectedRowActions = findByClass(
      findAllByClass(root, "palette-search-intervention")[0],
      "palette-search-row-actions",
    );
    const homeRows = findAllByClass(root, "palette-search-intervention");
    expect(homeRows.every((row) => row.className.includes("is-home-row"))).toBe(true);
    expect(textOf(selectedRowActions!)).toBe("↵");
    expect(findAllByClass(selectedRowActions!, "palette-search-row-action")).toHaveLength(1);
    expect(findByClass(root, "prompt-key")).toBeNull();
  });

  test("surfaces a compact default Launcher home without a long command list", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findAllByClass(root, "palette-search-command-text").map(rowPrimary)).toEqual([
      "Browse Library",
      "Scratch",
      "New Prompt",
      "Review Current Change",
      "Project Setup",
      "Preferences",
    ]);
    expect(findAllByClass(root, "palette-search-command-text").map(rowDescription)[0])
      .toBe("0 prompts / 0 contexts / 0 skills / 0 cmds");
    expect(findAllByClass(root, "palette-search-intervention")).toHaveLength(6);
  });

  test("makes installed skills reachable from home through the Library lane", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [skill("diagnose", "Diagnose")];
    const opened: string[] = [];

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        opened.push(command.id);
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(searchPrimaryTexts(root)).toContain("Browse Library");
    expect(searchDescriptionTexts(root)).toContain("0 prompts / 0 contexts / 1 skill / 0 cmds");
    const browseLibraryRow = findAllByClass(root, "palette-search-intervention")
      .find((row) => textOf(row).includes("Browse Library"));
    expect(browseLibraryRow).toBeDefined();
    browseLibraryRow!.dispatch("click", keyEvent("click"));

    expect(opened).toEqual(["browse-library"]);
  });

  test("surfaces local user-defined Launcher commands in home and typed search", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [];
    palette.userCommands = [{
      id: "review-repo",
      title: "Review Repo",
      description: "Review the current change with repo policy.",
      prompt_id: "review-change",
      contexts: ["repo-policy"],
      variable_values: { branch: "main" },
      keywords: ["diff", "review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findAllByClass(root, "palette-search-command-text").map(rowPrimary).slice(0, 4))
      .toEqual([
        "Browse Library",
        "Review Repo",
        "Scratch",
        "New Prompt",
      ]);
    expect(findAllByClass(root, "palette-search-command-text").map(rowDescription).slice(0, 2))
      .toEqual([
        "0 prompts / 0 contexts / 0 skills / 1 cmd",
        "Review the current change with repo policy.",
      ]);

    palette.searchQuery = "rr";
    renderPromptPalette(palette, actions());
    expect(findAllByClass(root, "palette-search-command-text").map(rowPrimary))
      .toContain("Review Repo");
  });

  test("surfaces fresh ephemeral contexts before unused pinned prompts on Launcher home", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [
      prompt(0),
      {
        ...clipContext(1, "Fresh clipboard context"),
        created_at: Date.now() - 1_000,
        expires_at: Date.now() + 6 * 24 * 60 * 60 * 1000,
      },
      prompt(2),
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(searchPrimaryTexts(root).slice(0, 3))
      .toEqual([
        "Open Clipboard Stack",
        "Browse Library",
        "Scratch",
      ]);
    expect(searchPrimaryTexts(root)).not.toContain("Prompt 0");
  });

  test("keeps management commands reachable through typed command search", () => {
    const cases = [
      ["new prompt", "New Prompt"],
      ["새 프롬프트", "New Prompt"],
      ["new context", "New Context"],
      ["browse prompts", "Browse Prompts"],
      ["prompt library", "Browse Prompts"],
      ["context library", "Browse Contexts"],
      ["installed skills", "Browse Skills"],
      ["command library", "Browse Commands"],
      ["agent control", "Browse Packs"],
      ["starter packs", "Browse Packs"],
      ["discover skills", "Discover Skills"],
      ["skills.sh", "Discover Skills"],
      ["find agent skills", "Find Agent Skills"],
      ["github", "Import from GitHub"],
      ["gh", "Import from GitHub"],
      ["pack", "Import from GitHub"],
      ["가져오기", "Import from GitHub"],
      ["project setup", "Project Setup"],
      ["프로젝트 설치", "Project Setup"],
      ["review current", "Review Current Change"],
      ["fix failing tests @context-1", "Fix Failing Tests"],
      ["pr body", "Write PR Description"],
      ["stuck agent", "Rescue Stuck Agent"],
      ["thread summary", "Summarize Thread"],
      ["turn clipboard", "Turn Clipboard into Context"],
      ["last prompt", "Run Last Prompt"],
      ["recent contexts", "Open Clipboard Stack"],
      ["clear expired", "Clear Expired Contexts"],
      ["failed delivery", "Reveal Last Failed Delivery"],
      ["export prompt", "Export Prompt to Project..."],
      ["install skill", "Install Skill to Project..."],
      ["install agent skill", "Install Agent Skill..."],
      ["review installed skills", "Review Installed Skills"],
      ["agents", "Create AGENTS.md Snippet..."],
      ["library", "Browse Library"],
      ["preferences", "Preferences"],
    ] as const;

    for (const [query, expected] of cases) {
      const palette = runtime();
      palette.overlayMode = "launcher";
      palette.launcherMode = "search";
      palette.surfaceMode = "search";
      palette.searchQuery = query;
      palette.prompts = [];

      renderPromptPalette(palette, actions());

      const root = palette.container as unknown as FakeElement;
      const commands = findAllByClass(root, "palette-search-command-text").map(rowPrimary);
      expect(commands).toContain(expected);
    }
  });
});

function searchPrimaryTexts(root: FakeElement) {
  return findAllByClass(root, "palette-search-intervention").map((row) => {
    return rowPrimary(row);
  });
}

function searchDescriptionTexts(root: FakeElement) {
  return findAllByClass(root, "palette-search-intervention").map((row) => {
    return rowDescription(row);
  });
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

function skill(id: string, title: string): PromptDefinition {
  return {
    id,
    title,
    artifact_type: "skill",
    pinned: false,
    description: "Read this local skill package.",
    prompt: "---\nname = \"diagnose\"\n---\n\nInspect logs.",
    registry_source: "local-file",
    registry_source_path: "/Users/taeha/.ult/personal-library/persistent/skills/diagnose/SKILL.md",
    registry_editable: true,
  };
}
