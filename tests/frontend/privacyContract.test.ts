import { describe, expect, test } from "bun:test";

import { BASE_COMMANDS } from "../../src/overlay/launcher/launcherCommandDefinitions";
import {
  nativeInvokeCommandNames,
  readOptionalText,
  readSources,
  readText,
  rustFunctionBody,
  rustInvokeHandlerCommandNames,
} from "./support/nativeContract";

describe("privacy and explicit delivery contract", () => {
  test("keeps Accessibility permission setup out of menu and Preferences actions", () => {
    const lib = readText("src-tauri/src/lib.rs");
    const tray = readText("src-tauri/src/tray_menu.rs");
    const macosDelivery = readText("src-tauri/src/delivery/macos.rs");
    const home = readText("src/windows/settingsSections/home.ts");

    expect(rustInvokeHandlerCommandNames()).not.toContain("open_accessibility_settings");
    expect(nativeInvokeCommandNames()).not.toContain("open_accessibility_settings");
    expect(lib).not.toContain("open_accessibility_settings,");
    expect(macosDelivery).toContain("AXTrustedCheckOptionPrompt");
    expect(macosDelivery).not.toContain("Privacy_Accessibility");
    expect(macosDelivery).not.toContain("/usr/bin/open");
    expect(tray).not.toContain("Enable Accessibility");
    expect(tray).not.toContain("enable-native-delivery");
    expect(home).not.toContain("Open System Settings");
    expect(home).not.toContain("Recheck");
  });

  test("keeps Copy explicit and permission handoff native in product docs", () => {
    const readme = readText("README.md");
    const spec = readOptionalText("SPEC.md");
    const design = readOptionalText("DESIGN.md");
    const agents = readOptionalText("AGENTS.md");
    const normalizedReadme = readme.replace(/\s+/g, " ");

    expect(normalizedReadme).toContain("Copy mode remains explicit");
    expect(normalizedReadme).toContain("does not require native input synthesis");
    if (spec && design && agents) {
      expect(spec).toContain("Support Copy as an explicit delivery mode selected by the user");
      expect(spec).toContain("native macOS permission prompt or OS handoff");
      expect(spec).toContain("instead of silently copying");
      expect(design).toContain("passive status plus native OS handoff");
      expect(design).toContain("Do not put permission setup");
      expect(agents).toContain("block/report native delivery failures unless the user explicitly chose Copy");
    }

    for (const source of [readme, spec, design, agents].filter((entry): entry is string => Boolean(entry))) {
      expect(source).not.toContain("copy instead");
      expect(source).not.toContain("copy fallback");
      expect(source).not.toContain("fallback copy");
      expect(source).not.toContain("target not allowed");
      expect(source).not.toContain("target matcher");
      expect(source).not.toContain("allowlist");
    }
  });

  test("keeps clipboard context capture explicit and out of startup monitoring", () => {
    const lib = readText("src-tauri/src/lib.rs");
    const ephemeralContext = readText("src-tauri/src/ephemeral_context.rs");
    const macosDelivery = readText("src-tauri/src/delivery/macos.rs");
    const launcherCommandEffectRunner = readText("src/overlay/launcher/launcherCommandEffectRunner.ts");
    const readme = readText("README.md");
    const clipboardCaptureSection = readme.slice(
      readme.indexOf("Clipboard capture is explicit."),
      readme.indexOf("## Development"),
    );

    expect(lib).not.toContain("install_double_copy_listener");
    expect(ephemeralContext).not.toContain("run_pasteboard_double_copy_monitor");
    expect(ephemeralContext).not.toContain("pasteboard_change_count");
    expect(ephemeralContext).not.toContain("DoubleCopyDetector");
    expect(ephemeralContext).not.toContain("CGEventTap");
    expect(ephemeralContext).not.toContain("KeyDown");
    expect(ephemeralContext).not.toContain("CGEventFlagCommand");
    expect(ephemeralContext).toContain("capture_ephemeral_context_from_clipboard");
    expect(nativeInvokeCommandNames()).toContain("capture_ephemeral_context");
    expect(BASE_COMMANDS.find((command) => command.id === "capture-clipboard"))
      .toMatchObject({
        label: "Capture Clipboard",
        privacyLabel: "Reads the current clipboard only when explicitly run.",
      });
    expect(launcherCommandEffectRunner).toContain("native.captureEphemeralContext");
    expect(macosDelivery).toContain("suppress_internal_pasteboard_changes");
    expect(readme).toContain("Run `Capture Clipboard`");
    expect(clipboardCaptureSection).not.toContain("Cmd+C");
  });

  test("keeps Launcher search browsing separate from persisted selection", () => {
    const nativeSync = readText("src/overlay/shared/nativeOverlaySync.ts");
    const deliveryController = readText("src/overlay/loaded/deliveryController.ts");

    const preparePromptBody = deliveryController.slice(
      deliveryController.indexOf("export function preparePromptForExecution"),
      deliveryController.indexOf("export async function applyLoadedPrompt"),
    );
    const nativeSelectionSyncBody = nativeSync.slice(
      nativeSync.indexOf("async function syncPromptPaletteSelectionFromNative"),
      nativeSync.indexOf("function canApplyNativeSelectionSync"),
    );

    expect(preparePromptBody.indexOf("if (prompt.confirm")).toBeLessThan(
      preparePromptBody.indexOf("persistSelection(prompt);"),
    );
    expect(nativeSelectionSyncBody).toContain('palette.launcherMode === "recent"');
    expect(nativeSelectionSyncBody).toContain("actions.loadSelected(null);");
  });

  test("keeps create, search, and built-in template browsing metadata-only", () => {
    const createSearchTemplateSources = readSources([
      "src/overlay/launcher/artifactCreateCanvasSurface.ts",
      "src/overlay/launcher/artifactCreateDraft.ts",
      "src/overlay/launcher/artifactCreateState.ts",
      "src/overlay/launcher/artifactCreateTemplates.ts",
      "src/overlay/launcher/searchController.ts",
      "src/overlay/launcher/launcherSearchIndex.ts",
      "src/overlay/launcher/launcherSearchCollector.ts",
      "src/overlay/launcher/launcherSearchArtifactScoring.ts",
      "src/overlay/launcher/launcherSearchCommandScoring.ts",
      "src/overlay/launcher/commandCreationContract.ts",
      "src/overlay/launcher/workflowBuilderContract.ts",
      "src/overlay/launcher/skillScaffoldContract.ts",
    ]);
    const scoring = readText("src/overlay/launcher/launcherSearchArtifactScoring.ts");
    const searchableArtifactTextBody = scoring.slice(
      scoring.indexOf("function searchableArtifactText"),
      scoring.indexOf("function launcherArtifactPageSize"),
    );
    const commandScoring = readText("src/overlay/launcher/launcherSearchCommandScoring.ts");
    const searchableCommandTextBody = commandScoring.slice(
      commandScoring.indexOf("function searchableCommandText"),
      commandScoring.indexOf("function commandScore"),
    );
    const commandContract = readText("src/overlay/launcher/commandCreationContract.ts");
    const workflowContract = readText("src/overlay/launcher/workflowBuilderContract.ts");
    const skillContract = readText("src/overlay/launcher/skillScaffoldContract.ts");

    for (const forbidden of [
      "native.",
      "invokeNative",
      "navigator.clipboard",
      "captureEphemeralContext",
      "previewProject",
      "writeProject",
      "readFileSync",
      "terminal output",
      "terminal contents",
      "shell history",
      "shell_history",
      "clipboard history",
      "agent output",
    ]) {
      expect(createSearchTemplateSources).not.toContain(forbidden);
    }
    expect(searchableArtifactTextBody).toContain("item.title");
    expect(searchableArtifactTextBody).toContain("item.handle");
    expect(searchableArtifactTextBody).not.toContain("prompt.prompt");
    expect(searchableArtifactTextBody).not.toContain("description");
    expect(searchableCommandTextBody).toContain("command.userCommand?.source_path");
    expect(searchableCommandTextBody).toContain("command.description");
    expect(searchableCommandTextBody).toContain("item.keywords");
    expect(searchableCommandTextBody).toContain("item.aliases");
    expect(searchableCommandTextBody).not.toContain("prompt.prompt");
    expect(searchableCommandTextBody).not.toContain("body");
    expect(commandContract).toContain("bodyIndexed: false");
    expect(commandContract).toContain("promptDeliveryArtifact: false");
    expect(workflowContract).toContain('model: "prompt-command-pair"');
    expect(workflowContract).toContain('referencePrivacy: "ids-and-handles-only"');
    expect(workflowContract).toContain("copiedPrivateBodiesToHistoryOrSearch: false");
    expect(workflowContract).toContain("terminalReads: false");
    expect(workflowContract).toContain("projectScans: false");
    expect(workflowContract).toContain("implicitPromptDelivery: false");
    expect(skillContract).toContain("sourceOriented: true");
    expect(skillContract).toContain("deliverablePromptArtifact: false");
    expect(skillContract).toContain("promptContextCreateCanvas: false");
    expect(skillContract).toContain("readsProjectFiles: false");
    expect(skillContract).toContain("readsTerminalOutput: false");
    expect(skillContract).toContain("readsAgentOutput: false");
    expect(skillContract).toContain("writesProjectFiles: false");
    expect(skillContract).toContain("installsExternalPackages: false");
  });

  test("keeps overlay surface transitions centralized", () => {
    const state = readText("src/overlay/shared/surfaceState.ts");
    const transitionSources = [
      "src/paletteRuntime.ts",
      "src/overlay/launcher/templateState.ts",
      "src/overlay/loaded/deliveryState.ts",
    ].map((path) => readText(path));

    expect(state).toContain("export function syncOverlaySurfaceState");
    expect(state).toContain("derivedOverlaySurfaceMode");
    for (const source of transitionSources) {
      expect(source).toContain("syncOverlaySurfaceState");
      expect(source).not.toMatch(/palette\.surfaceMode\s*=(?!=)/);
    }
  });

  test("keeps project metadata as a reserved schema field without a setter command", () => {
    const lib = readText("src-tauri/src/lib.rs");
    const readme = readText("README.md");
    const spec = readOptionalText("SPEC.md");
    const settingsNormalizationBody = rustFunctionBody(
      "src-tauri/src/settings.rs",
      "normalize_app_settings",
    );

    expect(nativeInvokeCommandNames()).not.toContain("set_project_metadata_enabled");
    expect(rustInvokeHandlerCommandNames()).not.toContain("set_project_metadata_enabled");
    expect(settingsNormalizationBody).toContain("project_metadata_enabled: false");
    expect(lib).not.toContain("set_project_metadata_enabled,");
    if (spec) {
      expect(spec).toContain("Reserved for a future privacy-safe project metadata resolver.");
      expect(spec).toContain("This field is a reserved schema marker, not a user opt-in flag today.");
      expect(spec).toContain("implementations MUST normalize this field to `false`");
      expect(spec).toContain("Settings save paths MUST write this field back as `false`");
      expect(spec).toContain("A future resolver requires a separate");
    }
    expect(readme).toContain("Project metadata collection is reserved");
    expect(readme).toContain("not exposed as a working Preferences control");
  });
});
