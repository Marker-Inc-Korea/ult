import { createElement } from "../dom";
import { native } from "../native";
import { applyAppearance, type AppAppearance } from "../theme";
import type {
  AccessibilityStatus,
  AppDiagnostics,
  AppSettings,
  MetaPromptingSettings,
} from "../types";
import {
  createPreferencesWindowShell,
  createWindowError,
  createWindowLoading,
  errorMessage,
  getAppRoot,
  preferencesSectionTitle,
  type PreferencesSection,
} from "./nativeShell";
import { loadPromptCatalog, type PromptCatalog } from "./promptCatalog";
import { renderAdvancedSection } from "./settingsSections/advanced";
import {
  renderShortcutsSection,
} from "./settingsSections/configuration";
import { renderHomeSection } from "./settingsSections/home";
import {
  renderMetaPromptingSection,
  type MetaPromptingFormValues,
} from "./settingsSections/metaPrompting";

export {
  BROWSING_SHORTCUT_REFERENCE,
  LOADED_SHORTCUT_REFERENCE,
} from "./settingsSections/configuration";
export { metaPromptingFormValues } from "./settingsSections/metaPrompting";

let settingsWindowRenderGeneration = 0;
let settingsWindowLifecycle: AbortController | null = null;

type SettingsWindowData = {
  settings: AppSettings;
  metaPrompting: MetaPromptingSettings | null;
  accessibility: AccessibilityStatus | null;
  diagnostics: AppDiagnostics | null;
  catalog: PromptCatalog | null;
  selectedArtifactId: string | null;
};

export async function renderSettingsWindow(
  root: HTMLElement,
  initialSection: PreferencesSection = "general",
  consumePendingRoute = true,
) {
  const lifecycle = beginSettingsWindowRender();
  let targetSection = normalizePreferencesSection(initialSection);
  document.title = preferencesSectionTitle(targetSection);
  root.replaceChildren(createWindowLoading(preferencesSectionTitle(targetSection)));

  try {
    if (consumePendingRoute) {
      const pendingRoute = await native.consumePendingPreferencesRoute().catch(() => null);
      if (!lifecycle.isActive()) return;
      if (pendingRoute) {
        targetSection = normalizePreferencesSection(pendingRoute.section);
        document.title = preferencesSectionTitle(targetSection);
        root.replaceChildren(createWindowLoading(preferencesSectionTitle(targetSection)));
      }
    }

    const [
      settings,
      metaPrompting,
      accessibility,
      diagnostics,
      catalog,
      selectedArtifactId,
    ] = await Promise.all([
      native.loadAppSettings(),
      native.loadMetaPromptingSettings().catch(() => null),
      native.accessibilityStatus().catch(() => null),
      native.loadAppDiagnostics().catch(() => null),
      loadPromptCatalog().catch(() => null),
      native.paletteSelectedArtifactId().catch(() => null),
    ]);
    if (!lifecycle.isActive()) return;
    applyAppearance(settings.appearance);
    root.replaceChildren(createSettingsWindow({
      settings,
      metaPrompting,
      accessibility,
      diagnostics,
      catalog,
      selectedArtifactId,
    }, targetSection, lifecycle.signal, lifecycle.isActive));
  } catch (error) {
    if (!lifecycle.isActive()) return;
    root.replaceChildren(
      createWindowError(
        preferencesSectionTitle(targetSection),
        errorMessage(error, "Failed to load preferences"),
      ),
    );
  }
}

export function disposeSettingsWindowLifecycle() {
  settingsWindowLifecycle?.abort();
  settingsWindowLifecycle = null;
}

function beginSettingsWindowRender() {
  settingsWindowLifecycle?.abort();
  const controller = new AbortController();
  settingsWindowLifecycle = controller;
  settingsWindowRenderGeneration += 1;
  const generation = settingsWindowRenderGeneration;
  return {
    signal: controller.signal,
    isActive: () =>
      !controller.signal.aborted
      && settingsWindowLifecycle === controller
      && settingsWindowRenderGeneration === generation,
  };
}

