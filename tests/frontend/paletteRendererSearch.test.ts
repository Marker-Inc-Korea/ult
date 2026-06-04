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

describe("palette renderer search shell behavior", () => {
  test("renders no stale palette chrome while idle", () => {
    const palette = runtime();
    palette.active = false;
    palette.overlayMode = "palette";
    palette.surfaceMode = "idle";

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-panel")).toBeNull();
    expect(findByClass(root, "palette-search-panel")).toBeNull();
    expect(findByClass(root, "palette-scratch")).toBeNull();
  });

  test("renders passive clip feedback as a compact cursor chip", () => {
    const palette = runtime();
    palette.active = false;
    palette.surfaceMode = "clip-feedback";
    palette.clipFeedback = {
      handle: "@75ac6db",
      preview: "Copied text",
      count: 1,
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const feedback = findByClass(root, "palette-clip-feedback");
    expect(feedback).not.toBeNull();
    expect(textOf(feedback!)).toBe("@1");
    expect(findByClass(root, "palette-panel")).toBeNull();
    expect(findByClass(root, "palette-search-panel")).toBeNull();
  });

  test("renders frequent palette with canonical handles only", () => {
    const palette = runtime();
    palette.overlayMode = "palette";
    palette.surfaceMode = "palette";
    palette.prompts = [prompt(0), prompt(1), prompt(2)];
    palette.selectedIndex = 1;

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const entries = findAllByClass(root, "palette-picker-entry");
    expect(findByClass(root, "palette-search")).toBeNull();
    expect(findByClass(root, "panel-rail")).not.toBeNull();
    expect(entries).toHaveLength(3);
    expect(entries[0].className).toContain("is-previous");
    expect(entries[0].className).toContain("is-ghost");
    expect(textOf(entries[0])).toBe("#prompt-0");
    expect(findByClass(entries[0], "palette-picker-title")).toBeNull();
    expect(findByClass(entries[0], "palette-picker-ghost-handle")?.textContent).toBe("#prompt-0");
    expect(entries[1].className).toContain("is-current");
    expect(findByClass(entries[1], "palette-picker-title")).toBeNull();
    expect(findByClass(entries[1], "palette-picker-handle")?.textContent).toBe("#prompt-1");
    expect(textOf(entries[1])).toBe("#prompt-1");
    expect(entries[2].className).toContain("is-next");
    expect(entries[2].className).toContain("is-ghost");
    expect(textOf(entries[2])).toBe("#prompt-2");
    expect(findByClass(entries[2], "palette-picker-title")).toBeNull();
    expect(findAllByClass(root, "palette-prompt-control")).toHaveLength(1);
    expect(findAllByClass(root, "palette-picker-title")).toHaveLength(0);
    expect(findAllByClass(root, "palette-picker-handle")).toHaveLength(1);
    expect(findAllByClass(root, "palette-picker-ghost-handle")).toHaveLength(2);
    expect(findByClass(root, "template-marker")).toBeNull();
    expect(findByClass(root, "prompt-key")).toBeNull();
    expect(findByClass(root, "primary-button")).toBeNull();
    expect(findByClass(root, "palette-search")).toBeNull();
  });

  test("keeps quick Palette limited to pinned persistent prompts", () => {
    const palette = runtime();
    palette.overlayMode = "palette";
    palette.surfaceMode = "palette";
    palette.prompts = [
      { ...prompt(0), title: "Pinned Prompt", pinned: true },
      { ...prompt(1), title: "Unpinned Prompt", pinned: false },
      { ...prompt(2), title: "Ephemeral Prompt", scope: "ephemeral", pinned: true },
      { ...context(3), title: "Pinned Context", pinned: true },
      {
        ...prompt(4),
        title: "Pinned Skill",
        artifact_type: "skill",
        pinned: true,
      },
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const entries = findAllByClass(root, "palette-picker-entry");
    expect(entries).toHaveLength(1);
    expect(findByClass(entries[0], "palette-picker-title")).toBeNull();
    expect(findByClass(entries[0], "palette-picker-handle")?.textContent).toBe("#prompt-0");
    expect(textOf(entries[0])).toBe("#prompt-0");
    expect(textOf(root)).not.toContain("Unpinned Prompt");
    expect(textOf(root)).not.toContain("Ephemeral Prompt");
    expect(textOf(root)).not.toContain("Pinned Context");
    expect(textOf(root)).not.toContain("Pinned Skill");
  });

  test("renders loaded state as the same fixed handle card as Palette", () => {
    const palette = runtime();
    palette.overlayMode = "palette";
    palette.surfaceMode = "loaded";
    palette.preparedExecution = {
      promptId: "prompt-0",
      promptKind: "bundled",
      label: "Prompt 0",
      artifactHandle: "#prompt-0",
      deliveryMode: "send",
      text: "Run prompt 0",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const loaded = findByClass(root, "palette-loaded");
    expect(loaded).not.toBeNull();
    expect(loaded?.className).toContain("is-delivery-send");
    expect(findByClass(root, "palette-execution-modes")).toBeNull();
    expect(findByClass(root, "primary-button")).toBeNull();
    expect(findAllByTag(root, "button")).toHaveLength(0);
    expect(findByClass(root, "palette-loaded-label")?.textContent).toBe("#prompt-0");
    expect(findByClass(root, "palette-loaded-title")).toBeNull();
    expect(textOf(findByClass(root, "palette-loaded-target-state")!)).toBe("Click target app");
    expect(findByClass(root, "palette-loaded-mode-carousel")).toBeNull();
    const modes = findAllByClass(root, "palette-loaded-mode");
    expect(modes.map(textOf)).toEqual(["Paste + Enter"]);
    expect(findByClass(root, "palette-loaded-mode-hint")).toBeNull();
    expect(loaded?.attributes.get("aria-label")).toContain("Loaded #prompt-0");
    expect(loaded?.attributes.get("aria-label")).toContain("Click the target app to apply");
    expect(textOf(root)).not.toContain("Prompt 0");
    expect(textOf(root)).not.toContain("Run prompt 0");
    expect(textOf(root).toLowerCase()).not.toContain("execution ready");
  });

  test("renders explicit Copy mode as copy wording without delivery picker controls", () => {
    const palette = runtime();
    palette.overlayMode = "palette";
    palette.surfaceMode = "loaded";
    palette.preparedExecution = {
      promptId: "prompt-0",
      promptKind: "bundled",
      label: "Prompt 0",
      artifactHandle: "#prompt-0",
      deliveryMode: "copy",
      text: "Run prompt 0",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(textOf(findByClass(root, "palette-loaded-target-state")!)).toBe("Click to copy");
    expect(findByClass(root, "palette-loaded-mode-label")?.textContent).toBe("Copy");
    expect(findByClass(root, "palette-loaded-mode-carousel")).toBeNull();
    expect(findAllByTag(root, "button")).toHaveLength(0);
    expect(textOf(root)).not.toContain("Run prompt 0");
  });

  test("renders loaded labels for contexts, unresolved variables, and context summaries", () => {
    const palette = runtime();
    palette.surfaceMode = "loaded";

    palette.preparedExecution = {
      promptId: "repo-policy",
      promptKind: "context",
      label: "Repo Policy",
      artifactHandle: "@repo-policy",
      deliveryMode: "paste",
      text: "Context body",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: [],
    };
    renderPromptPalette(palette, actions());
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-label",
    )?.textContent).toBe("@repo-policy");
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-title",
    )).toBeNull();

    palette.preparedExecution = {
      promptId: "review",
      promptKind: "template",
      label: "Review",
      artifactHandle: "#review",
      deliveryMode: "paste",
      text: "Review .",
      contextTitles: [],
      contextHandles: [],
      unresolvedVariables: ["scope", "risk"],
    };
    renderPromptPalette(palette, actions());
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-label",
    )?.textContent).toBe("#review");
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-title",
    )).toBeNull();

    palette.preparedExecution = {
      promptId: "review",
      promptKind: "template",
      label: "Review",
      artifactHandle: "#review",
      deliveryMode: "paste",
      text: "Review @repo-policy.",
      contextTitles: ["Repo Policy", "Style Guide", "API Notes"],
      contextHandles: ["@repo-policy", "@style-guide", "@api-notes"],
      unresolvedVariables: [],
    };
    renderPromptPalette(palette, actions());
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-label",
    )?.textContent).toBe("#review");
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-title",
    )).toBeNull();

    palette.preparedExecution = {
      promptId: "review",
      promptKind: "template",
      label: "Review",
      artifactHandle: "#review",
      deliveryMode: "paste",
      text: "Review current diff with @repo-policy.",
      contextTitles: ["Repo Policy"],
      contextHandles: ["@repo-policy"],
      unresolvedVariables: [],
      templateValueLabels: ["scope", "@repo-policy"],
    };
    renderPromptPalette(palette, actions());
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-label",
    )?.textContent).toBe("#review");
    expect(findByClass(
      palette.container as unknown as FakeElement,
      "palette-loaded-title",
    )).toBeNull();
  });

  test("renders Ctrl+V context picker as a compact clip list", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "stack";
    palette.surfaceMode = "context-picker";
    palette.prompts = [
      clipContext(1, "Older copied selection"),
      prompt(0),
      clipContext(2, "Newer copied selection"),
    ];
    palette.contextPickerSelectedIndex = 1;
    let applied = 0;
    let rerenders = 0;

    renderPromptPalette(palette, actions({
      applyContextPicker: () => {
        applied += 1;
      },
      rerender: () => {
        rerenders += 1;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const picker = findByClass(root, "palette-context-picker");
    expect(picker).not.toBeNull();
    expect(findByClass(picker!, "palette-launcher-body")).not.toBeNull();
    expect(findByClass(picker!, "palette-context-grip")).toBeNull();
    expect(findByClass(root, "palette-launcher-dismiss-layer")).not.toBeNull();
    expect(textOf(picker!)).toContain("clipboard stack");
    expect(textOf(picker!)).toContain("to paste clip");
    expect(findByClass(root, "palette-search")).toBeNull();
    expect(findByClass(root, "palette-loaded")).toBeNull();
    const rows = findAllByClass(root, "palette-context-entry");
    expect(rows).toHaveLength(2);
    expect(textOf(rows[0])).toContain("@89abcde");
    expect(textOf(rows[0])).toContain("Newer copied selection");
    expect(textOf(rows[0])).toContain("Captured from clipboard");
    expect(textOf(rows[0])).toContain("Expires in");
    expect(rows[1].className).toContain("is-selected");

    rows[0].dispatch("pointerdown", keyEvent("pointerdown"));
    expect(palette.contextPickerSelectedIndex).toBe(0);
    expect(rerenders).toBe(1);

    rows[0].dispatch("dblclick", keyEvent("dblclick"));
    expect(applied).toBe(1);
  });

  test("renders stacked context count as a minimal trailing button", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    const now = Date.now();
    palette.prompts = [
      { ...clipContext(1, "One"), created_at: now - 1_000, expires_at: now + 6 * 24 * 60 * 60 * 1000 },
      { ...clipContext(2, "Two"), created_at: now - 2_000, expires_at: now + 7 * 24 * 60 * 60 * 1000 },
      { ...clipContext(3, "Three"), created_at: now - 3_000, expires_at: now + 7 * 24 * 60 * 60 * 1000 },
    ];
    let opened = 0;

    renderPromptPalette(palette, actions({
      openContextStack: () => {
        opened += 1;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const chip = findByClass(root, "palette-search-stack-count");
    expect(chip).not.toBeNull();
    expect(chip?.tagName).toBe("button");
    expect(textOf(chip!)).toBe("@36d");
    expect(chip?.title).toBe("3 stacked contexts. Nearest expires in 6d. Press Ctrl+V or click to choose.");
    expect(findByClass(chip!, "palette-search-stack-label")?.textContent).toBe("@3");
    expect(findByClass(chip!, "palette-search-stack-expiry")?.textContent).toBe("6d");
    chip?.dispatch("click", keyEvent("click"));
    expect(opened).toBe(1);
  });

  test("renders Launcher command feedback inline in Search shell", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherFeedback = {
      message: "clipboard does not contain text to capture",
      tone: "warning",
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const feedback = findByClass(root, "palette-search-feedback");
    expect(feedback).not.toBeNull();
    expect(feedback?.className).toContain("is-warning");
    expect(textOf(feedback!)).toBe("clipboard does not contain text to capture");
    expect(findByClass(root, "palette-search-body")).not.toBeNull();
  });

  test("renders command recovery instead of old slash prompt aliases", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "/legacy-only-prompt";
    palette.prompts = [
      { ...prompt(0), id: "legacy-only-prompt", title: "Legacy Only Prompt" },
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-feedback")).toBeNull();
    const command = findByClass(root, "palette-search-command");
    expect(command).not.toBeNull();
    expect(textOf(command!)).toContain("Find /legacy-only-prompt");
    expect(textOf(root)).not.toContain("Legacy Only Prompt");
    expect(palette.launcherFeedback).toBeNull();
  });

  test("does not show old slash prompt aliases when a slash command wins", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "/review";
    palette.prompts = [
      { ...prompt(0), id: "review", title: "Review Prompt" },
    ];
    palette.userCommands = [{
      id: "review",
      title: "Review",
      description: "Review current change.",
      prompt_id: "review",
      contexts: [],
      variable_values: {},
      keywords: ["review"],
      aliases: [],
      actions: ["prepare"],
      home: true,
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-feedback")).toBeNull();
    const rows = findAllByClass(root, "palette-search-intervention");
    expect(rows[0]?.dataset.rowKind).toBe("command");
    expect(textOf(rows[0]!)).toContain("Review");
  });

  test("keeps the selected Launcher search row scrolled into view", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = Array.from({ length: 8 }, (_value, index) => prompt(index));
    palette.launcherCommandIndex = 6;

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const rows = findAllByClass(root, "palette-search-intervention");
    const selected = rows.find((row) => row.className.includes("is-selected"));
    expect(selected).not.toBeNull();
    expect(rows.indexOf(selected!)).toBe(Math.min(6, rows.length - 1));
    expect(selected!.scrollIntoViewCalls).toEqual([{ block: "nearest" }]);
  });

  test("marks one or two Launcher Search results as sparse without shrinking home", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [prompt(0), prompt(1), context(2)];
    palette.searchQuery = "#prompt-0";

    renderPromptPalette(palette, actions());

    let root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")?.className).toContain("is-sparse-results");
    expect(findByClass(root, "palette-search-body")?.className).toContain("is-sparse-results");
    expect(findByClass(root, "palette-search-results")?.className).toContain("is-sparse-results");

    palette.searchQuery = "";
    renderPromptPalette(palette, actions());

    root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")?.className).not.toContain("is-sparse-results");
    expect(findByClass(root, "palette-search-body")?.className).not.toContain("is-sparse-results");
    expect(findByClass(root, "palette-search-results")?.className).not.toContain("is-sparse-results");
  });

  test("keeps Launcher Search input first and chrome stable across query states", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [prompt(0), context(1)];

    for (const query of ["", "/", "@", "@missing", "plain text"]) {
      palette.searchQuery = query;
      renderPromptPalette(palette, actions());

      const root = palette.container as unknown as FakeElement;
      const shell = findByClass(root, "palette-search-panel");
      expect(shell).not.toBeNull();
      expect(shell!.className.includes("is-watermarked")).toBe(false);
      expect(shell!.children[0]?.className).toContain("palette-search-input-row");
      expect(shell!.children[1]?.className).toContain("palette-search-body");
      expect(findByClass(root, "palette-search")).not.toBeNull();
      expect(findByClass(root, "palette-search-results")).not.toBeNull();
      expect(findByClass(root, "palette-search-title")).toBeNull();
      expect(findByClass(root, "palette-search-grip")).toBeNull();
      expect(findByClass(root, "palette-search-footer")).toBeNull();
      expect(findByClass(root, "palette-search-actionbar")).toBeNull();
    }
  });

  test("renders each Launcher mode inside the shared shell behavior", () => {
    const cases = [
      {
        launcherMode: "search",
        surfaceMode: "search",
        shellClass: "palette-search-panel",
        setup: (palette: PromptPaletteRuntime) => {
          palette.prompts = [prompt(0), context(1)];
        },
      },
      {
        launcherMode: "scratch",
        surfaceMode: "scratch",
        shellClass: "palette-scratch",
        setup: (palette: PromptPaletteRuntime) => {
          palette.scratchText = "rough prompt";
        },
      },
      {
        launcherMode: "variables",
        surfaceMode: "template",
        shellClass: "palette-template",
        setup: (palette: PromptPaletteRuntime) => {
          palette.templatePromptId = "prompt-0";
          palette.prompts = [{
            ...prompt(0),
            prompt: "Review {{scope}}.",
            template_variables: ["scope"],
          }];
        },
      },
      {
        launcherMode: "stack",
        surfaceMode: "context-picker",
        shellClass: "palette-context-picker",
        setup: (palette: PromptPaletteRuntime) => {
          palette.prompts = [clipContext(1, "Fresh clipboard context")];
        },
      },
    ] as const;

    for (const testCase of cases) {
      const palette = runtime();
      palette.overlayMode = "launcher";
      palette.launcherMode = testCase.launcherMode;
      palette.surfaceMode = testCase.surfaceMode;
      testCase.setup(palette);

      renderPromptPalette(palette, actions());

      const root = palette.container as unknown as FakeElement;
      const dismissLayer = findByClass(root, "palette-launcher-dismiss-layer");
      const shell = findByClass(root, testCase.shellClass);

      expect(dismissLayer).not.toBeNull();
      expect(shell).not.toBeNull();
      expect(shell!.className).toContain("palette-launcher");
      expect(shell!.className).toContain("palette-launcher-shell");
      expect(findByClass(shell!, "palette-launcher-body")).not.toBeNull();
    }
  });

  test("shared launcher dismiss layer closes when clicking outside the panel", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    let unloadCount = 0;

    renderPromptPalette(palette, actions({
      unload: () => {
        unloadCount += 1;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const dismissLayer = findByClass(root, "palette-launcher-dismiss-layer");
    expect(dismissLayer).not.toBeNull();

    const outsideClick = keyEvent("pointerdown");
    dismissLayer?.dispatch("pointerdown", outsideClick);

    expect(outsideClick.prevented).toBe(true);
    expect(outsideClick.stopped).toBe(true);
    expect(unloadCount).toBe(1);
  });
});
