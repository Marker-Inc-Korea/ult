import { beforeEach, describe, expect, test } from "bun:test";

import type { PromptPaletteRuntime } from "../../src/paletteRuntime";
import type { PromptDefinition } from "../../src/types";
import { commandHandle } from "../../src/overlay/launcher/searchCommandPresentation";
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

describe("palette renderer search input behavior", () => {
  test("search input Enter loads a hash-selected intervention while focused", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#";
    let loadCount = 0;

    renderPromptPalette(palette, actions({
      selectAndLoad: () => {
        loadCount += 1;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const open = keyEvent("Enter");
    search?.dispatch("keydown", open);

    expect(open.prevented).toBe(true);
    expect(loadCount).toBe(1);
  });

  test("search input Enter runs slash command rows without loading same-id prompts", () => {
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
    let commandId = "";
    let loadCount = 0;

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        commandId = command.id;
      },
      selectAndLoad: () => {
        loadCount += 1;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const open = keyEvent("Enter");
    search?.dispatch("keydown", open);

    expect(open.prevented).toBe(true);
    expect(commandId).toBe("user-command");
    expect(loadCount).toBe(0);
  });

  test("search input Enter treats old slash prompt aliases as command recovery", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "/legacy-only-prompt";
    palette.prompts = [
      { ...prompt(0), id: "legacy-only-prompt", title: "Legacy Only Prompt" },
    ];
    let commandId = "";
    let loadCount = 0;

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        commandId = command.id;
      },
      selectAndLoad: () => {
        loadCount += 1;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const open = keyEvent("Enter");
    search?.dispatch("keydown", open);

    expect(open.prevented).toBe(true);
    expect(commandId).toBe("browse-commands");
    expect(loadCount).toBe(0);
  });

  test("search input Cmd+C copies slash command handles for command rows", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "/review";
    palette.userCommands = [{
      id: "review",
      title: "Review",
      description: "Review current change.",
      prompt_id: "prompt-0",
      contexts: [],
      variable_values: {},
      keywords: ["review"],
      aliases: [],
      actions: ["prepare"],
      home: true,
    }];
    let copiedHandle = "";
    let artifactCopyCount = 0;

    renderPromptPalette(palette, actions({
      copyLauncherCommandHandle: (command) => {
        copiedHandle = commandHandle(command);
      },
      runArtifactAction: () => {
        artifactCopyCount += 1;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();
    search!.selectionStart = 0;
    search!.selectionEnd = 0;

    const copy = keyEvent("c", { metaKey: true });
    search?.dispatch("keydown", copy);

    expect(copy.prevented).toBe(true);
    expect(copiedHandle).toBe("/review");
    expect(artifactCopyCount).toBe(0);
  });

  test("search input Cmd+O opens the selected artifact reader without loading it", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#";
    let openedArtifactId = "";
    let loadCount = 0;

    renderPromptPalette(palette, actions({
      loadSelected: () => {
        loadCount += 1;
      },
      openArtifactReader: (artifactId) => {
        openedArtifactId = artifactId ?? "";
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const open = keyEvent("o", { metaKey: true });
    search?.dispatch("keydown", open);

    expect(open.prevented).toBe(true);
    expect(openedArtifactId).toBe("prompt-0");
    expect(loadCount).toBe(0);
  });

  test("search input Cmd+C copies the selected artifact handle when no input text is selected", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#";
    let copiedAction = "";

    renderPromptPalette(palette, actions({
      runArtifactAction: (actionId, artifactId) => {
        copiedAction = `${actionId}:${artifactId}`;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();
    search!.selectionStart = 0;
    search!.selectionEnd = 0;

    const copy = keyEvent("c", { metaKey: true });
    search?.dispatch("keydown", copy);

    expect(copy.prevented).toBe(true);
    expect(copiedAction).toBe("copy-handle:prompt-0");
  });

  test("search input Space does not steal ordinary text entry", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "plain text";
    let opened = false;

    renderPromptPalette(palette, actions({
      openArtifactReader: () => {
        opened = true;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const space = keyEvent(" ");
    search?.dispatch("keydown", space);

    expect(space.prevented).toBe(false);
    expect(opened).toBe(false);
  });

  test("search input Space opens the reader for artifact-handle searches", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "@";
    palette.prompts = [prompt(0), context(1)];
    let openedArtifactId = "";

    renderPromptPalette(palette, actions({
      openArtifactReader: (artifactId) => {
        openedArtifactId = artifactId ?? "";
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const space = keyEvent(" ");
    search?.dispatch("keydown", space);

    expect(space.prevented).toBe(true);
    expect(openedArtifactId).toBe("context-1");
  });

  test("search input lets native input own ordinary text insertion", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    const updates: string[] = [];

    renderPromptPalette(palette, actions({
      updateSearchQuery: (query) => {
        updates.push(query);
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    search!.value = "a";
    search!.dispatch("input", keyEvent(""));
    search!.dispatch("input", keyEvent(""));
    search!.value = "ab";
    search!.dispatch("input", keyEvent(""));

    expect(updates).toEqual(["a", "ab"]);
  });

  test("search typing updates the stable body without requesting a full shell rerender", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "";
    const updateOptions: Array<{ rerender?: boolean } | undefined> = [];

    renderPromptPalette(palette, actions({
      updateSearchQuery: (_query, options) => {
        updateOptions.push(options);
        palette.searchQuery = _query;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const shell = findByClass(root, "palette-search-panel");
    const body = findByClass(root, "palette-search-body");
    const search = findByClass(root, "palette-search");
    expect(shell).not.toBeNull();
    expect(body).not.toBeNull();
    expect(search).not.toBeNull();

    search!.value = "#Prompt";
    search!.dispatch("input", keyEvent(""));

    expect(updateOptions).toEqual([{ rerender: false }]);
    expect(findByClass(root, "palette-search-panel")).toBe(shell);
    expect(findByClass(root, "palette-search-body")).toBe(body);
    expect(findByClass(body!, "palette-search-results")).not.toBeNull();
  });

  test("search input defers Korean IME composition and does not prepare on composing Enter", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    const updates: string[] = [];
    let prepared = 0;

    renderPromptPalette(palette, actions({
      applySearchComposer: () => {
        prepared += 1;
      },
      loadSelected: () => {
        prepared += 1;
      },
      updateSearchQuery: (query) => {
        updates.push(query);
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    search!.dispatch("compositionstart", keyEvent(""));
    search!.value = "ㅇ";
    search!.dispatch("input", keyEvent("", { isComposing: true }));
    search!.value = "ㅇㅇ";
    search!.dispatch("input", keyEvent("", { isComposing: true }));

    const enter = keyEvent("Enter", { isComposing: true });
    search!.dispatch("keydown", enter);

    expect(updates).toEqual([]);
    expect(enter.prevented).toBe(false);
    expect(prepared).toBe(0);

    search!.dispatch("compositionend", keyEvent(""));
    search!.dispatch("input", keyEvent(""));

    expect(updates).toEqual(["ㅇㅇ"]);
  });

  test("search input Shift+Tab is inert until an item is loaded", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    let loaded = 0;
    let applied = 0;

    renderPromptPalette(palette, actions({
      applySearchComposer: () => {
        applied += 1;
      },
      loadSelected: () => {
        loaded += 1;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const prepare = keyEvent("Tab", { shiftKey: true });
    search!.dispatch("keydown", prepare);

    expect(prepare.prevented).toBe(true);
    expect(loaded).toBe(0);
    expect(applied).toBe(0);
  });

  test("search input Escape closes search while focused", () => {
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

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const close = keyEvent("Escape");
    search!.dispatch("keydown", close);

    expect(close.prevented).toBe(true);
    expect(unloadCount).toBe(1);
  });

  test("search input Cmd+K clears the command composer", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.searchQuery = "#prompt-0 @context-1";
    let query = "unchanged";

    renderPromptPalette(palette, actions({
      updateSearchQuery: (nextQuery) => {
        query = nextQuery;
      },
    }));

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();

    const clear = keyEvent("k", { metaKey: true });
    search!.dispatch("keydown", clear);

    expect(clear.prevented).toBe(true);
    expect(query).toBe("");
    expect(search!.value).toBe("");
  });

  test("search input Backspace removes the previous inserted handle", () => {
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

    const search = findByClass(
      palette.container as unknown as FakeElement,
      "palette-search",
    );
    expect(search).not.toBeNull();
    search!.selectionStart = search!.value.length;
    search!.selectionEnd = search!.value.length;

    const backspace = keyEvent("Backspace");
    search!.dispatch("keydown", backspace);

    expect(backspace.prevented).toBe(true);
    expect(removedHandle).toBe("@context-1");
  });
});
