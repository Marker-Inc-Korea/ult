import { beforeEach, describe, expect, test } from "bun:test";

import type { PromptDefinition } from "../../src/types";
import { libraryRowsForPalette } from "../../src/overlay/launcher/libraryRows";
import { commandHandle } from "../../src/overlay/launcher/searchCommandPresentation";
import {
  FakeElement,
  actions,
  clipContext,
  context,
  findAllByClass,
  findByClass,
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

describe("palette renderer library behavior", () => {
  test("renders Launcher Library as segmented inventory with strict row grammar", () => {
    const palette = libraryRuntime();

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(palette.container.getAttribute("aria-label")).toBe("Launcher library");
    expect(findByClass(root, "palette-library-panel")).not.toBeNull();
    const tabs = findAllByClass(root, "palette-library-tab").map(textOf);
    expect(tabs[0]?.startsWith("All")).toBe(true);
    expect(tabs.slice(1, 4)).toEqual(["Prompts1", "Contexts1", "Skills1"]);
    expect(tabs[4]?.startsWith("Commands")).toBe(true);
    expect(findAllByClass(root, "palette-search-result-text").map(rowPrimary).slice(0, 3))
      .toEqual([
        "#prompt-0",
        "@context-1",
        "$diagnose",
      ]);
    expect(findAllByClass(root, "palette-search-result-text").map(rowDescription).slice(0, 3))
      .toEqual([
        "Prompt 0",
        "Context 1",
        "Read this local skill package.",
      ]);
    const rows = findAllByClass(root, "palette-library-intervention");
    expect(rows[0].className).toContain("is-prompt-row");
    expect(rows[1].className).toContain("is-context-row");
    expect(rows[2].className).toContain("is-skill-row");
    expect((rows[0] as unknown as { tabIndex: number }).tabIndex).toBe(0);
    expect((rows[1] as unknown as { tabIndex: number }).tabIndex).toBe(-1);
    expect(findAllByClass(root, "palette-search-row-kind")).toEqual([]);
    expect(findAllByClass(root, "palette-library-skill-path").map(textOf))
      .toContain("personal-library > persistent > skills > diagnose > SKILL.md");
    expect(findAllByClass(root, "palette-library-skill-chip").map(textOf))
      .toEqual(expect.arrayContaining(["Editable", "Installed Skill"]));
    expect(textOf(root)).not.toContain("@89abcde");
    expect(findAllByClass(root, "palette-search-command-text").map(rowPrimary))
      .toContain("Review Repo");
    expect(findByClass(root, "palette-search-primary-action")).toBeNull();
    expect(findByClass(root, "palette-search-key-cue")).toBeNull();
    expect(findByClass(root, "palette-search-row-action")?.title).toBe("Load Prompt");
    expect(findByClass(root, "palette-search-row-key")?.getAttribute("aria-label")).toBe("Load Prompt");
  });

  test("filters prompts contexts skills and commands without reusing Search input state", () => {
    const cases = [
      ["prompts", ["#prompt-0"], []],
      ["contexts", ["@context-1"], []],
      ["skills", ["$diagnose"], []],
      ["commands", [], ["Review Repo"]],
    ] as const;

    for (const [filter, expectedArtifacts, expectedCommands] of cases) {
      const palette = libraryRuntime();
      palette.searchQuery = "this must not drive Library rows";
      palette.launcherLibraryFilter = filter;

      renderPromptPalette(palette, actions());

      const root = palette.container as unknown as FakeElement;
      expect(findAllByClass(root, "palette-search-result-text").map(rowPrimary))
        .toEqual(expectedArtifacts);
      for (const expectedCommand of expectedCommands) {
        expect(findAllByClass(root, "palette-search-command-text").map(rowPrimary))
          .toContain(expectedCommand);
      }
    }
  });

  test("filters Library inventory with a Library-local query and sort controls", () => {
    const palette = libraryRuntime();
    const updates: string[] = [];
    const sorts: string[] = [];

    renderPromptPalette(palette, actions({
      updateLibraryQuery: (query) => {
        updates.push(query);
      },
      setLibrarySort: (sort) => {
        sorts.push(sort);
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const input = findByClass(root, "palette-library-search") as FakeElement;
    input.value = "review";
    input.dispatch("input", keyEvent("input"));
    expect(updates).toEqual(["review"]);

    findAllByClass(root, "palette-library-sort-button")[3].dispatch("click", keyEvent("click"));
    expect(sorts).toEqual(["pinned"]);

    palette.launcherLibraryQuery = "review repo";
    renderPromptPalette(palette, actions());
    const filteredRoot = palette.container as unknown as FakeElement;
    expect(findAllByClass(filteredRoot, "palette-search-command-text").map(rowPrimary))
      .toEqual(["Review Repo"]);
    expect(findAllByClass(filteredRoot, "palette-search-result-text").map(rowPrimary))
      .toEqual([]);
    expect(palette.searchQuery).toBe("");
  });

  test("sorts Library inventory by recent use, modified time, pinned state, and issues", () => {
    const palette = libraryRuntime();
    palette.prompts = [
      { ...prompt(0), pinned: false, registry_source_modified_ms: 10 },
      { ...context(1), registry_source_modified_ms: 50 },
      { ...skill("diagnose", "Diagnose"), registry_source_modified_ms: 30 },
    ];
    palette.usageHistory = [{
      timestamp_ms: 90,
      prompt_id: "context-1",
      prompt_kind: "context",
      delivery_mode: "paste",
      result: "delivered",
    }];

    palette.launcherLibrarySort = "recent";
    expect(rowLabels(libraryRowsForPalette(palette)).slice(0, 3))
      .toEqual(["Context 1", "Prompt 0", "Diagnose"]);

    palette.launcherLibrarySort = "updated";
    expect(rowLabels(libraryRowsForPalette(palette)).slice(0, 3))
      .toEqual(["Context 1", "Diagnose", "Prompt 0"]);

    palette.prompts[0].pinned = true;
    palette.launcherLibrarySort = "pinned";
    expect(rowLabels(libraryRowsForPalette(palette)).slice(0, 3))
      .toEqual(["Prompt 0", "Context 1", "Diagnose"]);

    palette.launcherLibraryDiagnostics = [{
      severity: "error",
      message: "Malformed package persistent/prompts/broken/PROMPT.md: missing title",
    }];
    palette.launcherLibrarySort = "issues";
    expect(rowLabels(libraryRowsForPalette(palette)).slice(0, 2))
      .toEqual(["Malformed package", "Context 1"]);
  });

  test("keeps saved Context Library separate from captured Clipboard Stack clips", () => {
    const palette = libraryRuntime();
    palette.launcherLibraryFilter = "contexts";

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findAllByClass(root, "palette-search-result-text").map(rowPrimary))
      .toEqual(["@context-1"]);
    expect(findByClass(root, "palette-launcher-row-icon")?.textContent).toBe("@");
    expect(textOf(root)).not.toContain("@89abcde");
    expect(textOf(root)).not.toContain("Temporary clipboard context");
  });

  test("keeps Library inventory rows metadata-only across artifact types", () => {
    const palette = libraryRuntime();
    palette.prompts = [
      {
        ...prompt(0),
        description: "Public prompt description",
        prompt: "SECRET prompt body",
      },
      {
        ...context(1),
        description: "Public context description",
        prompt: "SECRET context body",
      },
      {
        ...skill("diagnose", "Diagnose"),
        description: "Public skill description",
        prompt: "SECRET skill source text",
      },
      clipContext(2, "SECRET clipboard body"),
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const text = textOf(root);
    expect(text).toContain("#prompt-0");
    expect(text).toContain("@context-1");
    expect(text).toContain("$diagnose");
    expect(text).toContain("Public prompt description");
    expect(text).toContain("Public context description");
    expect(text).toContain("Public skill description");
    expect(text).toContain("personal-library > persistent > skills > diagnose > SKILL.md");
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("@89abcde");
  });

  test("surfaces recoverable Library issues as metadata-only inventory rows", () => {
    const palette = libraryRuntime();
    palette.launcherLibraryDiagnostics = [{
      severity: "error",
      message: "Malformed package persistent/prompts/bad/PROMPT.md: missing title",
    }];
    palette.prompts = [
      prompt(0),
      context(1),
      {
        ...skill("diagnose", "Diagnose"),
        prompt: "SECRET skill body",
        template_diagnostics: ["unsupported front matter shape"],
      },
    ];
    palette.userCommands = [{
      id: "review-repo",
      title: "Review Repo",
      description: "Review the current change with repo policy.",
      prompt_id: "missing-prompt",
      contexts: ["missing-context"],
      variable_values: {},
      keywords: ["review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const text = textOf(root);
    expect(text).toContain("Malformed package");
    expect(text).toContain("Missing command prompt");
    expect(text).toContain("Missing command context");
    expect(text).toContain("Unsupported skill metadata");
    expect(text).toContain("/review-repo references #missing-prompt");
    expect(text).toContain("/review-repo references @missing-context");
    expect(findAllByClass(root, "palette-library-issue-subject").map(textOf))
      .toEqual(expect.arrayContaining([
        "persistent/prompts/bad/PROMPT.md",
        "$diagnose",
        "/review-repo references #missing-prompt",
        "/review-repo references @missing-context",
      ]));
    expect(text).not.toContain("SECRET skill body");
  });

  test("builds Library inventory issue and dependency row models without body-derived metadata", () => {
    const palette = libraryRuntime();
    palette.launcherLibraryDiagnostics = [{
      severity: "error",
      message: "Malformed package persistent/prompts/bad/PROMPT.md: missing title",
    }];
    palette.prompts = [
      {
        ...prompt(0),
        contexts: ["context-1"],
        prompt: "SECRET prompt body",
      },
      {
        ...context(1),
        prompt: "SECRET context body",
      },
      {
        ...skill("diagnose", "Diagnose"),
        prompt: "SECRET skill body",
        template_diagnostics: ["unsupported front matter shape"],
      },
    ];
    palette.userCommands = [{
      id: "review-repo",
      title: "Review Repo",
      description: "Review the current change with repo policy.",
      prompt_id: "prompt-0",
      contexts: ["context-1"],
      variable_values: {},
      keywords: ["review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
    }];

    const rows = libraryRowsForPalette(palette);
    const promptRow = rows.find((row) =>
      row.kind === "artifact" && row.prompt.id === "prompt-0"
    );
    const commandRow = rows.find((row) =>
      row.kind === "command" && row.command.userCommand?.id === "review-repo"
    );
    const issueRows = rows.filter((row) => row.kind === "issue");
    const publicModelText = [
      ...issueRows.map((row) => `${row.title} ${row.subject ?? ""} ${row.detail}`),
      promptRow?.kind === "artifact" ? promptRow.dependencies.join(" ") : "",
      commandRow?.kind === "command" ? commandRow.dependencies.join(" ") : "",
    ].join(" ");

    expect(promptRow?.kind === "artifact" ? promptRow.dependencies : [])
      .toEqual(["@context-1"]);
    expect(commandRow?.kind === "command" ? commandRow.dependencies : [])
      .toEqual(["#prompt-0", "@context-1"]);
    expect(issueRows.map((row) => row.subject))
      .toEqual(expect.arrayContaining([
        "persistent/prompts/bad/PROMPT.md",
        "$diagnose",
      ]));
    expect(publicModelText).not.toContain("SECRET");
  });

  test("runs expired ephemeral cleanup from Library issue rows explicitly", () => {
    const palette = libraryRuntime();
    palette.prompts = [
      prompt(0),
      {
        ...clipContext(2, "Expired clipboard body"),
        expires_at: Date.now() - 1_000,
      },
    ];
    palette.userCommands = [];
    const commands: string[] = [];

    renderPromptPalette(palette, actions({
      runLauncherCommand: (command) => {
        commands.push(command.id);
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const issueRow = findByClass(root, "palette-library-issue-row");
    expect(issueRow).not.toBeNull();
    expect(textOf(root)).toContain("Expired ephemeral artifact");
    issueRow!.dispatch("click", keyEvent("click"));
    expect(commands).toEqual(["clear-expired-contexts"]);
  });

  test("shows prompt and command dependencies without showing bodies", () => {
    const palette = libraryRuntime();
    palette.prompts = [
      { ...prompt(0), contexts: ["context-1"], prompt: "SECRET prompt body" },
      { ...context(1), prompt: "SECRET context body" },
      skill("diagnose", "Diagnose"),
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const dependencyText = findAllByClass(root, "palette-library-dependency-chip").map(textOf);
    expect(dependencyText).toEqual(expect.arrayContaining(["@context-1", "#prompt-0"]));
    expect(textOf(root)).not.toContain("SECRET prompt body");
    expect(textOf(root)).not.toContain("SECRET context body");
  });

  test("renders installed skills as source-oriented packages", () => {
    const { root } = renderLibraryFilter("skills");

    expect(findAllByClass(root, "palette-search-result-text").map(rowPrimary))
      .toEqual(["$diagnose"]);
    expect(findAllByClass(root, "palette-search-result-text").map(rowDescription))
      .toEqual(["Read this local skill package."]);
    expect(findAllByClass(root, "palette-search-row-kind")).toEqual([]);
    expect(findAllByClass(root, "palette-library-skill-path").map(textOf))
      .toEqual(["personal-library > persistent > skills > diagnose > SKILL.md"]);
    expect(findAllByClass(root, "palette-library-skill-chip").map(textOf))
      .toEqual(["Editable", "Installed Skill"]);
    expect(findByClass(root, "palette-search-row-action")?.title).toBe("Read Skill");
    expect(findByClass(root, "palette-search-row-key")?.getAttribute("aria-label")).toBe("Read Skill");
    expect(textOf(root)).not.toContain("Load Skill");
    expect(textOf(root)).not.toContain("Load Prompt");
    expect(textOf(root)).not.toContain("Load Context");
  });

  test("keeps dense skill rows scannable with shared action cues", () => {
    const palette = libraryRuntime();
    palette.launcherLibraryFilter = "skills";
    palette.prompts = [
      skill("diagnose-agent-loop-with-long-bilingual-handle", "에이전트 루프 진단 and recovery checklist before handoff"),
      skill("fix-ci", "Fix CI"),
      skill("release-prep", "Release Prep"),
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const rows = findAllByClass(root, "palette-library-intervention");
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.className.includes("is-skill-row"))).toBe(true);
    expect(findAllByClass(root, "palette-library-skill-path").map(textOf))
      .toEqual([
        "personal-library > persistent > skills > diagnose-agent-loop-with-long-bilingual-handle > SKILL.md",
        "personal-library > persistent > skills > fix-ci > SKILL.md",
        "personal-library > persistent > skills > release-prep > SKILL.md",
      ]);
    expect(findAllByClass(rows[0], "palette-search-row-action").map((entry) => entry.title))
      .toEqual(["Read Skill"]);
    expect(findAllByClass(rows[0], "palette-search-row-key").map((entry) =>
      entry.getAttribute("aria-label")
    )).toEqual(["Read Skill", "Open", "Install Skill to Project"]);
    expect(findByClass(root, "palette-search-primary-action")).toBeNull();
    expect(findByClass(root, "palette-search-key-cue")).toBeNull();
  });

  test("keeps the selected Library row scrolled into view", () => {
    const palette = libraryRuntime();
    palette.launcherCommandIndex = 2;

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const selected = findAllByClass(root, "palette-library-intervention")
      .find((row) => row.className.includes("is-selected"));
    expect(selected).not.toBeNull();
    expect(selected!.scrollIntoViewCalls).toEqual([{ block: "nearest" }]);
  });

  test("runs type-specific primary actions from Library rows", () => {
    const calls: string[] = [];

    renderLibraryFilter("prompts", actions({
      runArtifactAction: (actionId, artifactId) => {
        calls.push(`${actionId}:${artifactId}`);
      },
    })).row(0).dispatch("click", keyEvent("click"));
    expect(calls.pop()).toBe("load:prompt-0");

    renderLibraryFilter("contexts", actions({
      runArtifactAction: (actionId, artifactId) => {
        calls.push(`${actionId}:${artifactId}`);
      },
    })).row(0).dispatch("click", keyEvent("click"));
    expect(calls.pop()).toBe("load:context-1");

    renderLibraryFilter("skills", actions({
      openArtifactReader: (artifactId) => {
        calls.push(`open:${artifactId}`);
      },
      runArtifactAction: (actionId, artifactId) => {
        calls.push(`${actionId}:${artifactId}`);
      },
    })).row(0).dispatch("click", keyEvent("click"));
    expect(calls.pop()).toBe("open:diagnose");

    renderLibraryFilter("commands", actions({
      runLauncherCommand: (command) => {
        calls.push(`command:${command.userCommand?.id ?? command.id}`);
      },
    })).row(0).dispatch("click", keyEvent("click"));
    expect(calls.pop()).toBe("command:review-repo");
  });

  test("keeps Library skill keyboard actions out of prompt delivery", () => {
    const seen: string[] = [];
    const { shell } = renderLibraryFilter("skills", actions({
      openArtifactReader: (artifactId) => {
        seen.push(`open:${artifactId}`);
      },
      openArtifactActions: (artifactId) => {
        seen.push(`actions:${artifactId}`);
      },
      openProjectArtifactWrite: (writeKind, artifactId) => {
        seen.push(`project:${writeKind}:${artifactId}`);
      },
      runArtifactAction: (actionId, artifactId) => {
        seen.push(`${actionId}:${artifactId}`);
      },
    }));

    shell.dispatch("keydown", keyEvent("Enter"));
    shell.dispatch("keydown", keyEvent("o", { metaKey: true }));
    shell.dispatch("keydown", keyEvent("c", { metaKey: true }));
    shell.dispatch("keydown", keyEvent("e", { metaKey: true }));
    shell.dispatch("keydown", keyEvent(".", { metaKey: true }));

    expect(seen).toEqual([
      "open:diagnose",
      "open:diagnose",
      "copy-handle:diagnose",
      "project:skill:diagnose",
      "actions:diagnose",
    ]);
    expect(seen.some((call) => call.startsWith("load:"))).toBe(false);
  });

  test("keeps Library keyboard shortcuts on the Launcher action surface", () => {
    const seen: string[] = [];
    const { shell } = renderLibraryFilter("prompts", actions({
      setLibraryFilter: (filter) => {
        seen.push(`filter:${filter}`);
      },
      openArtifactReader: (artifactId) => {
        seen.push(`open:${artifactId}`);
      },
      openArtifactActions: (artifactId) => {
        seen.push(`actions:${artifactId}`);
      },
      openProjectArtifactWrite: (writeKind, artifactId) => {
        seen.push(`project:${writeKind}:${artifactId}`);
      },
      runArtifactAction: (actionId, artifactId) => {
        seen.push(`${actionId}:${artifactId}`);
      },
    }));

    shell.dispatch("keydown", keyEvent("3", { metaKey: true }));
    shell.dispatch("keydown", keyEvent("o", { metaKey: true }));
    shell.dispatch("keydown", keyEvent("c", { metaKey: true }));
    shell.dispatch("keydown", keyEvent("e", { metaKey: true }));
    shell.dispatch("keydown", keyEvent(".", { metaKey: true }));
    shell.dispatch("keydown", keyEvent("Enter"));

    expect(seen).toEqual([
      "filter:contexts",
      "open:prompt-0",
      "copy-handle:prompt-0",
      "project:prompt:prompt-0",
      "actions:prompt-0",
      "load:prompt-0",
    ]);
  });

  test("opens selected Library artifacts in Project Write preview explicitly", () => {
    const calls: string[] = [];

    renderLibraryFilter("prompts", actions({
      openProjectArtifactWrite: (writeKind, artifactId) => {
        calls.push(`${writeKind}:${artifactId}`);
      },
    })).shell.dispatch("keydown", keyEvent("e", { metaKey: true }));
    expect(calls.pop()).toBe("prompt:prompt-0");

    renderLibraryFilter("contexts", actions({
      openProjectArtifactWrite: (writeKind, artifactId) => {
        calls.push(`${writeKind}:${artifactId}`);
      },
    })).shell.dispatch("keydown", keyEvent("e", { metaKey: true }));
    expect(calls.pop()).toBe("context:context-1");

    renderLibraryFilter("skills", actions({
      openProjectArtifactWrite: (writeKind, artifactId) => {
        calls.push(`${writeKind}:${artifactId}`);
      },
    })).shell.dispatch("keydown", keyEvent("e", { metaKey: true }));
    expect(calls.pop()).toBe("skill:diagnose");
  });

  test("copies command handles from Library command rows", () => {
    let copiedHandle = "";
    let artifactCopyCount = 0;
    const { shell } = renderLibraryFilter("commands", actions({
      copyLauncherCommandHandle: (command) => {
        copiedHandle = commandHandle(command);
      },
      runArtifactAction: () => {
        artifactCopyCount += 1;
      },
    }));

    shell.dispatch("keydown", keyEvent("c", { metaKey: true }));

    expect(copiedHandle).toBe("/review-repo");
    expect(artifactCopyCount).toBe(0);
  });
});

function libraryRuntime() {
  const palette = runtime();
  palette.overlayMode = "launcher";
  palette.launcherMode = "library";
  palette.surfaceMode = "library";
  palette.searchQuery = "";
  palette.launcherCommandIndex = 0;
  palette.prompts = [
    prompt(0),
    context(1),
    clipContext(2, "Temporary clipboard context"),
    skill("diagnose", "Diagnose"),
  ];
  palette.userCommands = [{
    id: "review-repo",
    title: "Review Repo",
    description: "Review the current change with repo policy.",
    prompt_id: "prompt-0",
    contexts: ["context-1"],
    variable_values: {},
    keywords: ["review"],
    aliases: ["rr"],
    actions: ["prepare"],
    home: true,
    source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
  }];
  return palette;
}

function renderLibraryFilter(
  filter: "prompts" | "contexts" | "skills" | "commands",
  renderActions = actions(),
) {
  const palette = libraryRuntime();
  palette.launcherLibraryFilter = filter;
  renderPromptPalette(palette, renderActions);
  const root = palette.container as unknown as FakeElement;
  return {
    root,
    row: (index: number) => {
      const rows = findAllByClass(root, "palette-library-intervention");
      const row = rows[index];
      if (!row) throw new Error(`Missing Library row ${index}`);
      return row;
    },
    shell: findByClass(root, "palette-library-panel")!,
  };
}

function skill(id: string, title: string): PromptDefinition {
  return {
    id,
    title,
    artifact_type: "skill",
    pinned: false,
    description: "Read this local skill package.",
    prompt: "---\nname: diagnose\n---\n\nInspect logs.",
    registry_source: "local-file",
    registry_source_path: `/Users/taeha/.ult/personal-library/persistent/skills/${id}/SKILL.md`,
    registry_editable: true,
  };
}

function rowLabels(rows: ReturnType<typeof libraryRowsForPalette>) {
  return rows.map((row) => {
    if (row.kind === "artifact") return row.prompt.title;
    if (row.kind === "command") return row.command.label;
    return row.title;
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
