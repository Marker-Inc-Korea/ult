import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

import {
  PREFERENCES_SECTIONS,
  createNativeInlineStatus,
  createNativeKeycap,
  createNativeRow,
  createNativeSection,
  createNativeSidebarShell,
  createNativeStatRow,
  createNativeShortcutRow,
  createPreferencesWindowShell,
  preferencesSectionTitle,
} from "../../src/windows/nativeShell";
import {
  BROWSING_SHORTCUT_REFERENCE,
  LOADED_SHORTCUT_REFERENCE,
  disposeSettingsWindowLifecycle,
  metaPromptingFormValues,
  renderSettingsWindow,
} from "../../src/windows/settingsWindow";
import type {
  AccessibilityStatus,
  AppDiagnostics,
  AppSettings,
  MetaPromptingSettings,
  PromptDefinition,
} from "../../src/types";
import {
  FakeElement,
  createFakeDocument,
  createFakeWindow,
  findAllByTag,
  findButtonByText,
  findByClass,
  flushPromises,
  textOf,
} from "./support/fakeDom";

function appSettings(): AppSettings {
  return {
    palette_visible_count: 5,
    pinned_artifact_ids: [],
    launch_at_login: false,
    project_metadata_enabled: false,
    open_palette_shortcut: "Cmd+U",
    search_shortcut: "Option+Space",
    scratch_prompt_shortcut: "Cmd+Option+Control+S",
    meta_prompting_enabled: false,
    meta_prompting_provider: "openai",
    meta_prompting_model: "gpt-5-mini",
    meta_prompting_template: "Rewrite: {input}",
  };
}

function accessibilityStatus(trusted = false): AccessibilityStatus {
  return {
    platform: "macos",
    trusted,
    required_for_native_delivery: true,
  };
}

function appDiagnostics(): AppDiagnostics {
  return {
    app_version: "0.1.0",
    config_path: "/Users/example/Library/Application Support/engineer.ultra.ult",
    accessibility: accessibilityStatus(false),
    app_identity: {
      bundle_identifier: "engineer.ultra.ult",
      running_path: "/Applications/Ult.app/Contents/MacOS/Ult",
      launch_kind: "Packaged .app",
      signing_status: "Valid signature",
      accessibility_identity_note: "Packaged app identity.",
      stale_permission_reset_command: "tccutil reset Accessibility engineer.ultra.ult",
    },
    overlay_coordinates: {
      cursor_physical_position: "0,0",
      active_display_name: "Main",
      active_display_physical_bounds: "0,0 100x100",
      active_display_scale_factor: "2",
      palette_window_physical_bounds: "0,0 100x100",
      webview_pointer_position: "0,0",
    },
    app_shortcuts: ["Cmd+U", "Cmd+Option+Control+S"],
    last_delivery_result: null,
    recent_history: [],
  };
}

function installNativeMock(
  overrides: Record<string, (payload?: Record<string, unknown>) => Promise<unknown> | unknown> = {},
) {
  const calls = new Map<string, number>();
  const responses: Record<string, (payload?: Record<string, unknown>) => Promise<unknown> | unknown> = {
    load_app_settings: () => appSettings(),
    load_meta_prompting_settings: () => ({
      enabled: false,
      provider: "openai",
      api_key: "",
      model: "gpt-5-mini",
      template: "Rewrite: {input}",
    }),
    accessibility_status: () => accessibilityStatus(false),
    load_app_diagnostics: () => null,
    load_intervention_library: () => ({
      artifacts: [],
      entries: [],
      editable_artifact_ids: [],
      config_path: "~/.ult",
      registry_path: "~/.ult/personal-library",
      errors: [],
      warnings: [],
    }),
    load_usage_history: () => [],
    consume_pending_preferences_route: () => null,
    palette_selected_artifact_id: () => null,
    open_skills_folder: () => undefined,
    ...overrides,
  };
  const fakeWindow = globalThis.window as unknown as ReturnType<typeof createFakeWindow>;
  fakeWindow.__TAURI_INTERNALS__ = {
    invoke: async <T,>(command: string, payload?: Record<string, unknown>) => {
      calls.set(command, (calls.get(command) ?? 0) + 1);
      const response = responses[command];
      if (!response) throw new Error(`Unexpected command: ${command}`);
      return await response(payload) as T;
    },
  };
  return calls;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  disposeSettingsWindowLifecycle();
  (globalThis as unknown as { document: unknown }).document = createFakeDocument();
  (globalThis as unknown as { window: unknown }).window = createFakeWindow();
});

