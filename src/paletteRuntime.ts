import { createElement } from "./dom";
import {
  positionPromptPalette,
  schedulePromptPalettePosition,
} from "./overlay/shared/positioning";
import { ensureSelectedPromptVisible } from "./overlay/launcher/searchState";
import { syncClipFeedbackFromCatalog } from "./overlay/launcher/ephemeralContextState";
import { syncOverlaySurfaceState } from "./overlay/shared/surfaceState";
import {
  artifactCreatePanelSignature,
} from "./overlay/launcher/artifactCreateState";
import type {
  AccessibilityStatus,
  AppSettings,
  LauncherMode,
  OverlayMode,
  PromptDefinition,
  UserLauncherCommandDefinition,
  UsageHistoryEntry,
} from "./types";
import type {
  LauncherArtifactPanel,
  LauncherLibraryDiagnostic,
  LauncherLibraryFilter,
  LauncherLibrarySort,
  LauncherFeedback,
  PromptPaletteRuntimeState,
} from "./paletteRuntimeState";
import {
  initialContextStackRuntimeState,
  initialDeliveryRuntimeState,
  initialLauncherPanelState,
  initialLauncherLibraryState,
  initialLauncherSearchState,
  initialNativeOverlaySyncState,
  initialOverlaySessionState,
  initialPaletteSelectionState,
  initialPointerRuntimeState,
  initialScratchRuntimeState,
  initialTemplateRuntimeState,
  resetLauncherPanelState,
  transitionPromptPaletteRuntimeState,
} from "./paletteRuntimeState";

export { positionPromptPalette } from "./overlay/shared/positioning";
export {
  PROMPTS_PER_PAGE,
  palettePickerPrompts,
  selectInterventionArtifactInPalette,
  selectedPrompt,
  setPromptPalettePageDelta,
  setPromptPaletteSearchQuery,
  setPromptPaletteSelectedIndex,
  visiblePrompts,
} from "./overlay/launcher/searchState";
export {
  acceptPromptPaletteScratchRefinement,
  failPromptPaletteScratchRefinement,
  finishPromptPaletteScratchRefinement,
  isPromptPaletteScratchRefinementCurrent,
  restorePromptPaletteScratchRefinementSource,
  setPromptPaletteScratchMetaConfirmation,
  setPromptPaletteScratchText,
  startPromptPaletteScratchRefinement,
} from "./overlay/launcher/scratchState";
export {
  setPromptPaletteApplyingState,
  setPromptPaletteDeliveryResult,
  setPromptPaletteLoadedDeliveryMode,
  setPromptPaletteLoadedState,
} from "./overlay/loaded/deliveryState";
export {
  clearPromptPaletteTemplateDynamicEnums,
  clearPromptPaletteTemplateState,
  setPromptPaletteTemplateDynamicEnumLoading,
  setPromptPaletteTemplateDynamicEnumResult,
  setPromptPaletteTemplateState,
  setPromptPaletteTemplateValue,
  setPromptPaletteTemplateValidationErrors,
  templatePrompt,
} from "./overlay/launcher/templateState";
export { normalizeOverlaySession } from "./paletteRuntimeState";

export type PromptPaletteRuntime = PromptPaletteRuntimeState & {
  container: PromptPaletteElement;
  badge: HTMLDivElement;
};

export type VisiblePromptEntry = {
  prompt: PromptDefinition;
  index: number;
  key: number;
};

export type {
  LauncherArtifactPanel,
  LauncherLibraryDiagnostic,
  LauncherLibraryFilter,
  LauncherLibrarySort,
  LauncherFeedback,
} from "./paletteRuntimeState";

type PromptPaletteElement = HTMLDivElement & {
  __runtime?: PromptPaletteRuntime;
};

export function createPromptPaletteRuntime(
  prompts: PromptDefinition[],
  appSettings: AppSettings,
  accessibilityStatus?: AccessibilityStatus | null,
  usageHistory: UsageHistoryEntry[] = [],
  userCommands: UserLauncherCommandDefinition[] = [],
  libraryDiagnostics: LauncherLibraryDiagnostic[] = [],
): PromptPaletteRuntime {
  const container = createElement("div", "prompt-palette") as PromptPaletteElement;
  const badge = createElement("div", "loaded-badge") as HTMLDivElement;
  const runtime: PromptPaletteRuntime = {
    container,
    badge,
    ...initialOverlaySessionState(),
    ...initialPointerRuntimeState(),
    ...initialLauncherSearchState(),
    ...initialLauncherLibraryState(),
    ...initialLauncherPanelState(),
    ...initialPaletteSelectionState(),
    ...initialDeliveryRuntimeState(),
    ...initialTemplateRuntimeState(),
    ...initialScratchRuntimeState(),
    ...initialContextStackRuntimeState(),
    prompts,
    userCommands,
    launcherLibraryDiagnostics: libraryDiagnostics,
    usageHistory,
    appSettings,
    accessibilityTrusted: accessibilityStatus?.trusted ?? null,
    ...initialNativeOverlaySyncState(),
  };
  syncClipFeedbackFromCatalog(runtime);
  container.__runtime = runtime;
  positionPromptPalette(runtime);
  return runtime;
}