function createSettingsWindow(
  data: SettingsWindowData,
  activeSection: PreferencesSection,
  lifecycleSignal: AbortSignal,
  isActiveRender: () => boolean,
) {
  let currentSettings = data.settings;
  let currentMetaPrompting = data.metaPrompting;
  let currentAccessibility = data.accessibility;
  let currentDiagnostics = data.diagnostics;
  let currentCatalog = data.catalog;

  const shell = createPreferencesWindowShell(activeSection, (section) => {
    void renderSettingsWindow(getAppRoot(), section, false);
  });
  shell.root.classList.add("settings-window");
  const status = createElement("div", "native-status");
  const form = createElement("div", "settings-sections");

  const render = () => {
    if (!isActiveRender()) return;
    form.replaceChildren();
    switch (activeSection) {
      case "general":
        form.append(...renderHomeSection({
          accessibility: currentAccessibility,
          diagnostics: currentDiagnostics,
          settings: currentSettings,
          catalog: currentCatalog,
          selectedArtifactId: data.selectedArtifactId,
          onUpdateLaunchAtLogin: updateLaunchAtLogin,
          onUpdateAppearance: updateAppearance,
          onOpenSection: (section) => {
            void renderSettingsWindow(getAppRoot(), section, false);
          },
          onOpenLauncher: () => {
            void native.openLauncher("search").catch((error) => {
              status.textContent = errorMessage(error, "Failed to open Launcher");
            });
          },
          onRevealLibrary: () => {
            void native.openInterventionLibraryFolder()
              .then(() => {
                status.textContent = "Personal Library folder opened.";
              })
              .catch((error) => {
                status.textContent = errorMessage(error, "Failed to open Personal Library folder");
              });
          },
        }));
        break;
      case "shortcuts":
        form.append(...renderShortcutsSection(
          currentSettings,
          updateShortcuts,
        ));
        break;
      case "meta-prompting":
        form.append(...renderMetaPromptingSection(
          currentMetaPrompting,
          updateMetaPromptingSettings,
          testMetaPromptingConnection,
        ));
        break;
      case "advanced":
        if (!currentDiagnostics) {
          form.append(createElement("p", "native-muted", "Advanced diagnostics are unavailable."));
        } else {
          form.append(...renderAdvancedSection(
            currentDiagnostics,
            status,
          ));
        }
        break;
    }
  };

  const updateLaunchAtLogin = async (enabled: boolean) => {
    try {
      const nextSettings = await native.setLaunchAtLogin(enabled);
      if (!isActiveRender()) return;
      currentSettings = nextSettings;
      status.textContent = "Launch setting saved.";
      render();
    } catch (error) {
      if (!isActiveRender()) return;
      status.textContent = errorMessage(error, "Failed to save launch setting");
      render();
    }
  };

  const updateAppearance = async (appearance: AppAppearance) => {
    try {
      const nextSettings = await native.setAppearance(appearance);
      if (!isActiveRender()) return;
      currentSettings = nextSettings;
      applyAppearance(nextSettings.appearance);
      status.textContent = "Appearance saved.";
      render();
    } catch (error) {
      if (!isActiveRender()) return;
      status.textContent = errorMessage(error, "Failed to save appearance");
      render();
    }
  };

  const updateShortcuts = async (
    openShortcut: string,
    searchShortcut: string,
    scratchShortcut: string,
  ) => {
    try {
      const result = await native.setAppShortcuts(openShortcut, searchShortcut, scratchShortcut);
      if (!isActiveRender()) return;
      currentSettings = result.settings;
      status.textContent = result.shortcut_sync.errors.length > 0
        ? result.shortcut_sync.errors.join("; ")
        : "Shortcut saved.";
      render();
    } catch (error) {
      if (!isActiveRender()) return;
      status.textContent = errorMessage(error, "Failed to save shortcut");
      render();
      throw error;
    }
  };

  const updateMetaPromptingSettings = async (values: MetaPromptingFormValues) => {
    try {
      const nextMetaPrompting = await native.setMetaPromptingSettings(
        values.enabled,
        values.provider,
        values.apiKey,
        values.model,
        values.template,
      );
      if (!isActiveRender()) return;
      currentMetaPrompting = nextMetaPrompting;
      const nextSettings = await native.loadAppSettings().catch(() => currentSettings);
      if (!isActiveRender()) return;
      currentSettings = nextSettings;
      status.textContent = "Meta Prompting saved.";
      render();
    } catch (error) {
      if (!isActiveRender()) return;
      status.textContent = errorMessage(error, "Failed to save Meta Prompting");
      render();
    }
  };

  const testMetaPromptingConnection = async (values: MetaPromptingFormValues) => {
    const result = await native.testMetaPromptingConnection(
      values.provider,
      values.apiKey,
      values.model,
    );
    if (isActiveRender()) {
      status.textContent = result.message;
    }
    return result.message;
  };

  const refreshAccessibilityState = async () => {
    try {
      const nextAccessibility = await native.accessibilityStatus();
      if (!isActiveRender()) return;
      currentAccessibility = nextAccessibility;
      if (activeSection === "general") {
        render();
      }
    } catch (error) {
      if (!isActiveRender()) return;
      if (activeSection === "general") {
        status.textContent = errorMessage(error, "Failed to refresh permission status");
        render();
      }
    }
  };

  shell.content.append(form);
  appendStandardFooter(shell.footer, status);

  window.addEventListener("focus", () => {
    void refreshAccessibilityState();
  }, { signal: lifecycleSignal });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refreshAccessibilityState();
    }
  }, { signal: lifecycleSignal });
  void native.listenPreferencesRoute((route) => {
    if (!isActiveRender()) return;
    void (async () => {
      await native.consumePendingPreferencesRoute().catch(() => null);
      if (!isActiveRender()) return;
      await renderSettingsWindow(getAppRoot(), normalizePreferencesSection(route.section), false);
    })();
  }).then((unlisten) => {
    if (lifecycleSignal.aborted) {
      unlisten();
      return;
    }
    lifecycleSignal.addEventListener("abort", unlisten, { once: true });
  });
  render();
  return shell.root;
}

function appendStandardFooter(footer: HTMLElement, ...items: HTMLElement[]) {
  footer.append(...items);
}

function normalizePreferencesSection(section: string): PreferencesSection {
  switch (section) {
    case "general":
    case "shortcuts":
    case "meta-prompting":
    case "advanced":
      return section;
    default:
      return "general";
  }
}