describe("preferences window", () => {
  test("defines the sidebar sections in product order", () => {
    expect(PREFERENCES_SECTIONS.map((section) => section.id)).toEqual([
      "general",
      "shortcuts",
      "meta-prompting",
      "advanced",
    ]);
    expect(preferencesSectionTitle("general")).toBe("General");
    expect(preferencesSectionTitle("shortcuts")).toBe("Shortcuts");
    expect(PREFERENCES_SECTIONS.find((section) => section.id === "meta-prompting")?.label).toBe("Meta Prompting");
    expect(preferencesSectionTitle("advanced")).toBe("Advanced");
  });

  test("renders the selected sidebar section", () => {
    const shell = createPreferencesWindowShell("meta-prompting");
    const root = shell.root as unknown as FakeElement;

    expect(textOf(root)).toContain("General");
    expect(textOf(root)).toContain("Shortcuts");
    expect(textOf(root)).toContain("Meta Prompting");
    expect(root.children[0]).toBeInstanceOf(FakeElement);
    expect(root.children[1]).toBeInstanceOf(FakeElement);
  });

  test("exposes shared native design primitives", () => {
    const shell = createNativeSidebarShell({
      title: "Ult",
      selectedId: "shortcuts",
      items: [
        { id: "general", label: "General", detail: "Ready" },
        { id: "shortcuts", label: "Shortcuts", count: 3 },
      ],
    });
    const row = createNativeRow("Open Palette", "Shows pinned prompts.", createNativeKeycap("⌘K"));
    const shortcut = createNativeShortcutRow(
      "Open Launcher in Scratch mode",
      "Opens ephemeral input.",
      createNativeKeycap("⌘S"),
    );
    const stats = createNativeStatRow([
      { value: "5", label: "Pinned prompts" },
      { value: "2", label: "Contexts" },
    ]);
    const section = createNativeSection("Shortcuts", [row, shortcut]);
    const status = createNativeInlineStatus("Ready", "ok");

    expect((shell.root as unknown as FakeElement).className).toContain("native-sidebar-shell");
    expect((section as unknown as FakeElement).className).toContain("native-section");
    expect((row as unknown as FakeElement).className).toContain("native-group-row");
    expect((shortcut as unknown as FakeElement).className).toContain("native-shortcut-row");
    expect((stats as unknown as FakeElement).className).toContain("native-stat-row");
    expect((status as unknown as FakeElement).className).toContain("native-inline-status");
    expect(textOf(shell.root as unknown as FakeElement)).toContain("Shortcuts");
    expect(textOf(section as unknown as FakeElement)).toContain("Open Palette");
  });

  test("keeps explicit empty Meta Prompting values visible", () => {
    const settings: MetaPromptingSettings = {
      enabled: true,
      provider: "",
      api_key: "",
      model: "",
      template: "",
    };

    expect(metaPromptingFormValues(settings)).toEqual({
      enabled: true,
      provider: "",
      apiKey: "",
      model: "",
      template: "",
    });
  });

  test("labels Search and Scratch as Launcher shortcuts", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = createFakeWindow();
    installNativeMock();

    await renderSettingsWindow(root as unknown as HTMLElement, "shortcuts");

    const text = textOf(root);
    expect(text).toContain("Open Launcher");
    expect(text).toContain("Open Launcher in Scratch mode");
    expect(text).toContain("Search #prompts, @contexts, $skills, and /commands.");
    expect(text).toContain("Browsing");
    expect(text).toContain("Load selected item");
    expect(text).toContain("Click target");
    expect(text).not.toContain("Search prompts and contexts.");
    expect(text).not.toContain("Opens a one-off prompt draft.");
    expect(text).not.toContain("Deliver loaded item");
  });

  test("meta prompting exposes a connection test without saving first", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = createFakeWindow();
    installNativeMock({
      load_meta_prompting_settings: () => ({
        enabled: true,
        provider: "openai",
        api_key: "sk-test",
        model: "gpt-5-mini",
        template: "Rewrite: {input}",
      }),
    });

    await renderSettingsWindow(root as unknown as HTMLElement, "meta-prompting");

    const text = textOf(root);
    expect(text).toContain("Test");
    expect(text).toContain("Uses the current fields without saving.");
  });

  test("general section uses grouped product rows and reports library status", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = createFakeWindow();
    const artifacts: PromptDefinition[] = [
      {
        id: "repo-review",
        title: "Repo Review",
        artifact_type: "prompt",
        scope: "persistent",
        pinned: true,
        description: "Review the current repository.",
        prompt: "Review this repo.",
      },
      {
        id: "project-notes",
        title: "Project Notes",
        artifact_type: "context",
        scope: "persistent",
        description: "Shared project context.",
        prompt: "# Notes",
      },
    ];
    const calls = installNativeMock({
      accessibility_status: () => accessibilityStatus(true),
      load_intervention_library: () => ({
        artifacts,
        entries: artifacts.map((prompt) => ({
          prompt,
          source: "local-file",
          editable: true,
          template_variables: [],
          diagnostics: [],
        })),
        editable_artifact_ids: artifacts.map((prompt) => prompt.id),
        config_path: "~/.ult",
        registry_path: "~/.ult/personal-library",
        errors: [],
        warnings: [],
      }),
    });

    await renderSettingsWindow(root as unknown as HTMLElement, "general");

    const text = textOf(root);
    expect(text).toContain("Overview");
    expect(text).toContain("Ready");
    expect(text).toContain("Pinned prompts");
    expect(text).toContain("Get Started");
    expect(text).toContain("Personal Library");
    expect(text).toContain("Managed from Launcher");
    expect(text).toContain("2 total");
    expect(text).toContain("1 pinned");
    expect(text).toContain("1 contexts");
    expect(text).toContain("0 skills");
    expect(text).toContain("Appearance");
    expect(text).toContain("System");
    expect(text).toContain("Light");
    expect(text).toContain("Dark");
    expect(text).not.toContain("Project metadata (reserved)");
    expect(text).not.toContain("No project metadata is collected today.");
    expect(findAllByTag(root, "input").some((input) =>
      input.title === "Reserved for a future privacy-safe project resolver."
    )).toBe(false);
    await flushPromises();
    expect(calls.get("set_project_metadata_enabled")).toBeUndefined();
  });

  test("keeps artifact management workflows out of rendered Preferences surfaces", async () => {
    for (const section of PREFERENCES_SECTIONS.map((entry) => entry.id)) {
      const root = new FakeElement("div");
      (globalThis as unknown as { document: unknown }).document = createFakeDocument(root);
      (globalThis as unknown as { window: unknown }).window = createFakeWindow();
      installNativeMock({
        load_app_diagnostics: () => appDiagnostics(),
      });

      await renderSettingsWindow(root as unknown as HTMLElement, section);

      for (const label of [
        "New Prompt",
        "New Context",
        "New Skill",
        "Edit Prompt",
        "Delete Artifact",
        "Import from GitHub",
        "Export Prompt to Project",
        "Export Context to Project",
        "Install Skill to Project",
      ]) {
        expect(findButtonByText(root, label)).toBeNull();
      }
      const text = textOf(root);
      expect(text).not.toContain("Preview GitHub Pack");
      expect(text).not.toContain("Import Selected Packages");
      expect(text).not.toContain("Files to Write");
      expect(text).not.toContain("Overwrite existing project file");
    }
  });

  test("normalizes stale Preferences route before initial Settings render", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = createFakeWindow();
    const calls = installNativeMock({
      consume_pending_preferences_route: () => ({
        section: "library",
      }),
    });

    await renderSettingsWindow(root as unknown as HTMLElement, "general");

    expect(calls.get("consume_pending_preferences_route")).toBe(1);
    expect(fakeDocument.title).toBe("General");
    expect(textOf(findByClass(root, "preferences-content-header")!)).toBe("General");
    const text = textOf(root);
    expect(text).toContain("Overview");
    expect(text).toContain("Managed from Launcher");
    expect(text).not.toContain("/prompt");
  });

  test("native management windows use readable material styles", () => {
    const nativeCss = readFileSync("src/styles/native-windows.css", "utf8");
    const settingsCss = readFileSync("src/styles/settings-diagnostics.css", "utf8");
    const baseCss = readFileSync("src/styles/base.css", "utf8");
    const globalStyles = readFileSync("src/styles.css", "utf8");

    expect(existsSync("src/styles/prompts-window.css")).toBe(false);
    expect(existsSync("src/styles/personal-library.css")).toBe(false);
    expect(existsSync("src/windows/settingsSections/personalLibrary.ts")).toBe(false);
    expect(existsSync("src/windows/personalLibraryShell.ts")).toBe(false);
    expect(existsSync("src/windows/settingsSections/history.ts")).toBe(false);
    expect(existsSync("src/windows/artifactEditor.ts")).toBe(false);
    expect(existsSync("src/windows/artifactList.ts")).toBe(false);
    expect(existsSync("src/windows/argumentEditor.ts")).toBe(false);
    expect(existsSync("src/windows/enumEditor.ts")).toBe(false);
    expect(globalStyles).not.toContain("prompts-window.css");
    expect(globalStyles).not.toContain("personal-library.css");
    expect(baseCss).toContain("--native-row-min-height: 66px");
    expect(baseCss).toContain("--native-row-padding-y: 14px");
    expect(baseCss).toContain("--native-row-padding-x: 24px");
    expect(settingsCss).toMatch(
      /\.settings-row\s*{[^}]*min-height:\s*var\(--native-row-min-height\);[^}]*padding:\s*var\(--native-row-padding-y\) var\(--native-row-padding-x\);/s,
    );
    expect(nativeCss).toMatch(
      /\.native-group-row\s*{[^}]*min-height:\s*var\(--native-row-min-height\);[^}]*padding:\s*var\(--native-row-padding-y\) var\(--native-row-padding-x\);/s,
    );
    expect(settingsCss).toMatch(
      /\.settings-value-text\s*{[^}]*white-space: normal/s,
    );
    expect(nativeCss).toMatch(
      /\.native-row-text span\s*{[^}]*white-space: normal/s,
    );
    expect(settingsCss).not.toContain("personal-library");
    expect(settingsCss).not.toContain("prompt-row");
    expect(nativeCss).not.toContain("personal-library-primary-tabs");
    expect(nativeCss).not.toContain("prompt-library-tab");
    expect(nativeCss).not.toContain("prompt-row");
  });

  test("keeps loaded shortcut reference out of the overlay copy path", () => {
    expect(BROWSING_SHORTCUT_REFERENCE.map((item) => item.key)).toEqual([
      "Enter",
      "↑↓",
      "Esc",
    ]);
    expect(BROWSING_SHORTCUT_REFERENCE.map((item) => item.label)).toEqual([
      "Load selected item",
      "Navigate",
      "Close",
    ]);
    expect(LOADED_SHORTCUT_REFERENCE.map((item) => item.key)).toEqual([
      "Shift+Tab",
      "Esc",
      "Click target",
    ]);
    expect(LOADED_SHORTCUT_REFERENCE.map((item) => item.label)).toEqual([
      "Change delivery mode",
      "Close",
      "Deliver",
    ]);
  });

  test("advanced diagnostics exposes a metadata-only export action", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = createFakeWindow();
    installNativeMock({
      load_app_diagnostics: () => appDiagnostics(),
      export_app_diagnostics: () => ({
        file_path: "/tmp/ult-diagnostics.json",
        failure_count: 1,
      }),
    });

    await renderSettingsWindow(root as unknown as HTMLElement, "advanced");

    const text = textOf(root);
    expect(text).toContain("Diagnostics Export");
    expect(text).toContain("metadata-only failures");
    expect(text).toContain("Version");
    expect(text).toContain("Personal Library");
    expect(text).toContain("Reveal Folder");
    expect(text).toContain("Reload Library");
    expect(text).not.toContain("prompt body");
    expect(text).not.toContain("terminal contents");
  });

  test("does not accumulate Accessibility refresh listeners across section renders", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    const fakeWindow = createFakeWindow();
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = fakeWindow;
    const calls = installNativeMock();

    await renderSettingsWindow(root as unknown as HTMLElement, "general");
    await renderSettingsWindow(root as unknown as HTMLElement, "shortcuts");
    await renderSettingsWindow(root as unknown as HTMLElement, "advanced");

    expect(fakeWindow.events.count("focus")).toBe(1);
    expect(fakeDocument.events.count("visibilitychange")).toBe(1);

    const beforeRefresh = calls.get("accessibility_status") ?? 0;
    fakeWindow.events.dispatch("focus");
    await flushPromises();
    expect(calls.get("accessibility_status")).toBe(beforeRefresh + 1);

    fakeDocument.hidden = false;
    fakeDocument.events.dispatch("visibilitychange");
    await flushPromises();
    expect(calls.get("accessibility_status")).toBe(beforeRefresh + 2);
  });

  test("keeps automatic permission refresh out of non-General footers", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    const fakeWindow = createFakeWindow();
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = fakeWindow;
    const calls = installNativeMock({
      accessibility_status: () => accessibilityStatus(false),
    });

    await renderSettingsWindow(root as unknown as HTMLElement, "meta-prompting");
    expect(textOf(root)).not.toContain("Accessibility access is not enabled.");

    const beforeRefresh = calls.get("accessibility_status") ?? 0;
    fakeWindow.events.dispatch("focus");
    await flushPromises();

    expect(calls.get("accessibility_status")).toBe(beforeRefresh + 1);
    expect(textOf(root)).not.toContain("Accessibility access is not enabled.");
    expect(textOf(root)).not.toContain("Accessibility access is ready.");
  });

  test("ignores stale Preferences render results after section navigation", async () => {
    const root = new FakeElement("div");
    const fakeDocument = createFakeDocument(root);
    (globalThis as unknown as { document: unknown }).document = fakeDocument;
    (globalThis as unknown as { window: unknown }).window = createFakeWindow();
    const firstSettings = deferred<AppSettings>();
    let loadSettingsCalls = 0;
    installNativeMock({
      load_app_settings: () => {
        loadSettingsCalls += 1;
        return loadSettingsCalls === 1 ? firstSettings.promise : appSettings();
      },
    });

    const firstRender = renderSettingsWindow(root as unknown as HTMLElement, "general", false);
    const secondRender = renderSettingsWindow(root as unknown as HTMLElement, "shortcuts", false);
    await secondRender;

    expect(fakeDocument.title).toBe("Shortcuts");
    expect(textOf(findByClass(root, "preferences-content-header")!)).toBe("Shortcuts");

    firstSettings.resolve(appSettings());
    await firstRender;
    await flushPromises();

    expect(fakeDocument.title).toBe("Shortcuts");
    expect(textOf(findByClass(root, "preferences-content-header")!)).toBe("Shortcuts");
  });
});
