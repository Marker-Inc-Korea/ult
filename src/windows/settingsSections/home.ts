import { createElement } from "../../dom";
import { promptArtifactType, isPalettePrompt } from "../../promptUtils";
import { normalizeAppearance, type AppAppearance } from "../../theme";
import type { AccessibilityStatus, AppDiagnostics, AppSettings } from "../../types";
import { createNativeStatRow, type PreferencesSection } from "../nativeShell";
import type { PromptCatalog } from "../promptCatalog";
import { createSettingsRow, createSettingsSection } from "../settingsLayout";
import { createActionButton, createInlineActions, createStatusPill, createValueText } from "./shared";

type HomeSectionOptions = {
  accessibility: AccessibilityStatus | null;
  diagnostics: AppDiagnostics | null;
  settings: AppSettings;
  catalog: PromptCatalog | null;
  selectedArtifactId: string | null;
  onUpdateLaunchAtLogin: (enabled: boolean) => Promise<void>;
  onUpdateAppearance: (appearance: AppAppearance) => Promise<void>;
  onOpenSection: (section: PreferencesSection) => void;
  onOpenLauncher: () => void;
  onRevealLibrary: () => void;
};

export function renderHomeSection(options: HomeSectionOptions) {
  const {
    accessibility,
    diagnostics,
    settings,
    catalog,
    selectedArtifactId,
    onUpdateLaunchAtLogin,
    onUpdateAppearance,
    onOpenSection,
    onOpenLauncher,
    onRevealLibrary,
  } = options;
  const prompts = catalog?.prompts ?? [];
  const pinnedCount = prompts.filter(isPalettePrompt).length;
  const contextCount = prompts.filter((prompt) => promptArtifactType(prompt) === "context").length;
  const skillCount = prompts.filter((prompt) => promptArtifactType(prompt) === "skill").length;
  const issueCount = (catalog?.errors.length ?? 0) + (catalog?.warnings.length ?? 0);
  const currentArtifact = selectedArtifactLabel(catalog, selectedArtifactId);
  const launch = createElement("input") as HTMLInputElement;
  launch.type = "checkbox";
  launch.checked = settings.launch_at_login;
  launch.addEventListener("change", () => {
    void onUpdateLaunchAtLogin(launch.checked);
  });
  return [
    createSettingsSection("Overview", [
      createNativeStatRow([
        {
          value: accessibility?.trusted ? "Ready" : "Limited",
          label: "Native delivery",
        },
        { value: String(pinnedCount), label: "Pinned prompts" },
        { value: String(contextCount), label: "Contexts" },
        { value: lastResultLabel(diagnostics), label: "Last result" },
      ]),
    ]),
    createSettingsSection("Get Started", [
      createSettingsRow(
        "Launcher",
        "Search, load, create, edit, import, and reveal artifacts.",
        createRowAction("Open", onOpenLauncher),
      ),
      createSettingsRow(
        "Shortcuts",
        "Set hotkeys for Palette and Launcher modes.",
        createRowAction("Open", () => onOpenSection("shortcuts")),
      ),
    ]),
    createSettingsSection("Library", [
      createSettingsRow(
        "Personal Library",
        catalog?.configPath ?? "~/.ult/personal-library",
        createRowAction("Reveal", onRevealLibrary),
      ),
      createSettingsRow(
        "Artifacts",
        "Managed from Launcher. Preferences only reports library status.",
        createValueText(
          `${prompts.length} total · ${pinnedCount} pinned · ${contextCount} contexts · ${skillCount} skills`,
        ),
      ),
      createSettingsRow(
        "File issues",
        "Malformed package details appear in Launcher and Advanced diagnostics.",
        createValueText(issueCount === 0 ? "None" : `${issueCount} issue${issueCount === 1 ? "" : "s"}`),
      ),
    ]),
    createSettingsSection("Application", [
      createSettingsRow(
        "Appearance",
        "Choose how Ult windows and overlays are themed.",
        createAppearanceControl(settings.appearance, onUpdateAppearance),
      ),
      createSettingsRow(
        "Launch on login",
        "Start Ult as a menu-bar utility.",
        launch,
      ),
      createSettingsRow(
        "Current item",
        "Loaded from Palette or Launcher.",
        createValueText(currentArtifact),
      ),
      createSettingsRow(
        "Native delivery",
        "Uses macOS accessibility only when delivering to a target app.",
        createStatusPill(
          accessibility?.trusted ? "Ready" : "Permission Required",
          accessibility?.trusted ? "ok" : "warning",
        ),
      ),
    ]),
  ];
}

function createAppearanceControl(
  selected: string | undefined,
  onUpdate: (appearance: AppAppearance) => Promise<void>,
) {
  const current = normalizeAppearance(selected);
  const control = createElement("div", "segmented-control appearance-control");
  for (const [appearance, label] of [
    ["system", "System"],
    ["light", "Light"],
    ["dark", "Dark"],
  ] as const) {
    const button = createElement("button", "segmented-option", label);
    button.type = "button";
    button.classList.toggle("is-selected", current === appearance);
    button.setAttribute("aria-pressed", current === appearance ? "true" : "false");
    button.addEventListener("click", () => {
      if (current === appearance) return;
      void onUpdate(appearance);
    });
    control.append(button);
  }
  return control;
}

function createRowAction(label: string, onClick: () => void) {
  const actions = createInlineActions();
  actions.append(createActionButton(label, onClick));
  return actions;
}

function selectedArtifactLabel(catalog: PromptCatalog | null, selectedArtifactId: string | null) {
  if (!selectedArtifactId) return "None selected";
  return catalog?.prompts.find((prompt) => prompt.id === selectedArtifactId)?.title
    ?? selectedArtifactId;
}

function lastResultLabel(diagnostics: AppDiagnostics | null) {
  const result = diagnostics?.last_delivery_result;
  if (!result) return "None";
  if (result.status === "delivered") return "Delivered";
  if (result.status === "copied") return "Copied";
  if (result.status === "failed") return "Failed";
  return "Recent";
}
