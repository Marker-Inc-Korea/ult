import { describe, expect, test } from "bun:test";

import {
  readJson,
  readText,
  rustConstString,
  rustEnumVariants,
  rustFunctionBody,
  tauriCapabilityPermissions,
  tauriCapabilityWindows,
} from "./support/nativeContract";

describe("window and capability contract", () => {
  test("keeps first-run Accessibility flow out of product-owned setup windows", () => {
    const config = readJson<{
      app: { windows: Array<{ label: string }> };
    }>("src-tauri/tauri.conf.json");
    const windowLabels = config.app.windows.map((window) => window.label);
    const windows = readText("src-tauri/src/windows.rs");
    const main = readText("src/main.ts");

    expect(windowLabels).toEqual(["palette", "settings"]);
    expect(windowLabels).not.toContain("prompts");
    expect(windowLabels).not.toContain("setup");
    expect(windowLabels).not.toContain("diagnostics");
    expect(tauriCapabilityWindows()).toEqual(["palette", "settings"]);
    expect(tauriCapabilityPermissions()).toEqual([
      "core:event:allow-listen",
      "core:event:allow-unlisten",
    ]);
    expect(windows).not.toContain("SETUP_WINDOW");
    expect(windows).not.toContain("DIAGNOSTICS_WINDOW");
    expect(main).not.toContain("setup");
    expect(main).not.toContain("diagnostics");
  });

  test("registers Ctrl+V as Launcher stack without taking Cmd+V", () => {
    const shortcutActions = rustEnumVariants("src-tauri/src/hotkeys.rs", "ShortcutAction");
    const launcherModes = rustEnumVariants("src-tauri/src/overlay_events.rs", "LauncherMode");
    const shortcutSyncBody = rustFunctionBody(
      "src-tauri/src/commands/settings_commands.rs",
      "sync_app_shortcuts_for_app",
    );
    const shortcutHandlerBody = rustFunctionBody(
      "src-tauri/src/commands/settings_commands.rs",
      "handle_app_shortcut",
    );

    expect(shortcutActions).toEqual([
      "Palette",
      "Launcher",
      "LauncherScratch",
      "LauncherStack",
    ]);
    expect(shortcutActions).not.toContain("Search");
    expect(shortcutActions).not.toContain("ScratchPrompt");
    expect(rustConstString("src-tauri/src/hotkeys.rs", "DEFAULT_CONTEXT_PICKER_SHORTCUT"))
      .toBe("Control+V");
    expect(launcherModes).toContain("Stack");
    expect(shortcutSyncBody).toContain("ShortcutAction::LauncherStack");
    expect(shortcutHandlerBody).toContain("show_launcher_window(app, LauncherMode::Search)");
    expect(shortcutHandlerBody).toContain("show_launcher_window(app, LauncherMode::Stack)");
  });

  test("keeps app windows transparent enough for glass materials", () => {
    const config = readJson<{
      app: {
        windows: Array<{
          label: string;
          transparent: boolean;
          backgroundColor: string;
        }>;
      };
    }>("src-tauri/tauri.conf.json");
    const windows = Object.fromEntries(
      config.app.windows.map((window) => [window.label, window]),
    ) as Record<string, { transparent: boolean; backgroundColor: string }>;

    expect(windows.palette.transparent).toBe(true);
    expect(windows.palette.backgroundColor).toBe("#00000000");
    expect(windows.settings.transparent).toBe(true);
    expect(windows.settings.backgroundColor).toBe("#00000000");
  });

  test("keeps macOS menu-bar lifecycle stable around windows and overlays", () => {
    const main = readText("src-tauri/src/lib.rs");
    const tray = readText("src-tauri/src/tray_menu.rs");
    const windows = readText("src-tauri/src/windows.rs");
    const launcherModes = rustEnumVariants("src-tauri/src/overlay_events.rs", "LauncherMode");

    expect(windows).toContain("pub fn enforce_menu_bar_activation");
    const enforceMenuBarBody = rustFunctionBody("src-tauri/src/windows.rs", "enforce_menu_bar_activation");
    expect(enforceMenuBarBody).toContain("set_activation_policy(tauri::ActivationPolicy::Accessory)");
    expect(enforceMenuBarBody).toContain("set_dock_visibility(false)");
    expect(windows).not.toContain("app.show()");
    expect(main).toContain("enforce_menu_bar_activation(handle)?");
    expect(windows).toContain("hide_app_if_no_standard_window(&app)");

    const showOverlayBody = rustFunctionBody(
      "src-tauri/src/overlay_runtime.rs",
      "show_overlay_window",
    );
    const hideOverlayBody = rustFunctionBody(
      "src-tauri/src/overlay_runtime.rs",
      "hide_palette_window_with_mode",
    );
    const passthroughBody = rustFunctionBody(
      "src-tauri/src/overlay_runtime.rs",
      "prepare_palette_window_for_passthrough",
    );
    const permissionPromptBody = rustFunctionBody(
      "src-tauri/src/overlay_runtime.rs",
      "prepare_palette_window_for_permission_prompt",
    );
    const accessibilityStatusBody = rustFunctionBody(
      "src-tauri/src/commands/settings_commands.rs",
      "accessibility_status",
    );
    const loadLibraryBody = rustFunctionBody(
      "src-tauri/src/commands/prompt_commands/cache.rs",
      "load_prompt_cache_for_app",
    );
    const promptShortcutBody = rustFunctionBody(
      "src-tauri/src/commands/prompt_commands/shortcut_sync.rs",
      "handle_prompt_shortcut",
    );

    expect(showOverlayBody).toContain("enforce_menu_bar_activation(app)?");
    expect(showOverlayBody).not.toContain("app.show()");
    expect(showOverlayBody).not.toContain("refresh_tray_menu");
    expect(hideOverlayBody).not.toContain("refresh_tray_menu");
    expect(passthroughBody).toContain("hide_app_if_no_standard_window(app)?");
    expect(permissionPromptBody).toContain("set_ignore_cursor_events(true)");
    expect(permissionPromptBody).toContain("set_focusable(false)");
    expect(permissionPromptBody).not.toContain("window.hide()");
    expect(permissionPromptBody).not.toContain("hide_app_if_no_standard_window");
    expect(tray).not.toContain("open_prompt_from_menu");
    expect(tray).not.toContain("LauncherMode::Recent");
    expect(launcherModes).toContain("Recent");
    expect(accessibilityStatusBody).not.toContain("refresh_tray_menu");
    expect(loadLibraryBody).not.toContain("refresh_tray_menu");
    expect(promptShortcutBody).not.toContain("refresh_tray_menu");
  });
});
