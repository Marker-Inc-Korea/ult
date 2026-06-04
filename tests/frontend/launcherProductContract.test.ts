import { describe, expect, test } from "bun:test";

import { EXTERNAL_SKILL_DISCOVERY_SOURCES } from "../../src/data/externalSkillDiscovery";
import { STARTER_PACKS } from "../../src/data/starterPacks";
import workflowPacks from "../../src/data/agent-workflow-packs.json";
import {
  launcherCommandCapability,
  launcherCommandDefinitions,
} from "../../src/overlay/launcher/launcherCommandCapabilities";
import { launcherCommandsForSearch, type LauncherCommand } from "../../src/overlay/launcher/launcherCommands";
import {
  commandPrimaryAction,
  commandSectionLabel,
} from "../../src/overlay/launcher/searchCommandPresentation";
import { runLauncherCommand } from "../../src/overlay/launcher/searchController";
import type { PromptDefinition, UserLauncherCommandDefinition } from "../../src/types";
import {
  context,
  fakeElement,
  prompt as promptArtifact,
  runtime,
} from "./support/paletteRuntimeHarness";
import {
  readOptionalText,
  readPromptCommandSources,
  readSources,
  readText,
} from "./support/nativeContract";

function commandsForQuery(
  query: string,
  prompts: PromptDefinition[] = [],
  userCommands: UserLauncherCommandDefinition[] = [],
) {
  const palette = runtime(0);
  palette.searchQuery = query;
  palette.prompts = prompts;
  palette.userCommands = userCommands;
  return launcherCommandsForSearch(palette, false);
}

function commandById(commands: LauncherCommand[], id: LauncherCommand["id"]) {
  const command = commands.find((entry) => entry.id === id);
  expect(command).toBeDefined();
  return command!;
}