export function setPromptPaletteActiveState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  active: boolean,
) {
  const result = transitionPromptPaletteRuntimeState(palette, {
    type: "set-active",
    active,
    inactiveSurfaceMode: active
      ? undefined
      : syncClipFeedbackFromCatalog(palette) ? "clip-feedback" : "idle",
  });
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
  palette.selectedIndex = Math.min(
    palette.selectedIndex,
    Math.max(0, palette.prompts.length - 1),
  );
  ensureSelectedPromptVisible(palette);
}

export function setPromptPaletteOverlayMode(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  mode: OverlayMode,
  launcherMode?: LauncherMode | null,
) {
  const result = transitionPromptPaletteRuntimeState(palette, {
    type: "set-overlay-mode",
    mode,
    launcherMode,
  });
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
  if (result.schedulePosition) {
    schedulePromptPalettePosition(palette);
  }
}

export function setPromptPaletteLauncherFeedback(
  palette: PromptPaletteRuntime,
  message: string,
  tone: LauncherFeedback["tone"] = "neutral",
) {
  const next = message.trim();
  if (!next) {
    return clearPromptPaletteLauncherFeedback(palette);
  }
  if (
    palette.launcherFeedback?.message === next
    && palette.launcherFeedback.tone === tone
  ) {
    return false;
  }
  palette.launcherFeedback = { message: next, tone };
  return true;
}

export function setPromptPaletteArtifactPanel(
  palette: PromptPaletteRuntime,
  panel: LauncherArtifactPanel | null,
) {
  const previous = palette.launcherArtifactPanel;
  const changed = previous?.mode !== panel?.mode
    || panelArtifactId(previous) !== panelArtifactId(panel)
    || panelSignature(previous) !== panelSignature(panel);
  if (!changed) return false;
  if (panel) {
    palette.launcherArtifactPanel = panel;
    palette.launcherPanelActionIndex = 0;
  } else {
    resetLauncherPanelState(palette);
  }
  palette.launcherFeedback = null;
  return changed;
}

export function setPromptPaletteLibraryFilter(
  palette: PromptPaletteRuntime,
  filter: LauncherLibraryFilter,
) {
  if (palette.launcherLibraryFilter === filter) return false;
  palette.launcherLibraryFilter = filter;
  palette.launcherCommandIndex = 0;
  palette.launcherFeedback = null;
  return true;
}

export function setPromptPaletteLibraryQuery(
  palette: PromptPaletteRuntime,
  query: string,
) {
  if (palette.launcherLibraryQuery === query) return false;
  palette.launcherLibraryQuery = query;
  palette.launcherCommandIndex = 0;
  palette.launcherFeedback = null;
  return true;
}

export function setPromptPaletteLibrarySort(
  palette: PromptPaletteRuntime,
  sort: LauncherLibrarySort,
) {
  if (palette.launcherLibrarySort === sort) return false;
  palette.launcherLibrarySort = sort;
  palette.launcherCommandIndex = 0;
  palette.launcherFeedback = null;
  return true;
}

function panelArtifactId(panel: LauncherArtifactPanel | null) {
  if (
    !panel
    || panel.mode === "github-import"
    || panel.mode === "create"
    || panel.mode === "project-setup"
    || panel.mode === "recovery"
    || panel.mode === "skill-discovery"
    || panel.mode === "skill-scaffold"
    || panel.mode === "starter-packs"
    || panel.mode === "workflow-input"
  ) {
    return "";
  }
  return panel.artifactId ?? "";
}

