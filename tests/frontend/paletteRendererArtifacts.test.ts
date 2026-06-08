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
        "Use `make check` before handoff and prefer the **smallest viable patch**.",
        "",
        "1. Inspect diff",
        "2. Run _focused_ tests",
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
    expect(findByClass(root, "palette-artifact-metadata-card")).not.toBeNull();
    expect(findByClass(root, "palette-artifact-metadata")).not.toBeNull();
    expect(findByClass(root, "palette-artifact-markdown")).not.toBeNull();
    expect(findByTag(root, "h1")).not.toBeNull();
    expect(findByTag(root, "ol")).not.toBeNull();
    expect(findByTag(root, "table")).not.toBeNull();
    expect(findByTag(root, "pre")).not.toBeNull();
    expect(textOf(root)).toContain("personal-library > persistent > prompts > prompt-0 > PROMPT.md");
    expect(textOf(root)).toContain("Long Korean/English description");
    expect(textOf(root)).toContain("Review checklist");
    expect(textOf(root)).toContain("Use make check before handoff and prefer");
    expect(textOf(root)).toContain("Metadata");
    expect(textOf(root)).toContain("handle#prompt-0");
    expect(findAllByTag(root, "strong").map(textOf)).toContain("smallest viable patch");
    expect(findAllByTag(root, "em").map(textOf)).toContain("focused");
  });

  test("renders context and skill readers as metadata cards plus Markdown documents", () => {
    const cases: PromptDefinition[] = [
      {
        ...context(0),
        id: "repo-policy",
        title: "Repo Policy",
        description: "Local engineering policy.",
        registry_source_path: "/Users/taeha/.ult/personal-library/persistent/contexts/repo-policy/CONTEXT.md",
        prompt: [
          "## Overview",
          "",
          "Prefer **local-first** changes.",
          "",
          "- Keep project writes explicit.",
          "- Report `make all` failures plainly.",
        ].join("\n"),
      },
      {
        ...prompt(0),
        id: "diagnose",
        title: "Diagnose",
        artifact_type: "skill",
        description: "Debug failures with repeatable steps.",
        registry_source_path: "/Users/taeha/.ult/personal-library/persistent/skills/diagnose/SKILL.md",
        prompt: [
          "# Diagnose",
          "",
          "Use this skill when failures need a **hypothesis** before edits.",
          "",
          "```sh",
          "make check",
          "```",
        ].join("\n"),
      },
    ];

    for (const artifact of cases) {
      const palette = runtime();
      palette.overlayMode = "launcher";
      palette.launcherMode = "search";
      palette.surfaceMode = "search";
      palette.launcherArtifactPanel = { mode: "reader", artifactId: artifact.id };
      palette.prompts = [artifact];

      renderPromptPalette(palette, actions());

      const root = palette.container as unknown as FakeElement;
      expect(findByClass(root, "palette-artifact-metadata-card")).not.toBeNull();
      expect(findByClass(root, "palette-artifact-markdown")).not.toBeNull();
      expect(textOf(root)).toContain(`handle${artifact.id === "diagnose" ? "$" : "@"}${artifact.id}`);
      expect(textOf(root)).toContain(`name${artifact.title}`);
      expect(textOf(root)).toContain(artifact.description);
      expect(findAllByTag(root, "strong").map(textOf).join(" ")).toContain(
        artifact.id === "diagnose" ? "hypothesis" : "local-first",
      );
    }
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
      "Advanced EditorEdit handle, description, and SKILL.md source.",
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
      "Advanced EditorEdit handle, description, arguments, contexts, and delivery defaults.",
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
      "Advanced EditorEdit handle, description, and raw context body.",
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

  test("renders prompt create canvas and saves through the existing artifact draft path", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: "review-patch",
    };
    let saved: PromptDefinition | null = null;
    let prepared: PromptDefinition | null = null;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
      prepareCreatedArtifact: (artifact) => {
        prepared = artifact;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-artifact-create-canvas")).not.toBeNull();
    expect(textOf(root)).toContain("#review-patch");
    expect(textOf(root)).toContain("Personal Library");
    expect(textOf(root)).toContain("Advanced Editor");
    expect(textOf(root)).toContain("Prompt text required.");
    expect(textOf(root)).not.toContain("Body is required.");
    expect(textOf(root)).not.toContain("Handle");
    expect(textOf(root)).not.toContain("Description");
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    expect(textarea).not.toBeNull();
    const createButton = findAllByTag(root, "button").find((button) =>
      textOf(button) === "Create"
    );
    const createAndLoadButton = findAllByTag(root, "button").find((button) =>
      textOf(button) === "Create and Load"
    );
    expect(createButton?.disabled).toBe(true);
    expect(createAndLoadButton?.disabled).toBe(true);
    textarea.value = "Review {{argument_1}} with the smallest viable patch.";
    textarea.dispatch("input", keyEvent("input"));
    expect(createButton?.disabled).toBe(false);
    expect(createAndLoadButton?.disabled).toBe(false);
    expect(textOf(root)).toContain("Ready to create #review-patch.");
    const form = findByClass(root, "palette-artifact-create-canvas");
    form?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(saved?.id).toBe("review-patch");
    expect(saved?.title).toBe("Review Patch");
    expect(saved?.artifact_type).toBe("prompt");
    expect(saved?.scope).toBe("persistent");
    expect(saved?.pinned).toBe(false);
    expect(saved?.confirm).toBe(false);
    expect(saved?.contexts).toEqual([]);
    expect(saved?.template_arguments?.map((argument) => argument.name)).toEqual([
      "argument_1",
    ]);
    expect(Object.keys(saved as unknown as Record<string, unknown>).sort()).toEqual([
      "artifact_type",
      "confirm",
      "contexts",
      "description",
      "id",
      "pinned",
      "prompt",
      "scope",
      "shortcut",
      "template_arguments",
      "title",
    ]);
    expect(prepared).toBeNull();
  });

  test("Create and Load saves before preparing without delivering", async () => {
    const cases = [
      {
        artifactType: "prompt",
        initialId: "review-now",
        body: "Review the current diff.",
        expectedId: "review-now",
      },
      {
        artifactType: "context",
        initialId: "repo-policy",
        body: "Prefer small local-first patches.",
        expectedId: "repo-policy",
      },
    ] as const;

    for (const createCase of cases) {
      const palette = runtime();
      palette.overlayMode = "launcher";
      palette.launcherMode = "search";
      palette.surfaceMode = "search";
      palette.launcherArtifactPanel = {
        mode: "create",
        artifactType: createCase.artifactType,
        initialId: createCase.initialId,
      };
      const events: string[] = [];
      let saved: PromptDefinition | null = null;
      let prepared: PromptDefinition | null = null;
      let delivered = false;

      renderPromptPalette(palette, actions({
        saveArtifactDraft: async (_originalId, draft) => {
          events.push(`save:${draft.id}`);
          saved = draft;
        },
        prepareCreatedArtifact: (artifact) => {
          events.push(`prepare:${artifact.id}`);
          prepared = artifact;
        },
        loadSelected: () => {
          delivered = true;
        },
        selectAndLoad: () => {
          delivered = true;
        },
        applyLoaded: () => {
          delivered = true;
        },
      }));

      const root = palette.container as unknown as FakeElement;
      const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
      textarea.value = createCase.body;
      textarea.dispatch("input", keyEvent("input"));
      const createAndLoad = findAllByTag(root, "button").find((button) =>
        textOf(button) === "Create and Load"
      );
      createAndLoad?.dispatch("click", keyEvent("click"));
      await Promise.resolve();

      expect(saved?.id).toBe(createCase.expectedId);
      expect(saved?.artifact_type).toBe(createCase.artifactType);
      expect(prepared).toEqual(saved);
      expect(events).toEqual([
        `save:${createCase.expectedId}`,
        `prepare:${createCase.expectedId}`,
      ]);
      expect(delivered).toBe(false);
    }
  });

  test("create canvas validation failure stays local and writes nothing", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: "empty-prompt",
    };
    let saveCalls = 0;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async () => {
        saveCalls += 1;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const createButton = findAllByTag(root, "button").find((button) =>
      textOf(button) === "Create"
    );
    findByClass(root, "palette-artifact-create-canvas")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(createButton?.disabled).toBe(true);
    expect(saveCalls).toBe(0);
    expect(textOf(root)).toContain("Add prompt text before creating.");
    expect(textOf(root)).toContain("Prompt text is required.");
  });

  test("create canvas derives a non-colliding handle before saving", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [{
      ...prompt(0),
      id: "review-rollout-carefully",
      title: "Review Rollout Carefully",
    }];
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: null,
    };
    let saved: PromptDefinition | null = null;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    textarea.value = "Review rollout carefully. Keep the patch scoped.";
    textarea.dispatch("input", keyEvent("input"));
    expect(findByClass(root, "palette-artifact-create-handle")?.textContent)
      .toBe("#review-rollout-carefully-2");

    findByClass(root, "palette-artifact-create-canvas")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(saved?.id).toBe("review-rollout-carefully-2");
    expect(saved?.prompt).toBe("Review rollout carefully. Keep the patch scoped.");
  });

  test("create canvas cancel closes without writing a draft", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: "cancelled-prompt",
    };
    let saveCalls = 0;
    let closeCalls = 0;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async () => {
        saveCalls += 1;
      },
      closeArtifactPanel: () => {
        closeCalls += 1;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    textarea.value = "This draft should remain unsaved.";
    textarea.dispatch("input", keyEvent("input"));
    findAllByTag(root, "button").find((button) =>
      textOf(button) === "Cancel"
    )?.dispatch("click", keyEvent("click"));

    expect(saveCalls).toBe(0);
    expect(closeCalls).toBe(1);
  });

  test("renders context create canvas with context-specific payload and no prompt delivery defaults", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "context",
      initialId: "repo-policy",
    };
    let saved: PromptDefinition | null = null;
    let delivered = false;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
      loadSelected: () => {
        delivered = true;
      },
      selectAndLoad: () => {
        delivered = true;
      },
      applyLoaded: () => {
        delivered = true;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    expect(findByClass(root, "palette-artifact-create-canvas")).not.toBeNull();
    expect(findByClass(root, "palette-artifact-create-handle")?.textContent)
      .toBe("@repo-policy");
    expect(textOf(root)).toContain("Persistent context in Personal Library");
    expect(textOf(root)).toContain("Context text required.");
    expect(textOf(root)).not.toContain("Show in Palette");
    expect(textOf(root)).not.toContain("Confirm before delivery");
    expect(findAllByTag(root, "button").map(textOf)).not.toContain("Use template");

    const optionLabels = findAllByClass(root, "palette-artifact-create-chip").map(textOf);
    expect(optionLabels).toEqual([
      "TypeContext",
      "DestinationPersonal Library",
      "ProjectNone",
      "Advanced Editor",
    ]);

    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    textarea.value = "This repository prefers small patches and local-first defaults.";
    textarea.dispatch("input", keyEvent("input"));
    expect(textOf(root)).toContain("Ready to create @repo-policy.");

    findByClass(root, "palette-artifact-create-canvas")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(saved?.id).toBe("repo-policy");
    expect(saved?.title).toBe("Repo Policy");
    expect(saved?.artifact_type).toBe("context");
    expect(saved?.scope).toBe("persistent");
    expect(saved?.pinned).toBe(false);
    expect(saved?.confirm).toBe(false);
    expect(saved?.contexts).toEqual([]);
    expect(saved?.template_arguments).toEqual([]);
    expect(saved?.prompt).toBe(
      "This repository prefers small patches and local-first defaults.",
    );
    expect(Object.keys(saved as unknown as Record<string, unknown>).sort()).toEqual([
      "artifact_type",
      "confirm",
      "contexts",
      "description",
      "id",
      "pinned",
      "prompt",
      "scope",
      "shortcut",
      "template_arguments",
      "title",
    ]);
    expect(delivered).toBe(false);
  });

  test("create canvas renders safe bottom option defaults without project reads", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: null,
    };
    let saved: PromptDefinition | null = null;
    let projectRead = false;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
      previewProjectArtifactWrite: async () => {
        projectRead = true;
      },
      previewProjectSetup: async () => {
        projectRead = true;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const optionLabels = findAllByClass(root, "palette-artifact-create-chip").map(textOf);
    expect(optionLabels).toEqual([
      "TypePrompt",
      "DestinationPersonal Library",
      "ProjectNone",
      "Show in PaletteOff",
      "Confirm before deliveryOff",
      "Advanced Editor",
    ]);
    expect(textOf(root)).not.toContain("Schedule");
    expect(textOf(root)).not.toContain("Automation");
    expect(textOf(root)).not.toContain("Daily");

    const projectButtons = findAllByTag(root, "button").filter((button) =>
      textOf(button) === "ProjectNone"
    );
    expect(projectButtons).toEqual([]);
    expect(findAllByClass(root, "palette-artifact-create-chip").find((chip) =>
      textOf(chip) === "ProjectNone"
    )?.title).toBe("Project writes stay in explicit Project Setup flows.");

    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    textarea.value = "Create a local prompt without reading project files.";
    textarea.dispatch("input", keyEvent("input"));
    findByClass(root, "palette-artifact-create-canvas")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    const savedRecord = saved as unknown as Record<string, unknown>;
    expect(projectRead).toBe(false);
    expect(savedRecord.project).toBeUndefined();
    expect(savedRecord.projectSelection).toBeUndefined();
    expect(savedRecord.registry_source_path).toBeUndefined();
  });

  test("create canvas focus order starts with authoring before auxiliary controls", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: "focus-order",
      initialBody: "Keep focus order aligned with authoring.",
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(focusableLabels(root)).toEqual([
      "input:Prompt title",
      "textarea:Tell the agent what to do...",
      "button:Creation info",
      "button:Use template",
      "button:Close",
      "input:showInPalette",
      "input:confirmBeforeDelivery",
      "button:Open Advanced Editor",
      "button:Cancel",
      "button:Create and Load",
      "button:Create",
    ]);
  });

  test("create canvas option toggles update only prompt delivery defaults", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: "guarded-prompt",
    };
    let saved: PromptDefinition | null = null;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    const showInPalette = findAllByTag(root, "input").find((input) =>
      input.name === "showInPalette"
    );
    const confirmBeforeDelivery = findAllByTag(root, "input").find((input) =>
      input.name === "confirmBeforeDelivery"
    );
    expect(showInPalette).not.toBeNull();
    expect(confirmBeforeDelivery).not.toBeNull();

    textarea.value = "Confirm with me before this prompt is delivered.";
    textarea.dispatch("input", keyEvent("input"));
    showInPalette!.checked = true;
    showInPalette!.dispatch("input", keyEvent("input"));
    confirmBeforeDelivery!.checked = true;
    confirmBeforeDelivery!.dispatch("input", keyEvent("input"));
    expect(textOf(root)).toContain("Show in PaletteOn");
    expect(textOf(root)).toContain("Confirm before deliveryOn");

    findByClass(root, "palette-artifact-create-canvas")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(saved?.id).toBe("guarded-prompt");
    expect(saved?.pinned).toBe(true);
    expect(saved?.confirm).toBe(true);
    expect(saved?.scope).toBe("persistent");
    expect(saved?.contexts).toEqual([]);
  });

  test("create canvas template picker applies only local built-in templates", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: null,
    };
    let saved: PromptDefinition | null = null;
    let projectRead = false;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
      previewProjectArtifactWrite: async () => {
        projectRead = true;
      },
      previewProjectSetup: async () => {
        projectRead = true;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const useTemplate = findAllByTag(root, "button").find((button) =>
      textOf(button) === "Use template"
    );
    expect(useTemplate?.disabled).toBe(false);
    useTemplate?.dispatch("click", keyEvent("click"));
    const rows = findAllByClass(root, "palette-artifact-create-template-row").map(textOf);
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.includes("Local"))).toEqual([true, true, true, true, true]);
    expect(rows[0]).toContain("Code Review");
    expect(rows[1]).toContain("Debug");
    expect(rows[2]).toContain("Implementation Plan");
    expect(rows[3]).toContain("Summary");
    expect(rows[4]).toContain("Scoped Task");
    expect(rows[0]).toContain("Review the current change");
    expect(rows[1]).toContain("Diagnose the failure");
    expect(textOf(root)).not.toContain("Remote");
    expect(textOf(root)).not.toContain("Project template");

    findAllByClass(root, "palette-artifact-create-template-row")[0]
      ?.dispatch("click", keyEvent("click"));
    const title = findByClass(root, "palette-artifact-create-title") as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    expect(title.value).toBe("Code Review");
    expect(textarea.value).toContain("Review the current change as if it came from someone else.");
    expect(textOf(root)).toContain("Filled from Code Review template.");
    expect(findByClass(root, "palette-artifact-create-template-picker")).toBeNull();

    findByClass(root, "palette-artifact-create-canvas")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(saved?.id).toBe("code-review");
    expect(saved?.title).toBe("Code Review");
    expect(saved?.prompt).toContain("Review the current change as if it came from someone else.");
    expect(projectRead).toBe(false);
  });

  test("create canvas template picker cancel preserves draft edits", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: null,
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const title = findByClass(root, "palette-artifact-create-title") as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    title.value = "Custom Prompt";
    textarea.value = "Keep my draft intact.";
    title.dispatch("input", keyEvent("input"));
    textarea.dispatch("input", keyEvent("input"));

    findAllByTag(root, "button").find((button) =>
      textOf(button) === "Use template"
    )?.dispatch("click", keyEvent("click"));
    expect(findByClass(root, "palette-artifact-create-template-picker")).not.toBeNull();
    findAllByTag(root, "button").find((button) =>
      textOf(button) === "Cancel" && button.parent?.classList.contains("palette-artifact-create-template-header")
    )?.dispatch("click", keyEvent("click"));

    expect(findByClass(root, "palette-artifact-create-template-picker")).toBeNull();
    expect(title.value).toBe("Custom Prompt");
    expect(textarea.value).toBe("Keep my draft intact.");
  });

  test("create canvas template application appends without overwriting existing draft", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: null,
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const title = findByClass(root, "palette-artifact-create-title") as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    title.value = "Custom Debug";
    textarea.value = "Start from this failure.";
    title.dispatch("input", keyEvent("input"));
    textarea.dispatch("input", keyEvent("input"));

    findAllByTag(root, "button").find((button) =>
      textOf(button) === "Use template"
    )?.dispatch("click", keyEvent("click"));
    findAllByClass(root, "palette-artifact-create-template-row")[1]
      ?.dispatch("click", keyEvent("click"));

    expect(title.value).toBe("Custom Debug");
    expect(textarea.value).toStartWith("Start from this failure.\n\nDiagnose the failure before changing code.");
    expect(textOf(root)).toContain("Appended Debug template after existing prompt.");
  });

  test("create canvas derives title and handle from the prompt body without delivery", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: null,
    };
    let saved: PromptDefinition | null = null;
    let delivered = false;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (_originalId, draft) => {
        saved = draft;
      },
      loadSelected: () => {
        delivered = true;
      },
      selectAndLoad: () => {
        delivered = true;
      },
      applyLoaded: () => {
        delivered = true;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    textarea.value = "Review rollout carefully. Keep the patch scoped.";
    textarea.dispatch("input", keyEvent("input"));
    expect(findByClass(root, "palette-artifact-create-handle")?.textContent)
      .toBe("#review-rollout-carefully");

    findByClass(root, "palette-artifact-create-canvas")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(saved?.id).toBe("review-rollout-carefully");
    expect(saved?.title).toBe("Review Rollout Carefully");
    expect(saved?.prompt).toBe("Review rollout carefully. Keep the patch scoped.");
    expect(delivered).toBe(false);
  });

  test("create canvas can start from promoted Scratch body text", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: null,
      initialBody: "Promote this scratch draft into a reusable prompt.",
    };

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    expect(textarea.value).toBe("Promote this scratch draft into a reusable prompt.");
    expect(findByClass(root, "palette-artifact-create-handle")?.textContent)
      .toBe("#promote-this-scratch-draft-into-a-reusable-prompt");
    expect(textOf(root)).toContain(
      "Ready to create #promote-this-scratch-draft-into-a-reusable-prompt.",
    );
  });

  test("create canvas keeps the advanced composer reachable", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "create",
      artifactType: "prompt",
      initialId: "review-patch",
    };
    const opened: Array<{
      kind: string;
      artifactType: string;
      artifactId?: string | null;
      initialId?: string | null;
      initialDraft?: PromptDefinition | null;
    }> = [];

    renderPromptPalette(palette, actions({
      openArtifactComposer: (kind, artifactType, artifactId, initialId, initialDraft) => {
        opened.push({ kind, artifactType, artifactId, initialId, initialDraft });
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const textarea = findByClass(root, "palette-artifact-create-text") as FakeElement;
    textarea.value = "Preserve this prompt body in advanced editing.";
    const advanced = findAllByTag(root, "button").find((button) =>
      textOf(button) === "Advanced Editor"
    );
    advanced?.dispatch("click", keyEvent("click"));

    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      kind: "new",
      artifactType: "prompt",
      artifactId: null,
      initialId: "review-patch",
      initialDraft: {
        id: "review-patch",
        prompt: "Preserve this prompt body in advanced editing.",
      },
    });
  });

  test("renders Advanced Editor and saves detected prompt arguments", async () => {
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
    expect(textOf(root)).toContain("Advanced Editor");
    expect(textOf(root)).toContain("Handle Override");
    expect(textOf(root)).toContain("Raw Prompt Body");
    expect(textOf(root)).toContain("Argument Schema");
    expect(textOf(root)).toContain("Context Dependencies");
    expect(textOf(root)).toContain("Delivery Defaults");
    expect(textOf(root)).toContain("Advanced Metadata");
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

  test("Advanced Editor edit round-trips identity dependencies and delivery defaults", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.launcherArtifactPanel = {
      mode: "composer",
      kind: "edit",
      artifactType: "prompt",
      artifactId: "review-patch",
    };
    palette.prompts = [
      {
        ...prompt(0),
        id: "review-patch",
        title: "Review Patch",
        description: "Old description",
        prompt: "Review {{old_arg}}.",
        contexts: ["context-1"],
        pinned: false,
        confirm: false,
      },
      context(1),
      context(2),
    ];
    let savedOriginalId: string | null | undefined;
    let saved: PromptDefinition | null = null;

    renderPromptPalette(palette, actions({
      saveArtifactDraft: async (originalId, draft) => {
        savedOriginalId = originalId;
        saved = draft;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const title = findByClass(root, "palette-artifact-composer-title") as FakeElement;
    const handle = findByClass(root, "palette-artifact-composer-handle") as FakeElement;
    const description = findByClass(root, "palette-artifact-composer-description") as FakeElement;
    const textarea = findByClass(root, "palette-artifact-composer-text") as FakeElement;
    title.value = "Advanced Review Patch";
    handle.value = "advanced-review-patch";
    description.value = "New advanced description";
    textarea.value = "Review {{argument_1}} with @context.";
    title.dispatch("input", keyEvent("input"));
    handle.dispatch("input", keyEvent("input"));
    description.dispatch("input", keyEvent("input"));
    textarea.dispatch("input", keyEvent("input"));

    setLabelCheckbox(root, "Context 1", false);
    setLabelCheckbox(root, "Context 2", true);
    setLabelCheckbox(root, "Show in Palette", true);
    setLabelCheckbox(root, "Confirm before delivery", true);

    findByClass(root, "palette-artifact-composer")
      ?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(savedOriginalId).toBe("review-patch");
    expect(saved?.id).toBe("advanced-review-patch");
    expect(saved?.title).toBe("Advanced Review Patch");
    expect(saved?.description).toBe("New advanced description");
    expect(saved?.prompt).toBe("Review {{argument_1}} with @context.");
    expect(saved?.contexts).toEqual(["context-2"]);
    expect(saved?.pinned).toBe(true);
    expect(saved?.confirm).toBe(true);
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

  test("renders skill scaffold before handing a SKILL.md draft to Advanced Editor", async () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "search";
    palette.prompts = [{
      ...prompt(1),
      id: "diagnose-agent-loop",
      artifact_type: "skill",
    }];
    palette.launcherArtifactPanel = {
      mode: "skill-scaffold",
      initialId: "diagnose-agent-loop",
    };
    let imported = 0;
    let composer:
      | {
        kind: string;
        artifactType: string;
        initialId?: string | null;
        initialDraft?: PromptDefinition | null;
      }
      | null = null;

    renderPromptPalette(palette, actions({
      openGitHubImport: () => {
        imported += 1;
      },
      openArtifactComposer: (kind, artifactType, _artifactId, initialId, initialDraft) => {
        composer = { kind, artifactType, initialId, initialDraft };
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const shell = findByClass(root, "palette-artifact-panel");
    expect(shell).not.toBeNull();
    expect(findByClass(root, "palette-skill-scaffold-body")).not.toBeNull();
    expect(textOf(root)).toContain("Create Skill");
    expect(textOf(root)).toContain("SKILL.md Body Or Template");
    expect(textOf(root)).toContain("Optional Import Source");
    expect(textOf(root)).toContain("~/.ult/personal-library/persistent/skills/<handle>/SKILL.md");
    expect(textOf(root)).toContain("Project Setup / Install Skill to Project preview");
    expect(textOf(root)).toContain("Never loaded as prompt text by default");
    expect(textOf(root)).not.toContain("Load Prompt");

    const inputs = findAllByTag(root, "input");
    const name = inputs.find((input) => input.name === "skillName");
    const description = inputs.find((input) => input.name === "skillDescription");
    const importSource = inputs.find((input) => input.name === "skillImportSource");
    const body = findByTag(root, "textarea");
    expect(name?.value).toBe("Diagnose Agent Loop");
    name!.value = "Diagnose Agent Loop";
    description!.value = "Debug loops with explicit local context.";
    body!.value = "# Diagnose Agent Loop\n\nUse logs and visible failures only.";
    importSource!.value = "taehalim/diagnose-skill";

    const importButton = findAllByTag(root, "button").find((button) =>
      textOf(button) === "Open Import Preview"
    );
    importButton?.dispatch("click", keyEvent("click"));
    expect(imported).toBe(1);

    const form = findByClass(root, "palette-skill-scaffold-form");
    form?.dispatch("submit", keyEvent("submit"));
    await Promise.resolve();

    expect(composer?.kind).toBe("new");
    expect(composer?.artifactType).toBe("skill");
    expect(composer?.initialId).toBe("diagnose-agent-loop-2");
    expect(composer?.initialDraft).toMatchObject({
      id: "diagnose-agent-loop-2",
      title: "Diagnose Agent Loop",
      artifact_type: "skill",
      scope: "persistent",
      pinned: false,
      description: "Debug loops with explicit local context.",
      prompt: "# Diagnose Agent Loop\n\nUse logs and visible failures only.",
      contexts: [],
      shortcut: null,
      confirm: false,
      template_arguments: [],
      source: "user",
    });
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

function focusableLabels(root: FakeElement) {
  const labels: string[] = [];
  collectFocusableLabels(root, labels);
  return labels;
}

function collectFocusableLabels(element: FakeElement, labels: string[]) {
  if (isFocusable(element)) {
    labels.push(focusableLabel(element));
  }
  for (const child of element.children) {
    if (child instanceof FakeElement) {
      collectFocusableLabels(child, labels);
    }
  }
}

function isFocusable(element: FakeElement) {
  if (element.disabled) return false;
  return ["button", "input", "textarea"].includes(element.tagName.toLowerCase());
}

function focusableLabel(element: FakeElement) {
  const tag = element.tagName.toLowerCase();
  if (tag === "input") {
    return `input:${element.name || element.placeholder}`;
  }
  if (tag === "textarea") {
    return `textarea:${element.placeholder}`;
  }
  return `button:${element.getAttribute("aria-label") || textOf(element)}`;
}

function setLabelCheckbox(root: FakeElement, labelText: string, checked: boolean) {
  const label = findAllByTag(root, "label").find((entry) =>
    textOf(entry).includes(labelText)
  );
  const input = label ? findByTag(label, "input") : null;
  expect(input).not.toBeNull();
  input!.checked = checked;
  input!.dispatch("input", keyEvent("input"));
}