describe("Launcher product contract", () => {
  test("keeps Launcher as a single menu-bar entry", () => {
    const tray = readText("src-tauri/src/tray_menu.rs");
    const readme = readText("README.md");
    const normalizedReadme = readme.replace(/\s+/g, " ");
    const spec = readOptionalText("SPEC.md");
    const design = readOptionalText("DESIGN.md");
    const normalizedSpec = spec?.replace(/\s+/g, " ") ?? "";

    expect(tray).toContain('"Open Launcher..."');
    expect(tray).not.toContain('"Search..."');
    expect(tray).not.toContain('"Scratch Prompt..."');
    expect(normalizedReadme).toContain("menu-bar app");
    expect(normalizedReadme).toContain("Artifact management lives in Launcher");
    expect(normalizedReadme).toContain("Launcher is the main command surface");
    expect(readme).toContain("| `#` | Prompt |");
    expect(readme).toContain("| `@` | Context |");
    expect(readme).toContain("| `$` | Skill |");
    expect(readme).toContain("| `/` | Launcher command |");
    expect(normalizedReadme).toContain("Search matches handles, titles, command aliases");
    expect(normalizedReadme).toContain("does not full-text search prompt bodies");
    expect(normalizedReadme).toContain("Project Setup all require a target directory");
    expect(normalizedReadme).toContain("Pressing `Enter` does not deliver from loaded state");

    if (spec && design) {
      expect(spec).toContain("Search and Scratch MUST remain Launcher modes");
      expect(spec).toContain("one stable LauncherFrame");
      expect(normalizedSpec).toContain("MUST NOT read terminal output, shell history, source files");
      expect(spec).toContain("User-defined Launcher command rows");
      expect(design).toContain("LauncherFrame contract");
      expect(design).toContain("User-defined Launcher commands");
    }
  });

  test("documents cursor-adjacent Palette and loaded state as handle-first surfaces", () => {
    const readme = readText("README.md");
    const spec = readOptionalText("SPEC.md");
    const design = readOptionalText("DESIGN.md");
    const docs = [readme, spec, design].filter((source): source is string => Boolean(source));
    const normalizedDocs = docs.map((source) => source.replace(/\s+/g, " "));
    const normalizedReadme = readme.replace(/\s+/g, " ");
    const normalizedSpec = spec?.replace(/\s+/g, " ") ?? "";
    const normalizedDesign = design?.replace(/\s+/g, " ") ?? "";

    expect(normalizedReadme).toContain("Palette is cursor-adjacent");
    expect(normalizedReadme).toContain("persistent pinned prompts only");
    expect(normalizedReadme).toContain("compact loaded card near the cursor");
    expect(normalizedReadme).toContain("loaded handle, target-click state, and delivery mode");
    if (spec && design) {
      expect(normalizedSpec).toContain("show only the canonical `#handle`");
      expect(normalizedSpec).toContain("compact fixed cursor-adjacent handle card");
      expect(normalizedDesign).toContain("fixed one-row handle card");
    }

    for (const source of normalizedDocs) {
      expect(source).not.toContain("compact two-line cursor-adjacent badge");
      expect(source).not.toContain("prompt title as primary");
      expect(source).not.toContain("prompt title as the primary label");
      expect(source).not.toContain("title-first with the prompt handle");
      expect(source).not.toContain("readable title/details");
      expect(source).not.toContain("handle plus readable title/details");
      expect(source).not.toContain("readable title/details when available");
      expect(source).not.toContain("Use a two-line compact badge");
    }
  });

  test("removes legacy slash prompt aliases from active product surfaces", () => {
    const activeSources = readSources([
      "src/promptUtils.ts",
      "src/searchComposer.ts",
      "src/overlay/launcher/searchState.ts",
      "src/overlay/launcher/searchResultsSurface.ts",
      "src/overlay/launcher/artifactActionsPanelSurface.ts",
      "src/overlay/launcher/artifactReaderPanelSurface.ts",
      "src/overlay/launcher/githubImportPanelSurface.ts",
      "src/overlay/launcher/libraryRows.ts",
      "src/overlay/launcher/projectSetupPanelSurface.ts",
      "src/overlay/launcher/projectWritePanelSurface.ts",
      "src/overlay/launcher/recoveryPanelSurface.ts",
      "src/overlay/loaded/loadedSurface.ts",
      "src/overlay/palette/paletteSurface.ts",
    ]);

    expect(activeSources).not.toContain("legacyPromptArtifactHandle");
    expect(activeSources).not.toContain("legacyPromptId");
    expect(activeSources).not.toContain("legacyPromptMatchesSearch");
    expect(activeSources).not.toContain("legacySlashPromptFeedback");
    expect(activeSources).not.toContain("Use #");
  });

  test("documents Launcher as command palette plus local library browser", () => {
    const readme = readText("README.md");
    const spec = readOptionalText("SPEC.md");
    const design = readOptionalText("DESIGN.md");
    const manual = readOptionalText("docs/MANUAL_CHECKS.md");
    const normalizedReadme = readme.replace(/\s+/g, " ");
    const normalizedSpec = spec?.replace(/\s+/g, " ") ?? "";
    const normalizedDesign = design?.replace(/\s+/g, " ") ?? "";
    const normalizedManual = manual?.replace(/\s+/g, " ") ?? "";

    expect(normalizedReadme).toContain("Launcher is the main command surface");
    expect(normalizedReadme).toContain("library browsing");
    expect(normalizedReadme).toContain("Browse Library");
    expect(normalizedReadme).toContain("Library rows are metadata-first");
    expect(normalizedReadme).toContain("Skills are source-oriented packages");
    if (spec && design && manual) {
      expect(normalizedSpec).toContain("Launcher is both a command palette and a local library browser");
      expect(normalizedSpec).toContain("Launcher Library SHOULD optimize for browsing local inventory");
      expect(design).toContain("Launcher-owned inventory");
      expect(normalizedDesign).toContain("Project Write preview as an explicit secondary action");
      expect(manual).toContain("Launcher Library Inventory Matrix");
      expect(normalizedManual).toContain("The skill never loads into the prompt delivery surface");
    }
  });

  test("documents and exposes local user-defined Launcher commands", () => {
    const readme = readText("README.md");
    const normalizedReadme = readme.replace(/\s+/g, " ");
    const spec = readOptionalText("SPEC.md");
    const design = readOptionalText("DESIGN.md");
    const command: UserLauncherCommandDefinition = {
      id: "review-repo",
      title: "Review Repo",
      description: "Review the current change with repo policy.",
      prompt_id: "prompt-1",
      contexts: ["context-2"],
      variable_values: { branch: "main" },
      keywords: ["diff", "review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
    };

    expect(readme).toContain("commands/<handle>/COMMAND.md");
    expect(readme).toContain("[variables]");
    expect(normalizedReadme).toContain("bind local prompts and contexts into reusable Launcher commands");
    if (spec && design) {
      expect(spec).toContain("User-Defined Launcher Command");
      expect(spec).toContain("~/.ult/personal-library/persistent/commands/<handle>/COMMAND.md");
      expect(spec).toContain("MUST NOT index that body");
      expect(design).toContain("Persistent Launcher commands");
      expect(design).toContain("referenced local prompt with its default");
    }

    const home = commandsForQuery("", [], [command]);
    expect(home.map((entry) => entry.id)).toContain("user-command");
    const row = commandById(commandsForQuery("rr", [], [command]), "user-command");
    expect(row.category).toBe("Command");
    expect(row.aliases).toContain("rr");
    expect(row.keywords).toEqual(
      expect.arrayContaining(["review", "prompt-1", "context-2"]),
    );
    expect(row.privacyLabel).toContain("referenced local artifacts");

    const generatedDescription = commandById(commandsForQuery("quiet", [], [{
      ...command,
      id: "quiet",
      title: "Quiet Command",
      description: "",
      keywords: ["quiet"],
    }]), "user-command");
    expect(generatedDescription.description).toBe("Run #prompt-1.");
    expect(generatedDescription.keywords).toContain("prompt-1");
    expect(generatedDescription.keywords).not.toContain("#prompt-1");
  });

  test("exposes useful command metadata and aliases for Launcher home", () => {
    const workflowSource = readText("src/overlay/launcher/agentWorkflowCommands.ts");
    expect(workflowPacks.map((pack) => pack.id)).toEqual([
      "workflow-review-current-change",
      "workflow-fix-failing-tests",
      "workflow-plan-next-step",
      "workflow-write-pr-description",
      "workflow-rescue-stuck-agent",
      "workflow-summarize-thread",
    ]);
    expect(workflowSource).toContain("agent-workflow-packs.json");
    expect(workflowSource).not.toContain("Review the current change using only");

    const homeIds = commandsForQuery("").map((entry) => entry.id);
    expect(homeIds).toEqual([
      "browse-library",
      "scratch",
      "add-prompt",
      "workflow-review-current-change",
      "project-setup",
      "preferences",
    ]);
    expect(homeIds.length).toBeLessThanOrEqual(7);
    expect(homeIds).not.toEqual(expect.arrayContaining([
      "browse-prompts",
      "browse-contexts",
      "browse-skills",
      "browse-commands",
      "capture-clipboard",
      "add-context",
      "add-skill",
      "workflow-fix-failing-tests",
      "workflow-plan-next-step",
      "workflow-write-pr-description",
      "workflow-rescue-stuck-agent",
      "workflow-summarize-thread",
      "import-github",
      "browse-packs",
      "open-library",
    ]));

    const browseLibrary = commandById(commandsForQuery("library"), "browse-library");
    expect(browseLibrary.category).toBe("Library");
    expect(browseLibrary.homePlacement).toBe("home");
    expect(browseLibrary.privacyLabel).toContain("handles, titles");
    const browsePrompts = commandById(commandsForQuery("browse prompts"), "browse-prompts");
    expect(browsePrompts.category).toBe("Library");
    expect(browsePrompts.privacyLabel).toContain("handles, titles");
    expect(commandById(commandsForQuery("installed skills"), "browse-skills").privacyLabel)
      .toContain("source metadata");
    expect(commandById(commandsForQuery("command library"), "browse-commands").privacyLabel)
      .toContain("command titles");

    const importCommand = commandById(commandsForQuery("gh"), "import-github");
    expect(importCommand.category).toBe("Import");
    expect(importCommand.homePlacement).toBe("search");
    expect(importCommand.aliases).toContain("gh import");

    expect(commandsForQuery("새 프롬프트").map((entry) => entry.id)).toContain("add-prompt");
    expect(commandsForQuery("새 컨텍스트").map((entry) => entry.id)).toContain("add-context");
    expect(commandsForQuery("새 스킬").map((entry) => entry.id)).toContain("add-skill");
    expect(commandsForQuery("agent control").map((entry) => entry.id)).toContain("browse-packs");
    expect(commandsForQuery("가져오기").map((entry) => entry.id)).toContain("import-github");
    expect(commandsForQuery("프로젝트 설치").map((entry) => entry.id)).toContain("project-setup");
    expect(commandById(commandsForQuery("review current"), "workflow-review-current-change").category)
      .toBe("Workflow");
    expect(commandById(commandsForQuery("next step"), "workflow-plan-next-step").homePlacement)
      .toBe("search");
    expect(commandById(commandsForQuery("fix failing tests @repo-policy"), "workflow-fix-failing-tests").privacyLabel)
      .toContain("reads no terminal");
    expect(commandById(commandsForQuery("turn clipboard"), "clipboard-to-context").label)
      .toBe("Turn Clipboard into Context");
    expect(commandById(commandsForQuery("last prompt"), "run-last-prompt").privacyLabel)
      .toContain("usage metadata");
    const clipboardStackCommand = commandById(commandsForQuery("recent contexts"), "open-recent-context-stack");
    expect(clipboardStackCommand.label).toBe("Open Clipboard Stack");
    expect(clipboardStackCommand.category).toBe("Clipboard");
    expect(clipboardStackCommand.privacyLabel).toContain("clipboard contexts");
    expect(commandById(commandsForQuery("clear expired"), "clear-expired-contexts").privacyLabel)
      .toContain("expired ephemeral context files");
    expect(commandById(commandsForQuery("failed delivery"), "reveal-last-failed-delivery").privacyLabel)
      .toContain("artifact id");
    expect(commandsForQuery("").map((entry) => entry.id)).not.toContain("discover-skills");
    expect(commandById(commandsForQuery("discover skills"), "discover-skills").privacyLabel)
      .toContain("sends no local project");
    expect(commandById(commandsForQuery("skills.sh"), "discover-skills").category)
      .toBe("Import");
    expect(commandById(commandsForQuery("find agent skills"), "find-agent-skills").privacyLabel)
      .toContain("Does not send project contents");
    expect(commandById(commandsForQuery("install agent skill"), "install-agent-skill").privacyLabel)
      .toContain("Does not run external installers");
    expect(commandById(commandsForQuery("review installed skills"), "review-installed-skills").category)
      .toBe("Library");
    expect(EXTERNAL_SKILL_DISCOVERY_SOURCES.map((source) => source.source)).toContain("https://www.skills.sh/");
    expect(EXTERNAL_SKILL_DISCOVERY_SOURCES.map((source) => source.exactCommand))
      .toContain("npx skills add <owner/repo> (not run by Ult)");
    expect(STARTER_PACKS.map((pack) => pack.title)).toEqual([
      "Agent Control",
      "PR Review",
      "Debugging",
      "Planning",
      "Release Prep",
    ]);
    expect(STARTER_PACKS.every((pack) => pack.sourceUrl.startsWith("https://github.com/")))
      .toBe(true);
  });

  test("routes command presentation and execution through the capability registry", () => {
    const command = {
      id: "review-repo",
      title: "Review Repo",
      description: "Review with repo policy.",
      prompt_id: "prompt-1",
      contexts: ["context-2"],
      variable_values: {},
      keywords: ["review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
    } satisfies UserLauncherCommandDefinition;
    const skill = {
      ...promptArtifact(3),
      id: "diagnose",
      title: "Diagnose",
      artifact_type: "skill",
      prompt: "---\nname: diagnose\n---\n\nSkill body.",
    } satisfies PromptDefinition;
    const surfacedCommands = [
      ...commandsForQuery("", [promptArtifact(1)], [command]),
      ...commandsForQuery("plain text"),
      ...commandsForQuery("/missing"),
      ...commandsForQuery("@missing"),
      ...commandsForQuery("$missing"),
      ...commandsForQuery("$diag", [skill]),
      ...commandsForQuery("project setup"),
      ...commandsForQuery("discover skills"),
      ...commandsForQuery("review installed skills"),
    ];
    const definitionIds = new Set(launcherCommandDefinitions().map((definition) => definition.id));

    for (const surfaced of surfacedCommands) {
      expect(definitionIds).toContain(surfaced.id);
      expect(commandPrimaryAction(surfaced).length).toBeGreaterThan(0);
      expect(commandSectionLabel(surfaced).length).toBeGreaterThan(0);
      expect(typeof launcherCommandCapability(surfaced).execute).toBe("function");
    }

    const projectSetup = commandById(surfacedCommands, "project-setup");
    const effects = launcherCommandCapability(projectSetup).execute({
      palette: runtime(0),
      command: projectSetup,
    });

    expect(commandPrimaryAction(projectSetup)).toBe("Choose Project");
    expect(commandSectionLabel(projectSetup)).toBe("Project");
    expect(effects).toEqual({
      type: "open-project-setup",
      fallbackQuery: "project",
      fallbackMessage: "Choose a project command to preview exact files before writing.",
    });

    const missingPromptCommand = commandById(commandsForQuery("rr", [], [{
      ...command,
      prompt_id: "missing-prompt",
      contexts: [],
    }]), "user-command");
    expect(launcherCommandCapability(missingPromptCommand).execute({
      palette: runtime(0),
      command: missingPromptCommand,
    })).toEqual([
      {
        type: "feedback",
        message: "Command prompt #missing-prompt is no longer available.",
        tone: "warning",
      },
      { type: "rerender" },
    ]);

    const discoverSkills = commandById(surfacedCommands, "discover-skills");
    expect(commandPrimaryAction(discoverSkills)).toBe("Open Gate");
    expect(launcherCommandCapability(discoverSkills).execute({
      palette: runtime(0),
      command: discoverSkills,
    })).toEqual({
      type: "open-skill-discovery",
      intent: "discover",
    });

    const reviewSkills = commandById(surfacedCommands, "review-installed-skills");
    expect(commandPrimaryAction(reviewSkills)).toBe("Review Skills");
    expect(launcherCommandCapability(reviewSkills).execute({
      palette: runtime(0),
      command: reviewSkills,
    })).toEqual({
      type: "open-library-mode",
      filter: "skills",
    });
  });

  test("keeps command runtime split behind registry capabilities and effects", () => {
    const definitionIds = launcherCommandDefinitions().map((definition) => definition.id);
    expect(definitionIds).toContain("capture-clipboard");
    expect(definitionIds).toContain("project-setup");
    expect(definitionIds).toContain("user-command");

    const palette = runtime(0);
    palette.prompts = [promptArtifact(1), context(2)];
    palette.userCommands = [{
      id: "review-repo",
      title: "Review Repo",
      description: "Review with repo policy.",
      prompt_id: "prompt-1",
      contexts: ["context-2"],
      variable_values: {},
      keywords: ["review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
      source_path: "/Users/taeha/.ult/personal-library/persistent/commands/review-repo/COMMAND.md",
    }];

    const surfacedCommands = [
      ...commandsForQuery("capture clipboard", palette.prompts, palette.userCommands),
      ...commandsForQuery("project setup", palette.prompts, palette.userCommands),
      ...commandsForQuery("review repo", palette.prompts, palette.userCommands),
    ];
    expect(surfacedCommands.length).toBeGreaterThan(0);

    for (const command of surfacedCommands) {
      const capability = launcherCommandCapability(command);
      expect(capability.primaryAction(command).trim()).not.toBe("");
      const result = capability.execute({ palette, command });
      const effects = Array.isArray(result) ? result : result ? [result] : [];
      for (const effect of effects) {
        expect(effect.type.trim()).not.toBe("");
      }
    }
  });

  test("keeps command handlers behind delivery, project-write, and privacy guardrail effects", () => {
    const prompt = promptArtifact(1);
    const contextArtifact = context(2);
    const skill = {
      ...promptArtifact(3),
      id: "diagnose",
      artifact_type: "skill" as const,
      title: "Diagnose",
    };
    const userCommand: UserLauncherCommandDefinition = {
      id: "review-repo",
      title: "Review Repo",
      description: "Review with repo policy.",
      prompt_id: prompt.id,
      contexts: [contextArtifact.id],
      variable_values: { branch: "main" },
      keywords: ["review"],
      aliases: ["rr"],
      actions: ["prepare"],
      home: true,
    };
    const palette = runtime(0);
    palette.prompts = [prompt, contextArtifact, skill];
    palette.searchQuery = "@context-2";

    const command = commandById(
      commandsForQuery("rr @context-2", palette.prompts, [userCommand]),
      "user-command",
    );
    expect(launcherCommandCapability(command).execute({ palette, command })).toEqual({
      type: "prepare-prompt",
      prompt,
      contextIds: [contextArtifact.id],
      options: {
        templateValues: { branch: "main" },
      },
    });

    const unsupportedCommand = commandById(commandsForQuery("rr", palette.prompts, [{
      ...userCommand,
      actions: ["open-panel" as never],
    }]), "user-command");
    expect(launcherCommandCapability(unsupportedCommand).execute({
      palette,
      command: unsupportedCommand,
    })).toEqual([
      {
        type: "feedback",
        message: "Command does not support prompt preparation.",
        tone: "warning",
      },
      { type: "rerender" },
    ]);

    const projectCommand = commandById(
      commandsForQuery("project prompt", palette.prompts),
      "export-prompt-project",
    );
    expect(launcherCommandCapability(projectCommand).execute({
      palette,
      command: projectCommand,
    })).toEqual({
      type: "open-project-write",
      writeKind: "prompt",
      artifactType: "prompt",
      artifactId: undefined,
      unavailableMessage: "Select a prompt before exporting it to a project.",
      fallbackMessage: "Project write opens in Launcher.",
    });

    const skillCommand: LauncherCommand = {
      id: "open-skill",
      label: "$diagnose",
      description: "Diagnose",
      artifactId: skill.id,
      artifactType: "skill",
    };
    expect(launcherCommandCapability(skillCommand).execute({
      palette,
      command: skillCommand,
    })).toEqual({
      type: "reveal-skill-source",
      artifactId: skill.id,
    });
  });

  test("removes the legacy Personal Library route from native and frontend contracts", () => {
    const native = readText("src/native.ts");
    const commands = readText("src-tauri/src/commands.rs");
    const promptCommands = readPromptCommandSources();
    const lib = readText("src-tauri/src/lib.rs");
    const settingsWindow = readText("src/windows/settingsWindow.ts");

    for (const source of [native, commands, promptCommands, lib, settingsWindow]) {
      expect(source).not.toContain("openPersonalLibrary");
      expect(source).not.toContain("open_personal_library");
      expect(source).not.toContain("PersonalLibraryRouteAction");
    }

    expect(commandsForQuery("new").map((entry) => entry.id)).toEqual(
      expect.arrayContaining(["add-prompt", "add-context", "add-skill"]),
    );
    expect(commandsForQuery("library").map((entry) => entry.id)).toContain("open-library");
  });

  test("keeps artifact CRUD reachable from Launcher instead of Preferences", () => {
    const created: Array<{
      kind: string;
      artifactType: string;
      artifactId?: string | null;
      initialId?: string | null;
    }> = [];
    const palette = runtime(0);
    const rerender = () => undefined;
    const preparePrompt = () => undefined;
    const openArtifactComposer = (
      kind: "new" | "edit" | "duplicate",
      artifactType: "prompt" | "context" | "skill",
      artifactId?: string | null,
      initialId?: string | null,
    ) => {
      created.push({ kind, artifactType, artifactId, initialId });
    };

    for (const [query, commandId] of [
      ["#review", "create-prompt"],
      ["@repo-policy", "create-context"],
      ["$diagnose", "create-skill"],
      ["new skill", "add-skill"],
    ] as const) {
      const command = commandById(commandsForQuery(query), commandId);
      runLauncherCommand(
        fakeElement(),
        palette,
        command,
        rerender,
        preparePrompt,
        openArtifactComposer,
      );
    }

    expect(created).toEqual([
      { kind: "new", artifactType: "prompt", artifactId: null, initialId: "review" },
      { kind: "new", artifactType: "context", artifactId: null, initialId: "repo-policy" },
      { kind: "new", artifactType: "skill", artifactId: null, initialId: "diagnose" },
      { kind: "new", artifactType: "skill", artifactId: null, initialId: null },
    ]);
  });

  test("keeps GitHub import reachable from Launcher instead of Preferences", () => {
    const palette = runtime(0);
    const command = commandById(commandsForQuery("github"), "import-github");
    let opened = false;

    runLauncherCommand(
      fakeElement(),
      palette,
      command,
      () => undefined,
      () => undefined,
      undefined,
      () => {
        opened = true;
      },
    );

    expect(command.label).toBe("Import from GitHub");
    expect(opened).toBe(true);
  });

  test("keeps project writes explicit and out of default delivery paths", () => {
    const prompt = promptArtifact(1);
    const contextArtifact = context(2);
    const skill = {
      ...promptArtifact(3),
      id: "diagnose",
      artifact_type: "skill" as const,
      title: "Diagnose",
    };
    const palette = runtime(0);
    palette.surfaceMode = "search";
    palette.prompts = [prompt, contextArtifact, skill];
    const projectWrites: Array<{ writeKind: string; artifactId?: string | null }> = [];
    const prepared: PromptDefinition[] = [];
    let projectSetupOpened = 0;
    const openProjectArtifactWrite = (
      writeKind: "prompt" | "context" | "skill" | "agents-snippet",
      artifactId?: string | null,
    ) => {
      projectWrites.push({ writeKind, artifactId });
    };

    expect(commandsForQuery("project", palette.prompts).map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "export-prompt-project",
        "export-context-project",
        "install-skill-project",
      ]),
    );
    expect(commandsForQuery("agents", palette.prompts).map((entry) => entry.id))
      .toContain("create-agents-snippet");

    runLauncherCommand(
      fakeElement(),
      palette,
      commandById(commandsForQuery("project setup", palette.prompts), "project-setup"),
      () => undefined,
      () => undefined,
      undefined,
      undefined,
      openProjectArtifactWrite,
      () => {
        projectSetupOpened += 1;
      },
    );
    expect(projectSetupOpened).toBe(1);
    expect(projectWrites).toEqual([]);

    runLauncherCommand(
      fakeElement(),
      palette,
      {
        id: "load-artifact",
        label: "#prompt-1",
        description: "Prompt",
        artifactId: prompt.id,
        artifactType: "prompt",
      },
      () => undefined,
      (artifact) => {
        prepared.push(artifact);
      },
      undefined,
      undefined,
      openProjectArtifactWrite,
    );
    expect(prepared.map((artifact) => artifact.id)).toEqual([prompt.id]);
    expect(projectWrites).toEqual([]);

    const projectCommandPool = [
      ...commandsForQuery("project", palette.prompts),
      ...commandsForQuery("agents", palette.prompts),
    ];
    palette.searchQuery = "project";
    for (const [selectedIndex, commandId] of [
      [0, "export-prompt-project"],
      [1, "export-context-project"],
      [2, "install-skill-project"],
      [0, "create-agents-snippet"],
    ] as const) {
      palette.selectedIndex = selectedIndex;
      runLauncherCommand(
        fakeElement(),
        palette,
        commandById(projectCommandPool, commandId),
        () => undefined,
        () => undefined,
        undefined,
        undefined,
        openProjectArtifactWrite,
      );
    }

    expect(projectWrites).toEqual([]);
    expect(palette.launcherFeedback).toEqual({
      message: "Select an artifact before creating an AGENTS.md snippet.",
      tone: "warning",
    });

    for (const [query, selectedIndex, commandId] of [
      ["#", 0, "export-prompt-project"],
      ["@", 1, "export-context-project"],
      ["#", 0, "create-agents-snippet"],
    ] as const) {
      palette.searchQuery = query;
      palette.selectedIndex = selectedIndex;
      runLauncherCommand(
        fakeElement(),
        palette,
        commandById(projectCommandPool, commandId),
        () => undefined,
        () => undefined,
        undefined,
        undefined,
        openProjectArtifactWrite,
      );
    }
    palette.searchQuery = "install skill";
    palette.selectedIndex = 0;
    runLauncherCommand(
      fakeElement(),
      palette,
      {
        ...commandById(projectCommandPool, "install-skill-project"),
        artifactId: skill.id,
        artifactType: "skill",
      },
      () => undefined,
      () => undefined,
      undefined,
      undefined,
      openProjectArtifactWrite,
    );

    expect(projectWrites).toEqual([
      { writeKind: "prompt", artifactId: prompt.id },
      { writeKind: "context", artifactId: contextArtifact.id },
      { writeKind: "agents-snippet", artifactId: prompt.id },
      { writeKind: "skill", artifactId: skill.id },
    ]);
  });
});