function panelSignature(panel: LauncherArtifactPanel | null) {
  if (!panel) return "";
  if (panel.mode === "composer") {
    return [
      panel.kind,
      panel.artifactType,
      panel.initialId ?? "",
      panel.initialDraft?.id ?? "",
      panel.initialDraft?.title ?? "",
      panel.initialDraft?.prompt ?? "",
    ].join("\u0001");
  }
  if (panel.mode === "create") {
    return artifactCreatePanelSignature(panel);
  }
  if (panel.mode === "github-import") {
    return [
      panel.status,
      panel.url,
      panel.reference ?? "",
      panel.error ?? "",
      panel.preview?.commit ?? "",
      panel.preview?.entries.length ?? 0,
      panel.selectedPaths?.join("\u0000") ?? "",
      panel.result?.commit ?? "",
      panel.result?.imported_artifact_ids.join("\u0000") ?? "",
    ].join("\u0001");
  }
  if (panel.mode === "starter-packs") {
    return panel.selectedPackId;
  }
  if (panel.mode === "skill-discovery") {
    return panel.intent;
  }
  if (panel.mode === "skill-scaffold") {
    return panel.initialId ?? "";
  }
  if (panel.mode === "workflow-input") {
    return [
      panel.status,
      panel.commandId,
      panel.inputText,
      panel.contextHandleText,
      panel.error ?? "",
    ].join("\u0001");
  }
  if (panel.mode === "recovery") {
    return [
      panel.status,
      panel.entry.timestamp_ms,
      panel.entry.prompt_id ?? "",
      panel.entry.delivery_mode,
      panel.entry.result,
      panel.entry.diagnostic_code ?? "",
      panel.entry.target_application?.bundle_id ?? "",
      panel.entry.target_application?.name ?? "",
      panel.error ?? "",
      panel.message ?? "",
      panel.exportPath ?? "",
    ].join("\u0001");
  }
  if (panel.mode === "project-write") {
    return [
      panel.status,
      panel.writeKind,
      panel.targetDirectory,
      String(panel.overwrite),
      panel.error ?? "",
      panel.preview?.files.map((file) => `${file.path}:${file.action}`).join("\u0000") ?? "",
      panel.result?.written_files.join("\u0000") ?? "",
    ].join("\u0001");
  }
  if (panel.mode === "project-setup") {
    return [
      panel.status,
      panel.presetId ?? "",
      panel.targetDirectory,
      panel.selectedArtifactIds.join("\u0000"),
      String(panel.includeAgentsSnippet),
      panel.agentsSnippetArtifactId ?? "",
      String(panel.overwrite),
      panel.error ?? "",
      panel.preview?.planHash ?? "",
      panel.preview?.entries.map((entry) =>
        `${entry.artifactId}:${entry.writeKind}:${entry.error ?? ""}:${
          entry.preview?.files.map((file) => `${file.path}:${file.action}`).join("\u0002") ?? ""
        }`
      ).join("\u0000") ?? "",
      panel.result ? String(panel.result.ok) : "",
      panel.result?.writtenFiles.join("\u0000") ?? "",
      panel.result?.failedFiles.join("\u0000") ?? "",
    ].join("\u0001");
  }
  return "";
}

export function clearPromptPaletteLauncherFeedback(
  palette: PromptPaletteRuntime,
) {
  if (!palette.launcherFeedback) return false;
  palette.launcherFeedback = null;
  return true;
}

export function setPromptPaletteAccessibilityStatus(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  accessibilityStatus: AccessibilityStatus,
) {
  palette.accessibilityTrusted = accessibilityStatus.trusted;
  if (
    palette.active
    && palette.surfaceMode !== "loaded"
    && palette.surfaceMode !== "template"
    && !palette.deliveryInFlight
  ) {
    syncOverlaySurfaceState(surface, palette);
  } else {
    syncOverlaySurfaceState(surface, palette, palette.surfaceMode);
  }
  schedulePromptPalettePosition(palette);
}

export function setPromptPalettePointer(
  palette: PromptPaletteRuntime,
  x: number,
  y: number,
) {
  palette.x = Math.max(0, Math.min(window.innerWidth, x));
  palette.y = Math.max(0, Math.min(window.innerHeight, y));
  schedulePromptPalettePosition(palette);
}

export function setPromptPaletteClipFeedbackState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  x: number,
  y: number,
) {
  const result = transitionPromptPaletteRuntimeState(palette, { type: "set-clip-feedback" });
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
  setPromptPalettePointer(palette, x, y);
}

export function clearPromptPaletteClipFeedbackState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  const result = transitionPromptPaletteRuntimeState(palette, { type: "clear-clip-feedback" });
  if (!result.changed) return;
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
  if (result.schedulePosition) {
    schedulePromptPalettePosition(palette);
  }
}

export function setPromptPaletteAppSettings(
  palette: PromptPaletteRuntime,
  appSettings: AppSettings,
) {
  palette.appSettings = appSettings;
}

export function nextPromptPaletteSyncGeneration(palette: PromptPaletteRuntime) {
  palette.syncGeneration += 1;
  return palette.syncGeneration;
}

export function isPromptPaletteSyncGenerationCurrent(
  palette: PromptPaletteRuntime,
  generation: number,
) {
  return palette.syncGeneration === generation;
}

export function acceptPromptPaletteNativeOverlayEvent(
  palette: PromptPaletteRuntime,
  generation?: number,
) {
  if (generation === undefined || generation === null) return true;
  if (!Number.isFinite(generation)) return false;
  if (generation < palette.nativeOverlayGeneration) return false;
  palette.nativeOverlayGeneration = generation;
  return true;
}
