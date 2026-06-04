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

describe("palette renderer artifact panel behavior", () => {
  test("renders Launcher artifact reader with metadata and Markdown body", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = { mode: "reader", artifactId: "prompt-0" };
    palette.prompts = [{
      ...prompt(0),
      title: "Review Patch",
      description: "Long Korean/English description for reader metadata.",
      registry_source_path: "/Users/taeha/.ult/personal-library/persistent/prompts/prompt-0/PROMPT.md",
      prompt: [
        "# Review checklist",
        "",
        "Use `make check` before handoff.",
        "",
        "1. Inspect diff",
        "2. Run tests",
        "",
        "| Area | Status |",
        "| --- | --- |",
        "| UI | Ready |",
        "",
        "```sh",
        "make check",
        "```",
      ].join("\n"),
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")).toBeNull();
    expect(findByClass(root, "palette-artifact-panel")).not.toBeNull();
    expect(findByClass(root, "palette-artifact-metadata")).not.toBeNull();
    expect(findByClass(root, "palette-artifact-markdown")).not.toBeNull();
    expect(findByTag(root, "h1")).not.toBeNull();
    expect(findByTag(root, "ol")).not.toBeNull();
    expect(findByTag(root, "table")).not.toBeNull();
    expect(findByTag(root, "pre")).not.toBeNull();
    expect(textOf(root)).toContain("personal-library > persistent > prompts > prompt-0 > PROMPT.md");
    expect(textOf(root)).toContain("Long Korean/English description");
    expect(textOf(root)).toContain("Review checklist");
    expect(textOf(root)).toContain("Use make check before handoff.");
  });

  test("renders selected-artifact action mode without making skills deliverable", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = { mode: "actions", artifactId: "diagnose" };
    palette.prompts = [{
      ...prompt(0),
      id: "diagnose",
      title: "diagnose",
      artifact_type: "skill",
      description: "Debug failures with a repeatable workflow.",
      prompt: "# diagnose\n\nInspect logs.",
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const rows = findAllByClass(root, "palette-artifact-action-row").map(textOf);
    expect(rows).toEqual([
      "ReadOpen the document reader inside Launcher.",
      "Copy HandleCopy $diagnose to the clipboard.",
      "Copy SourceCopy the SKILL.md source text.",
      "Edit SkillOpen the Launcher composer for this package.",
      "DuplicateCreate a new local package from this artifact.",
      "Delete ArtifactRemove this local package from Personal Library.",
      "Install Skill to Project...Preview the .codex skill file before writing.",
      "Create AGENTS.md Snippet...Preview the AGENTS.md file before writing.",
      "Reveal SourceOpen the backing package file in Finder.",
    ]);
    expect(textOf(root)).toContain("$diagnose");
    expect(textOf(root)).not.toContain("Load Prompt");
    expect(textOf(root)).not.toContain("Load Context");
  });

  test("renders prompt artifact actions for copy, pin, and scratch duplication", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = { mode: "actions", artifactId: "prompt-0" };
    palette.prompts = [{
      ...prompt(0),
      pinned: false,
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const rows = findAllByClass(root, "palette-artifact-action-row").map(textOf);
    expect(rows).toEqual([
      "Load PromptPrepare this artifact for explicit delivery.",
      "ReadOpen the document reader inside Launcher.",
      "Copy HandleCopy #prompt-0 to the clipboard.",
      "Copy BodyCopy this artifact body text.",
      "Pin PromptShow this prompt in the quick Palette.",
      "Duplicate as ScratchOpen this body as an editable scratch prompt.",
      "Edit PromptOpen the Launcher composer for this package.",
      "DuplicateCreate a new local package from this artifact.",
      "Delete ArtifactRemove this local package from Personal Library.",
      "Export Prompt to Project...Preview exact project files before writing.",
      "Create AGENTS.md Snippet...Preview the AGENTS.md file before writing.",
      "Reveal SourceOpen the backing package file in Finder.",
    ]);
  });

  test("renders context artifact actions without prompt pinning", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = { mode: "actions", artifactId: "context-0" };
    palette.prompts = [context(0)];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const rows = findAllByClass(root, "palette-artifact-action-row").map(textOf);
    expect(rows).toEqual([
      "Load ContextPrepare this artifact for explicit delivery.",
      "ReadOpen the document reader inside Launcher.",
      "Copy HandleCopy @context-0 to the clipboard.",
      "Copy BodyCopy this artifact body text.",
      "Duplicate as ScratchOpen this body as an editable scratch prompt.",
      "Edit ContextOpen the Launcher composer for this package.",
      "DuplicateCreate a new local package from this artifact.",
      "Delete ArtifactRemove this local package from Personal Library.",
      "Export Context to Project...Preview exact project files before writing.",
      "Create AGENTS.md Snippet...Preview the AGENTS.md file before writing.",
      "Reveal SourceOpen the backing package file in Finder.",
    ]);
    expect(textOf(root)).not.toContain("Pin Prompt");
    expect(textOf(root)).not.toContain("Unpin Prompt");
  });

  test("runs selected artifact actions from keyboard navigation", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = { mode: "actions", artifactId: "prompt-0" };
    palette.prompts = [prompt(0)];
    const executed: string[] = [];

    renderPromptPalette(palette, actions({
      selectPanelActionDelta: (delta, count) => {
        palette.launcherPanelActionIndex = Math.max(
          0,
          Math.min(count - 1, palette.launcherPanelActionIndex + delta),
        );
      },
      runArtifactAction: (actionId, artifactId) => {
        executed.push(`${actionId}:${artifactId}`);
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const panel = findByClass(root, "palette-artifact-panel");
    expect(panel).not.toBeNull();

    const down = keyEvent("ArrowDown");
    panel?.dispatch("keydown", down);
    const enter = keyEvent("Enter");
    panel?.dispatch("keydown", enter);

    expect(down.prevented).toBe(true);
    expect(enter.prevented).toBe(true);
    expect(executed).toEqual(["read:prompt-0"]);
  });

  test("renders Launcher composer and saves detected prompt arguments", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "composer",
      kind: "new",
      artifactType: "prompt",
      initialId: "review-patch",
    };
    palette.prompts = [context(1)];
    let saved: PromptDefinition | null = null;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-artifact-composer")).not.toBeNull();
    expect(textOf(root)).toContain("Create Prompt");
    expect(textOf(root)).toContain("Arguments");
    const textarea = findByTag(root, "textarea");
    expect(textarea).not.toBeNull();
    textarea!.value = "Review {{argument_1}} with @context.";
    const form = findByClass(root, "palette-artifact-composer");
    form?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(saved?.id).toBe("review-patch");
    expect(saved?.title).toBe("Review Patch");
    expect(saved?.artifact_type).toBe("prompt");
    expect(saved?.contexts).toEqual([]);
    expect(saved?.template_arguments?.map((argument) => argument.name)).toEqual([
      "argument_1",
    ]);
  });

  test("GitHub import panel previews from shell Cmd+Enter", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "github-import",
      status: "form",
      url: "https://github.com/taeha/ult-pack",
      reference: "main",
      selectedPaths: [],
      preview: null,
      error: null,
      result: null,
    };
    let previewArgs: { url: string; reference: string | null } | null = null;

    renderPromptPalette(palette, actions({
      previewGitHubImport: async (url, reference) => {
        previewArgs = { url, reference };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const shell = findByClass(root, "palette-artifact-panel");
    const submit = keyEvent("Enter", { metaKey: true });
    shell?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(previewArgs).toEqual({
      url: "https://github.com/taeha/ult-pack",
      reference: "main",
    });
  });

  test("Browse Packs panel previews selected starter pack metadata through GitHub import", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "starter-packs",
      selectedPackId: "agent-control",
    };
    let previewArgs: { url: string; reference: string | null } | null = null;

    renderPromptPalette(palette, actions({
      previewGitHubImport: async (url, reference) => {
        previewArgs = { url, reference };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-artifact-panel")).not.toBeNull();
    expect(findByClass(root, "palette-starter-pack-body")).not.toBeNull();
    expect(textOf(root)).toContain("Browse Packs");
    expect(textOf(root)).toContain("Agent Control");
    expect(textOf(root)).toContain("PR Review");
    expect(textOf(root)).toContain("Debugging");
    expect(textOf(root)).toContain("Planning");
    expect(textOf(root)).toContain("Release Prep");

    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(previewArgs).toEqual({
      url: "https://github.com/taeha/ult-packs",
      reference: "agent-control",
    });
  });

  test("renders external skill discovery as a gated metadata-only surface", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [prompt(0)];
    palette.launcherArtifactPanel = {
      mode: "skill-discovery",
      intent: "install",
    };
    let opened = 0;

    renderPromptPalette(palette, actions({
      openGitHubImport: () => {
        opened += 1;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const shell = findByClass(root, "palette-artifact-panel");
    expect(shell).not.toBeNull();
    expect(findByClass(root, "palette-skill-discovery-body")).not.toBeNull();
    expect(textOf(root)).toContain("Install Agent Skill");
    expect(textOf(root)).toContain("https://www.skills.sh/");
    expect(textOf(root)).toContain("GitHub owner/repo listed by the directory.");
    expect(textOf(root)).toContain("~/.ult/personal-library/persistent/skills/<handle>/SKILL.md");
    expect(textOf(root)).toContain("npx skills add <owner/repo> (not run by Ult)");
    expect(textOf(root)).toContain("No project files, prompt bodies, context bodies");
    expect(textOf(root)).not.toContain("Run prompt 0");

    const submit = keyEvent("Enter", { metaKey: true });
    shell?.dispatch("keydown", submit);

    expect(submit.prevented).toBe(true);
    expect(opened).toBe(1);
  });

  test("renders GitHub import preview and selected package actions in Launcher", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "github-import",
      status: "preview",
      url: "https://github.com/taeha/ult-pack",
      reference: "main",
      selectedPaths: ["persistent/prompts/review/PROMPT.md"],
      preview: {
        owner: "taeha",
        repo: "ult-pack",
        requested_ref: "main",
        resolved_ref: "main",
        commit: "1234567890abcdef",
        source_url: "https://github.com/taeha/ult-pack/tree/1234567890abcdef",
        entries: [{
          artifact_id: "review",
          artifact_type: "prompt",
          title: "Review",
          source_path: "persistent/prompts/review/PROMPT.md",
          target_path: "/Users/taeha/.ult/personal-library/persistent/prompts/review/PROMPT.md",
          action: "new",
          diagnostics: [],
        }, {
          artifact_id: "repo-policy",
          artifact_type: "context",
          title: "Repo Policy",
          source_path: "contexts/repo-policy/CONTEXT.md",
          target_path: "/Users/taeha/.ult/personal-library/persistent/contexts/repo-policy/CONTEXT.md",
          action: "overwrite",
          diagnostics: [],
        }, {
          artifact_id: "run-review",
          artifact_type: "command",
          title: "Run Review",
          source_path: "persistent/commands/run-review/COMMAND.md",
          target_path: "/Users/taeha/.ult/personal-library/persistent/commands/run-review/COMMAND.md",
          action: "new",
          diagnostics: [],
        }],
        ignored_files: [{ path: "README.md", reason: "not an Ult package" }],
        malformed_packages: [{ path: "persistent/prompts/bad/PROMPT.md", reason: "missing title" }],
        warnings: ["GitHub returned a truncated tree; some packages may be missing from the preview."],
      },
    };

    let importArgs: { url: string; reference: string | null; paths: string[] } | null = null;

    renderPromptPalette(palette, actions({
      importGitHubPackages: async (url, reference, paths) => {
        importArgs = { url, reference, paths };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")).toBeNull();
    expect(findByClass(root, "palette-artifact-panel")).not.toBeNull();
    expect(findByClass(root, "palette-github-import-body")).not.toBeNull();
    expect(textOf(root)).toContain("Import from GitHub");
    expect(textOf(root)).toContain("taeha/ult-pack");
    expect(textOf(root)).toContain("ref main at 1234567890ab");
    expect(textOf(root)).toContain("Review");
    expect(textOf(root)).toContain("#review");
    expect(textOf(root)).toContain("Repo Policy");
    expect(textOf(root)).toContain("@repo-policy");
    expect(textOf(root)).toContain("Run Review");
    expect(textOf(root)).toContain("/run-review");
    expect(textOf(root)).toContain("new");
    expect(textOf(root)).toContain("overwrite");
    expect(textOf(root)).toContain("Malformed");
    expect(textOf(root)).toContain("Ignored");
    expect(textOf(root)).toContain("Import Selected Packages");
    expect(findAllByTag(root, "input").find((input) => input.name === "url")?.disabled).toBe(true);
    expect(findAllByTag(root, "input").find((input) => input.name === "reference")?.disabled).toBe(true);

    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(importArgs).toEqual({
      url: "https://github.com/taeha/ult-pack",
      reference: "main",
      paths: ["persistent/prompts/review/PROMPT.md"],
    });
  });

  test("Project write panel previews from shell Cmd+Enter", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "project-write",
      status: "form",
      artifactId: "prompt-0",
      writeKind: "prompt",
      targetDirectory: "/Users/taeha/Workspace/project",
      overwrite: false,
      preview: null,
      error: null,
      result: null,
    };
    let previewArgs: {
      artifactId: string;
      writeKind: string;
      targetDirectory: string;
      overwrite: boolean;
    } | null = null;

    renderPromptPalette(palette, actions({
      previewProjectArtifactWrite: async (artifactId, writeKind, targetDirectory, overwrite) => {
        previewArgs = { artifactId, writeKind, targetDirectory, overwrite };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findAllByTag(root, "input").find((input) => input.name === "targetDirectory")?.disabled)
      .toBe(false);

    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(previewArgs).toEqual({
      artifactId: "prompt-0",
      writeKind: "prompt",
      targetDirectory: "/Users/taeha/Workspace/project",
      overwrite: false,
    });
  });

  test("renders explicit project write preview before writing files", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "project-write",
      status: "preview",
      artifactId: "prompt-0",
      writeKind: "prompt",
      targetDirectory: "/Users/taeha/Workspace/project",
      overwrite: false,
      preview: {
        artifact_id: "prompt-0",
        artifact_type: "prompt",
        write_kind: "prompt",
        target_directory: "/Users/taeha/Workspace/project",
        ready_to_write: false,
        requires_overwrite_confirmation: true,
        files: [{
          relative_path: ".ult/prompts/prompt-0/PROMPT.md",
          path: "/Users/taeha/Workspace/project/.ult/prompts/prompt-0/PROMPT.md",
          exists: true,
          action: "blocked",
        }],
      },
    };
    let writeArgs: {
      artifactId: string;
      writeKind: string;
      targetDirectory: string;
      overwrite: boolean;
    } | null = null;

    renderPromptPalette(palette, actions({
      writeProjectArtifact: async (artifactId, writeKind, targetDirectory, overwrite) => {
        writeArgs = { artifactId, writeKind, targetDirectory, overwrite };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")).toBeNull();
    expect(findByClass(root, "palette-project-write-body")).not.toBeNull();
    expect(textOf(root)).toContain("Export Prompt to Project");
    expect(textOf(root)).toContain(".ult/prompts/prompt-0/PROMPT.md");
    expect(textOf(root)).toContain("blocked");
    expect(textOf(root)).toContain("Overwrite existing project file");
    expect(textOf(root)).toContain("Write to Project");
    const targetDirectory = findAllByTag(root, "input")
      .find((input) => input.name === "targetDirectory");
    expect(targetDirectory?.disabled).toBe(true);
    if (targetDirectory) targetDirectory.value = "/Users/taeha/Workspace/other-project";

    const overwrite = findAllByTag(root, "input").find((input) => input.name === "overwrite");
    if (overwrite) overwrite.checked = true;
    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(writeArgs).toEqual({
      artifactId: "prompt-0",
      writeKind: "prompt",
      targetDirectory: "/Users/taeha/Workspace/project",
      overwrite: true,
    });
  });

  test("Project Setup panel previews selected artifacts from shell Cmd+Enter", async () => {
    const palette = runtime();
    const skill: PromptDefinition = {
      ...prompt(2),
      id: "diagnose",
      title: "Diagnose",
      artifact_type: "skill",
      prompt: "# Diagnose\n\nInspect logs.",
    };
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [{ ...prompt(0), contexts: ["context-1"] }, context(1), skill];
    palette.launcherArtifactPanel = {
      mode: "project-setup",
      status: "form",
      targetDirectory: "/Users/taeha/Workspace/project",
      selectedArtifactIds: ["prompt-0", "context-1"],
      includeAgentsSnippet: true,
      agentsSnippetArtifactId: "prompt-0",
      overwrite: false,
      preview: null,
      error: null,
      result: null,
    };
    let previewArgs: {
      targetDirectory: string;
      selectedArtifactIds: string[];
      includeAgentsSnippet: boolean;
      agentsSnippetArtifactId: string | null;
      overwrite: boolean;
    } | null = null;

    renderPromptPalette(palette, actions({
      previewProjectSetup: async (
        targetDirectory,
        selectedArtifactIds,
        includeAgentsSnippet,
        agentsSnippetArtifactId,
        overwrite,
      ) => {
        previewArgs = {
          targetDirectory,
          selectedArtifactIds,
          includeAgentsSnippet,
          agentsSnippetArtifactId,
          overwrite,
        };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")).toBeNull();
    expect(findByClass(root, "palette-artifact-panel")).not.toBeNull();
    expect(textOf(root)).toContain("Project Setup");
    expect(textOf(root)).toContain("Choose a setup purpose");
    expect(textOf(root)).toContain("Purpose");
    expect(textOf(root)).toContain("Agent Control");
    expect(textOf(root)).toContain("Custom Selection");
    expect(textOf(root)).toContain("Prompt 0 · Prompt · uses @context-1");
    expect(textOf(root)).toContain("Create AGENTS.md snippet");
    expect(textOf(root)).toContain("$diagnose");
    expect(findAllByTag(root, "input").find((input) => input.name === "targetDirectory")?.disabled)
      .toBe(false);

    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(previewArgs).toEqual({
      targetDirectory: "/Users/taeha/Workspace/project",
      selectedArtifactIds: ["prompt-0", "context-1"],
      includeAgentsSnippet: true,
      agentsSnippetArtifactId: "prompt-0",
      overwrite: false,
    });
  });

  test("Project Setup preset previews starter-pack aligned local artifacts", async () => {
    const palette = runtime();
    const reviewPrompt: PromptDefinition = {
      ...prompt(0),
      id: "review-change",
      title: "Review Change",
      description: "Inspect the current diff.",
    };
    const policyContext: PromptDefinition = {
      ...context(1),
      id: "repo-policy",
      title: "Repo Policy",
    };
    const diagnoseSkill: PromptDefinition = {
      ...prompt(2),
      id: "diagnose",
      title: "Diagnose Failure",
      description: "Triage failing tests and choose diagnostics.",
      artifact_type: "skill",
      prompt: "# Diagnose Failure\n\nInspect logs.",
    };
    const workflowPrompt: PromptDefinition = {
      ...prompt(3),
      id: "workflow-fix-failing-tests",
      title: "Fix Failing Tests",
      description: "Drive a focused failing-test debugging loop.",
    };
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [reviewPrompt, policyContext, diagnoseSkill, workflowPrompt];
    palette.launcherArtifactPanel = {
      mode: "project-setup",
      status: "form",
      presetId: "debugging",
      targetDirectory: "/Users/taeha/Workspace/project",
      selectedArtifactIds: [],
      includeAgentsSnippet: false,
      agentsSnippetArtifactId: null,
      overwrite: false,
      preview: null,
      error: null,
      result: null,
    };
    let previewArgs: {
      targetDirectory: string;
      selectedArtifactIds: string[];
      includeAgentsSnippet: boolean;
      agentsSnippetArtifactId: string | null;
      overwrite: boolean;
      presetId?: string;
    } | null = null;

    renderPromptPalette(palette, actions({
      previewProjectSetup: async (
        targetDirectory,
        selectedArtifactIds,
        includeAgentsSnippet,
        agentsSnippetArtifactId,
        overwrite,
        presetId,
      ) => {
        previewArgs = {
          targetDirectory,
          selectedArtifactIds,
          includeAgentsSnippet,
          agentsSnippetArtifactId,
          overwrite,
          presetId,
        };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(textOf(root)).toContain("Debugging");
    expect(textOf(root)).toContain("starter-pack aligned setup");
    const agentsToggle = findAllByTag(root, "input")
      .find((input) => input.name === "includeAgentsSnippet");
    expect(agentsToggle?.checked).toBe(true);
    if (agentsToggle) agentsToggle.checked = false;

    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(previewArgs).toEqual({
      targetDirectory: "/Users/taeha/Workspace/project",
      selectedArtifactIds: ["workflow-fix-failing-tests", "diagnose", "review-change", "repo-policy"],
      includeAgentsSnippet: false,
      agentsSnippetArtifactId: "workflow-fix-failing-tests",
      overwrite: false,
      presetId: "debugging",
    });
  });

  test("Project Setup preview requires overwrite confirmation before writing", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [prompt(0), context(1)];
    palette.launcherArtifactPanel = {
      mode: "project-setup",
      status: "preview",
      targetDirectory: "/Users/taeha/Workspace/project",
      selectedArtifactIds: ["prompt-0", "context-1"],
      includeAgentsSnippet: true,
      agentsSnippetArtifactId: "prompt-0",
      overwrite: false,
      preview: {
        targetDirectory: "/Users/taeha/Workspace/project",
        requiresOverwriteConfirmation: true,
        readyToWrite: false,
        planHash: "renderer-project-setup-plan",
        entries: [{
          artifactId: "prompt-0",
          writeKind: "prompt",
          error: null,
          preview: {
            artifact_id: "prompt-0",
            artifact_type: "prompt",
            write_kind: "prompt",
            target_directory: "/Users/taeha/Workspace/project",
            ready_to_write: false,
            requires_overwrite_confirmation: true,
            files: [{
              relative_path: ".ult/prompts/prompt-0/PROMPT.md",
              path: "/Users/taeha/Workspace/project/.ult/prompts/prompt-0/PROMPT.md",
              exists: true,
              action: "blocked",
            }],
          },
        }, {
          artifactId: "context-1",
          writeKind: "context",
          error: null,
          preview: {
            artifact_id: "context-1",
            artifact_type: "context",
            write_kind: "context",
            target_directory: "/Users/taeha/Workspace/project",
            ready_to_write: true,
            requires_overwrite_confirmation: false,
            files: [{
              relative_path: ".ult/contexts/context-1/CONTEXT.md",
              path: "/Users/taeha/Workspace/project/.ult/contexts/context-1/CONTEXT.md",
              exists: false,
              action: "create",
            }],
          },
        }, {
          artifactId: "prompt-0",
          writeKind: "agents-snippet",
          error: null,
          preview: {
            artifact_id: "prompt-0",
            artifact_type: "prompt",
            write_kind: "agents-snippet",
            target_directory: "/Users/taeha/Workspace/project",
            ready_to_write: true,
            requires_overwrite_confirmation: false,
            files: [{
              relative_path: "AGENTS.md",
              path: "/Users/taeha/Workspace/project/AGENTS.md",
              exists: false,
              action: "create",
            }],
          },
        }],
      },
      error: null,
      result: null,
    };
    let writeArgs: {
      targetDirectory: string;
      selectedArtifactIds: string[];
      includeAgentsSnippet: boolean;
      agentsSnippetArtifactId: string | null;
      overwrite: boolean;
    } | null = null;

    renderPromptPalette(palette, actions({
      writeProjectSetup: async (
        targetDirectory,
        selectedArtifactIds,
        includeAgentsSnippet,
        agentsSnippetArtifactId,
        overwrite,
      ) => {
        writeArgs = {
          targetDirectory,
          selectedArtifactIds,
          includeAgentsSnippet,
          agentsSnippetArtifactId,
          overwrite,
        };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-search-panel")).toBeNull();
    expect(findByClass(root, "palette-project-setup-preview")).not.toBeNull();
    expect(textOf(root)).toContain("Files to Write");
    expect((textOf(root).match(/Files to Write/g) ?? []).length).toBe(1);
    expect(textOf(root)).toContain("#prompt-0");
    expect(textOf(root)).toContain("@context-1");
    expect(textOf(root)).toContain(".ult/prompts/prompt-0/PROMPT.md");
    expect(textOf(root)).toContain("AGENTS.md");
    expect(textOf(root)).toContain("Overwrite existing project files");
    expect(findAllByTag(root, "input").find((input) => input.name === "targetDirectory")?.disabled)
      .toBe(true);

    const overwrite = findAllByTag(root, "input").find((input) => input.name === "overwrite");
    if (overwrite) overwrite.checked = true;
    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(writeArgs).toEqual({
      targetDirectory: "/Users/taeha/Workspace/project",
      selectedArtifactIds: ["prompt-0", "context-1"],
      includeAgentsSnippet: true,
      agentsSnippetArtifactId: "prompt-0",
      overwrite: true,
    });
  });

  test("Workflow input panel submits pasted text and context handles explicitly", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [context(1)];
    palette.launcherArtifactPanel = {
      mode: "workflow-input",
      status: "form",
      commandId: "workflow-fix-failing-tests",
      inputText: "",
      contextHandleText: "@context-1",
      error: null,
    };
    let submitArgs: {
      commandId: string;
      inputText: string;
      contextHandleText: string;
    } | null = null;

    renderPromptPalette(palette, actions({
      submitWorkflowInput: async (commandId, inputText, contextHandleText) => {
        submitArgs = { commandId, inputText, contextHandleText };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-artifact-panel")).not.toBeNull();
    expect(findByClass(root, "palette-workflow-input-body")).not.toBeNull();
    expect(textOf(root)).toContain("Fix Failing Tests");
    expect(textOf(root)).toContain("Paste the failing command and output.");
    expect(textOf(root)).toContain("7-day local context");

    const textarea = findAllByTag(root, "textarea")
      .find((input) => input.name === "workflowInputText");
    if (textarea) textarea.value = "PRIVATE failing command output";

    const submit = keyEvent("Enter", { metaKey: true });
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);
    await Promise.resolve();

    expect(submit.prevented).toBe(true);
    expect(submitArgs).toEqual({
      commandId: "workflow-fix-failing-tests",
      inputText: "PRIVATE failing command output",
      contextHandleText: "@context-1",
    });
  });

  test("Recovery panel renders failure metadata and explicit actions only", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [{
      ...prompt(1),
      title: "Recoverable Prompt",
      prompt: "PRIVATE PROMPT BODY",
    }];
    palette.launcherArtifactPanel = {
      mode: "recovery",
      status: "ready",
      entry: {
        timestamp_ms: 1_700_000_000_000,
        prompt_id: "prompt-1",
        delivery_mode: "send",
        result: "failed",
        diagnostic_code: "accessibility-required",
        target_application: {
          name: "Terminal",
          bundle_id: "com.apple.Terminal",
        },
      },
      error: null,
      message: null,
      exportPath: null,
    };
    let actionId = "";

    renderPromptPalette(palette, actions({
      runRecoveryAction: (nextActionId) => {
        actionId = nextActionId;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-artifact-panel")).not.toBeNull();
    expect(findByClass(root, "palette-recovery-body")).not.toBeNull();
    expect(textOf(root)).toContain("Delivery Recovery");
    expect(textOf(root)).toContain("#prompt-1");
    expect(textOf(root)).toContain("Recoverable Prompt");
    expect(textOf(root)).toContain("Paste + Enter");
    expect(textOf(root)).toContain("Terminal");
    expect(textOf(root)).toContain("com.apple.Terminal");
    expect(textOf(root)).toContain("accessibility-required");
    expect(textOf(root)).toContain("Prepare Again");
    expect(textOf(root)).toContain("Retry as Copy");
    expect(textOf(root)).toContain("Open Accessibility Guidance");
    expect(textOf(root)).toContain("Export Diagnostics");
    expect(textOf(root)).not.toContain("PRIVATE PROMPT BODY");

    const submit = keyEvent("Enter");
    findByClass(root, "palette-artifact-panel")?.dispatch("keydown", submit);

    expect(submit.prevented).toBe(true);
    expect(actionId).toBe("prepare-again");
  });

  test("renders delete confirmation inside Launcher", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = { mode: "delete", artifactId: "prompt-0" };
    let deleted = "";

    renderPromptPalette(palette, actions({
      deleteArtifact: async (artifactId) => {
        deleted = artifactId;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(textOf(root)).toContain("Delete #prompt-0?");
    const button = findAllByTag(root, "button").find((entry) => textOf(entry) === "Delete");
    button?.dispatch("click", keyEvent("click"));
    expect(deleted).toBe("prompt-0");
  });
});
