import { beforeEach, describe, expect, test } from "bun:test";

import { native } from "../../src/native";
import type { InterventionArtifactInput } from "../../src/types";
import {
  nativeInvokeCommandNames,
  rustCommandParameters,
  rustInvokeHandlerCommandNames,
  type NativeCall,
} from "./support/nativeContract";

const calls: NativeCall[] = [];

const prompt: InterventionArtifactInput = {
  id: "hex",
  title: "Hex",
  description: "Ribbit response mode.",
  prompt: "ribbit",
  shortcut: null,
  confirm: false,
};

beforeEach(() => {
  calls.length = 0;
  (globalThis as unknown as { window: unknown }).window = {
    __TAURI_INTERNALS__: {
      invoke: async (command: string, payload?: Record<string, unknown>) => {
        calls.push({ command, payload });
        if (command === "set_app_shortcuts") {
          return { settings: {}, shortcut_sync: { registered: [], errors: [] } };
        }
        return {};
      },
    },
  };
});

describe("native command contract", () => {
  test("uses snake_case command names with Tauri camelCase payload keys", async () => {
    await native.addInterventionArtifact(prompt);
    await native.setPaletteVisibleCount(7);
    await native.setAppearance("light");
    await native.setLaunchAtLogin(true);
    await native.setPinnedInterventionArtifacts(["hex", "repo-policy"]);
    await native.setAppShortcuts("Cmd+1", "Cmd+2", "Cmd+3");
    await native.setMetaPromptingSettings(
      true,
      "openai",
      "sk-test",
      "gpt-5-mini",
      "Rewrite: {input}",
    );
    await native.testMetaPromptingConnection("openai", "sk-test", "gpt-5-mini");
    await native.deliverPromptAtPointer("text", "send", "hex");
    await native.exportAppDiagnostics();
    await native.exportInterventionArtifacts(["hex"]);
    await native.resolveDynamicEnumArgument("branch", "git branch", "/tmp");
    await native.importInterventionArtifacts("id = \"hex\"");
    await native.previewGitHubLibraryImport("https://github.com/not-agent/ult-pack", "main");
    await native.importGitHubLibraryPack(
      "https://github.com/not-agent/ult-pack",
      "main",
      ["persistent/prompts/hex/PROMPT.md"],
    );
    await native.previewProjectArtifactWrite("hex", "prompt", "/tmp/project", false);
    await native.writeProjectArtifact("hex", "prompt", "/tmp/project", true);
    await native.updateInterventionArtifact("old-hex", prompt);
    await native.deleteInterventionArtifact("hex");
    await native.selectInterventionArtifact("hex");
    await native.saveScratchPrompt("scratch text", true);
    await native.saveWorkflowInputContext("workflow text", "Fix Failing Tests");
    await native.captureEphemeralContext();
    await native.openLauncher("scratch");
    await native.dismissEphemeralContextFeedback();
    await native.showEphemeralContextIndicator();
    await native.consumePendingPreferencesRoute();

    expect(calls).toEqual([
      {
        command: "add_intervention_artifact",
        payload: { prompt },
      },
      {
        command: "set_palette_visible_count",
        payload: { visibleCount: 7 },
      },
      {
        command: "set_appearance",
        payload: { appearance: "light" },
      },
      {
        command: "set_launch_at_login",
        payload: { enabled: true },
      },
      {
        command: "set_pinned_intervention_artifacts",
        payload: { artifactIds: ["hex", "repo-policy"] },
      },
      {
        command: "set_app_shortcuts",
        payload: {
          openPaletteShortcut: "Cmd+1",
          searchShortcut: "Cmd+2",
          scratchPromptShortcut: "Cmd+3",
        },
      },
      {
        command: "set_meta_prompting_settings",
        payload: {
          enabled: true,
          provider: "openai",
          apiKey: "sk-test",
          model: "gpt-5-mini",
          template: "Rewrite: {input}",
        },
      },
      {
        command: "test_meta_prompting_connection",
        payload: {
          provider: "openai",
          apiKey: "sk-test",
          model: "gpt-5-mini",
        },
      },
      {
        command: "deliver_prompt_at_pointer",
        payload: {
          text: "text",
          mode: "send",
          promptId: "hex",
          promptKind: "local",
        },
      },
      {
        command: "export_app_diagnostics",
        payload: undefined,
      },
      {
        command: "export_intervention_artifacts",
        payload: { artifactIds: ["hex"] },
      },
      {
        command: "resolve_dynamic_enum_argument",
        payload: {
          argumentName: "branch",
          command: "git branch",
          workingDirectory: "/tmp",
        },
      },
      {
        command: "import_intervention_artifacts",
        payload: { contents: "id = \"hex\"" },
      },
      {
        command: "preview_github_library_import",
        payload: {
          request: {
            url: "https://github.com/not-agent/ult-pack",
            reference: "main",
          },
        },
      },
      {
        command: "import_github_library_pack",
        payload: {
          selection: {
            url: "https://github.com/not-agent/ult-pack",
            reference: "main",
            selected_paths: ["persistent/prompts/hex/PROMPT.md"],
          },
        },
      },
      {
        command: "preview_project_artifact_write",
        payload: {
          request: {
            artifact_id: "hex",
            write_kind: "prompt",
            target_directory: "/tmp/project",
            overwrite: false,
          },
        },
      },
      {
        command: "write_project_artifact",
        payload: {
          request: {
            artifact_id: "hex",
            write_kind: "prompt",
            target_directory: "/tmp/project",
            overwrite: true,
          },
        },
      },
      {
        command: "update_intervention_artifact",
        payload: {
          originalId: "old-hex",
          prompt,
        },
      },
      {
        command: "delete_intervention_artifact",
        payload: { artifactId: "hex" },
      },
      {
        command: "select_intervention_artifact",
        payload: { artifactId: "hex" },
      },
      {
        command: "save_scratch_prompt",
        payload: { text: "scratch text", confirm: true },
      },
      {
        command: "save_workflow_input_context",
        payload: { text: "workflow text", workflowTitle: "Fix Failing Tests" },
      },
      {
        command: "capture_ephemeral_context",
        payload: undefined,
      },
      {
        command: "open_launcher",
        payload: { mode: "scratch" },
      },
      {
        command: "dismiss_ephemeral_context_feedback",
        payload: undefined,
      },
      {
        command: "show_ephemeral_context_indicator",
        payload: undefined,
      },
      {
        command: "consume_pending_preferences_route",
        payload: undefined,
      },
    ]);
  });

  test("keeps frontend native invokes aligned with Rust invoke handlers", () => {
    expect(nativeInvokeCommandNames()).toEqual(rustInvokeHandlerCommandNames());
  });

  test("matches Rust command payload parameter names", () => {
    const parameters = rustCommandParameters();
    expect([...parameters.keys()].sort()).toEqual(rustInvokeHandlerCommandNames());
    expect(Object.fromEntries(parameters)).toMatchObject({
      add_intervention_artifact: ["prompt"],
      delete_intervention_artifact: ["artifact_id"],
      deliver_prompt_at_pointer: ["text", "mode", "prompt_id", "prompt_kind"],
      export_intervention_artifacts: ["artifact_ids"],
      import_github_library_pack: ["selection"],
      import_intervention_artifacts: ["contents"],
      load_usage_history: ["limit"],
      open_launcher: ["mode"],
      preview_github_library_import: ["request"],
      preview_project_artifact_write: ["request"],
      refine_scratch_prompt: ["text"],
      resolve_dynamic_enum_argument: ["argument_name", "command", "working_directory"],
      reveal_intervention_source: ["artifact_id"],
      save_scratch_prompt: ["text", "confirm"],
      save_workflow_input_context: ["text", "workflow_title"],
      select_intervention_artifact: ["artifact_id"],
      set_app_shortcuts: [
        "open_palette_shortcut",
        "search_shortcut",
        "scratch_prompt_shortcut",
      ],
      set_appearance: ["appearance"],
      set_launch_at_login: ["enabled"],
      set_meta_prompting_settings: ["enabled", "provider", "api_key", "model", "template"],
      set_palette_visible_count: ["visible_count"],
      set_pinned_intervention_artifacts: ["artifact_ids"],
      sync_intervention_shortcuts: ["artifacts"],
      test_meta_prompting_connection: ["provider", "api_key", "model"],
      update_intervention_artifact: ["original_id", "prompt"],
      write_project_artifact: ["request"],
    });
  });
});
