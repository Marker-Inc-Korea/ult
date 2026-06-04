import { createElement } from "../../dom";
import { native } from "../../native";
import { deliveryLabels } from "../../promptUtils";
import type { AppDiagnostics } from "../../types";
import { errorMessage } from "../nativeShell";
import { createSettingsSection } from "../settingsLayout";

export function renderAdvancedSection(
  diagnostics: AppDiagnostics,
  status: HTMLElement,
) {
  const statusGroup = createElement("div", "settings-form");
  const lastResult = diagnostics.last_delivery_result;
  appendDiagnosticsRow(
    statusGroup,
    "Accessibility",
    diagnostics.accessibility.trusted ? "Ready" : "Permission required",
  );
  appendDiagnosticsRow(
    statusGroup,
    "Last Result",
    lastResult ? lastResult.message : "No delivery result yet",
  );
  appendDiagnosticsRow(
    statusGroup,
    "Execution State",
    lastResult ? lastResult.execution_state : "No execution yet",
  );
  appendDiagnosticsRow(
    statusGroup,
    "Last Kind",
    lastResult ? promptKindLabel(lastResult.prompt_kind) : "No execution yet",
  );
  appendDiagnosticsRow(
    statusGroup,
    "Last Mode",
    lastResult ? deliveryLabels[lastResult.mode] : "No execution yet",
  );
  appendDiagnosticsRow(
    statusGroup,
    "Last Timestamp",
    lastResult ? new Date(lastResult.timestamp_ms).toLocaleString() : "No execution yet",
  );
  appendDiagnosticsRow(statusGroup, "Last Delivery Issue", lastDeliveryIssue(diagnostics));
  appendDiagnosticsRow(
    statusGroup,
    "Last Target",
    lastResult?.target_application
      ? targetApplicationLabel(lastResult.target_application)
      : "No target observed",
  );
  appendDiagnosticsRow(statusGroup, "Next Action", nextDiagnosticAction(diagnostics));
  appendDiagnosticsRow(
    statusGroup,
    "Open Shortcut",
    diagnostics.app_shortcuts[0] ?? "Not registered",
  );
  appendDiagnosticsRow(
    statusGroup,
    "Launcher Shortcut",
    diagnostics.app_shortcuts[1] ?? "Not registered",
  );
  appendDiagnosticsRow(
    statusGroup,
    "Launcher Scratch Shortcut",
    diagnostics.app_shortcuts[2] ?? "Not registered",
  );
  appendDiagnosticsLongRow(statusGroup, "App data", diagnostics.config_path);

  const identityGroup = createElement("div", "settings-form");
  appendDiagnosticsRow(identityGroup, "Version", diagnostics.app_version);
  appendDiagnosticsRow(identityGroup, "Bundle ID", diagnostics.app_identity.bundle_identifier);
  appendDiagnosticsRow(identityGroup, "Launch Kind", diagnostics.app_identity.launch_kind);
  appendDiagnosticsRow(identityGroup, "Signing", diagnostics.app_identity.signing_status);
  appendDiagnosticsLongRow(identityGroup, "Running Path", diagnostics.app_identity.running_path);
  appendDiagnosticsLongRow(
    identityGroup,
    "Accessibility Identity",
    diagnostics.app_identity.accessibility_identity_note,
  );

  const coordinateGroup = createElement("div", "settings-form");
  appendDiagnosticsRow(
    coordinateGroup,
    "Cursor",
    diagnostics.overlay_coordinates.cursor_physical_position,
  );
  appendDiagnosticsRow(
    coordinateGroup,
    "Active Display",
    diagnostics.overlay_coordinates.active_display_name,
  );
  appendDiagnosticsLongRow(
    coordinateGroup,
    "Display Bounds",
    diagnostics.overlay_coordinates.active_display_physical_bounds,
  );
  appendDiagnosticsRow(
    coordinateGroup,
    "Scale Factor",
    diagnostics.overlay_coordinates.active_display_scale_factor,
  );
  appendDiagnosticsLongRow(
    coordinateGroup,
    "Palette Window",
    diagnostics.overlay_coordinates.palette_window_physical_bounds,
  );
  appendDiagnosticsRow(
    coordinateGroup,
    "Webview Pointer",
    diagnostics.overlay_coordinates.webview_pointer_position,
  );

  const recoveryGroup = createElement("div", "settings-form");
  recoveryGroup.append(createDiagnosticsExportAction(status));
  appendDiagnosticsLongRow(
    recoveryGroup,
    "Reset Command",
    diagnostics.app_identity.stale_permission_reset_command,
  );
  const recoveryAction = createElement("section", "settings-row diagnostics-info-row");
  const recoveryText = createElement("div", "settings-row-text");
  recoveryText.append(
    createElement("strong", undefined, "Stale Permission"),
    createElement(
      "span",
      undefined,
      "Use only when macOS shows stale Accessibility state. You must grant permission again after reset.",
    ),
  );
  const copyReset = createElement("button", undefined, "Copy Command");
  copyReset.type = "button";
  copyReset.addEventListener("click", () => {
    const write = navigator.clipboard?.writeText(
      diagnostics.app_identity.stale_permission_reset_command,
    ) ?? Promise.reject(new Error("clipboard unavailable"));
    void write
      .then(() => {
        status.textContent = "Reset command copied.";
      })
      .catch(() => {
        status.textContent = "Could not copy command.";
      });
  });
  recoveryAction.append(recoveryText, copyReset);
  recoveryGroup.append(recoveryAction);

  const libraryGroup = createElement("div", "settings-form");
  libraryGroup.append(
    createLibraryAction(
      "Personal Library",
      "Opens the local prompt and context library folder in Finder.",
      "Reveal Folder",
      status,
      () => native.openInterventionLibraryFolder()
        .then(() => {
          status.textContent = "Personal Library revealed.";
        }),
    ),
    createLibraryAction(
      "Reload Library",
      "Reloads prompt and context files from disk without changing the current section.",
      "Reload",
      status,
      () => native.reloadInterventionLibrary()
        .then((result) => {
          status.textContent = `Library reloaded with ${result.artifacts.length} item${
            result.artifacts.length === 1 ? "" : "s"
          }.`;
        }),
    ),
  );

  return [
    createSettingsSection("Delivery Diagnostics", [statusGroup]),
    createSettingsSection("App Identity", [identityGroup]),
    createSettingsSection("Coordinates", [coordinateGroup]),
    createSettingsSection("Library", [libraryGroup]),
    createSettingsSection("Recovery", [recoveryGroup]),
  ];
}

function createDiagnosticsExportAction(status: HTMLElement) {
  const row = createElement("section", "settings-row diagnostics-info-row");
  const text = createElement("div", "settings-row-text");
  text.append(
    createElement("strong", undefined, "Diagnostics Export"),
    createElement(
      "span",
      undefined,
      "Writes app identity, permission state, config paths, and recent metadata-only failures.",
    ),
  );
  const exportButton = createElement("button", undefined, "Export Diagnostics");
  exportButton.type = "button";
  exportButton.addEventListener("click", () => {
    status.textContent = "Exporting diagnostics...";
    void native.exportAppDiagnostics()
      .then((result) => {
        status.textContent =
          `Diagnostics exported to ${result.file_path} (${result.failure_count} recent failures).`;
      })
      .catch((error) => {
        status.textContent = errorMessage(error, "Failed to export diagnostics");
      });
  });
  row.append(text, exportButton);
  return row;
}

function createLibraryAction(
  title: string,
  detail: string,
  label: string,
  status: HTMLElement,
  action: () => Promise<void>,
) {
  const row = createElement("section", "settings-row diagnostics-info-row");
  const text = createElement("div", "settings-row-text");
  text.append(
    createElement("strong", undefined, title),
    createElement("span", undefined, detail),
  );
  const button = createElement("button", undefined, label);
  button.type = "button";
  button.addEventListener("click", () => {
    status.textContent = `${label}...`;
    void action().catch((error) => {
      status.textContent = errorMessage(error, `Failed to ${label.toLowerCase()}`);
    });
  });
  row.append(text, button);
  return row;
}

function promptKindLabel(kind: string | null | undefined) {
  switch (kind) {
    case "bundled":
      return "Bundled";
    case "local":
      return "Local";
    case "template":
      return "Template";
    case "scratch":
      return "Scratch Prompt";
    case "context":
      return "Context";
    default:
      return "Unknown item";
  }
}

function appendDiagnosticsRow(container: HTMLElement, label: string, value: string) {
  const row = createElement("section", "settings-row diagnostics-info-row");
  const text = createElement("div", "settings-row-text");
  text.append(createElement("strong", undefined, label));
  row.append(text, createElement("span", "diagnostics-value", value));
  container.append(row);
}

function appendDiagnosticsLongRow(container: HTMLElement, label: string, value: string) {
  const row = createElement("section", "settings-row diagnostics-info-row");
  const text = createElement("div", "settings-row-text");
  text.append(createElement("strong", undefined, label));
  row.append(text, createElement("span", "diagnostics-value is-long", value));
  container.append(row);
}

function targetApplicationLabel(
  target: NonNullable<AppDiagnostics["last_delivery_result"]>["target_application"],
) {
  if (!target) return "No target observed";
  const name = target.name || "Unknown app";
  const bundle = target.bundle_id || "no bundle id";
  return `${name} (${bundle})`;
}

function lastDeliveryIssue(diagnostics: AppDiagnostics) {
  const result = diagnostics.last_delivery_result;
  if (!result) return "No delivery issue recorded";
  if (result.status === "delivered" || result.status === "copied") return "No delivery issue";
  return result.diagnostic?.summary ?? result.message;
}

function nextDiagnosticAction(diagnostics: AppDiagnostics) {
  const result = diagnostics.last_delivery_result;
  if (!diagnostics.accessibility.trusted) {
    return "Retry native delivery; macOS settings opens when permission is needed.";
  }
  if (!result) return "No action needed";
  return result.diagnostic?.action ?? "No action needed";
}
