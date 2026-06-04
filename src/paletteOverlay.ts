import { createElement } from "./dom";
import { renderPromptPalette } from "./paletteRenderers";
import {
  acceptPromptPaletteScratchRefinement,
  createPromptPaletteRuntime,
  positionPromptPalette,
  restorePromptPaletteScratchRefinementSource,
  selectInterventionArtifactInPalette,
  selectedPrompt,
  setPromptPaletteActiveState,
  setPromptPaletteLoadedDeliveryMode,
  setPromptPaletteLauncherFeedback,
  setPromptPaletteLibraryFilter,
  setPromptPaletteLibraryQuery,
  setPromptPaletteLibrarySort,
  setPromptPaletteOverlayMode,
  setPromptPalettePageDelta,
  setPromptPaletteScratchText,
  setPromptPaletteSearchQuery,
  setPromptPaletteSelectedIndex,
  setPromptPaletteTemplateValue,
  type LauncherLibraryDiagnostic,
  type LauncherLibraryFilter,
  type LauncherLibrarySort,
  type PromptPaletteRuntime,
} from "./paletteRuntime";
import { native } from "./native";
import { promptScope } from "./promptUtils";
import { bindPaletteInput } from "./overlay/shared/inputController";
import { removeSearchComposerHandle } from "./searchComposer";
import {
  applyLoadedPrompt,
  cancelTemplate,
  type PreparePromptOptions,
  preparePromptForExecution,
  pasteSelectedEphemeralContext,
  submitTemplateValues,
} from "./overlay/loaded/deliveryController";
import {
  loadOverlayData,
  orderPaletteArtifacts,
} from "./overlay/shared/promptLoad";
import {
  applySearchComposer,
  loadSearchSelectionOrPrompt,
  runLauncherCommand,
  selectedLauncherSearchAction,
} from "./overlay/launcher/searchController";
import {
  selectLauncherCommandDelta,
  selectLauncherPanelActionDelta,
  type LauncherCommand,
} from "./overlay/launcher/launcherCommands";
import { commandHandle } from "./overlay/launcher/searchCommandPresentation";
import { selectEphemeralContextPickerDelta } from "./overlay/launcher/ephemeralContextState";
import { createArtifactPanelController } from "./overlay/launcher/artifactPanelController";
import { createGitHubImportController } from "./overlay/launcher/githubImportController";
import { createLibraryMutationController } from "./overlay/launcher/libraryMutationController";
import { createProjectWriteController } from "./overlay/launcher/projectWriteController";
import { createRecoveryPanelController } from "./overlay/launcher/recoveryPanelController";
import { searchRowsForPalette } from "./overlay/launcher/searchSelection";
import { libraryRowsForPalette } from "./overlay/launcher/libraryRows";
import {
  prepareScratchInput,
  refineScratchInput,
} from "./overlay/launcher/scratchController";
import { resolveTemplateDynamicEnum } from "./overlay/launcher/templateController";
import { createWorkflowInputController } from "./overlay/launcher/workflowInputController";
import {
  bindNativePaletteSync,
  syncInterventionShortcutsFromNative,
} from "./overlay/shared/nativeOverlaySync";
import { startLoadedPointerTracking } from "./overlay/shared/pointerTracking";
import { applyAppearance } from "./theme";
import type {
  AppSettings,
  AccessibilityStatus,
  DeliveryMode,
  PromptDefinition,
  UserLauncherCommandDefinition,
  UsageHistoryEntry,
} from "./types";

export { orderPaletteArtifacts } from "./overlay/shared/promptLoad";

export async function renderPaletteOverlay(root: HTMLElement) {
  const {
    prompts,
    userCommands,
    libraryDiagnostics,
    appSettings,
    accessibilityStatus,
    history,
  } = await loadOverlayData();
  applyAppearance(appSettings.appearance);
  root.replaceChildren(createPaletteOverlay(
    orderPaletteArtifacts(prompts, history, appSettings.pinned_artifact_ids),
    userCommands,
    libraryDiagnostics,
    appSettings,
    accessibilityStatus,
    history,
  ));
}

function createPaletteOverlay(
  prompts: PromptDefinition[],
  userCommands: UserLauncherCommandDefinition[],
  libraryDiagnostics: LauncherLibraryDiagnostic[],
  appSettings: AppSettings,
  accessibilityStatus: AccessibilityStatus | null,
  history: UsageHistoryEntry[],
) {
  const surface = createElement("main", "palette-overlay is-idle-mode");
  const palette = createPromptPaletteRuntime(
    prompts,
    appSettings,
    accessibilityStatus,
    history,
    userCommands,
    libraryDiagnostics,
  );
  const actions = createPaletteActions(surface, palette);

  void syncInterventionShortcutsFromNative(palette);

  renderPromptPalette(palette, actions);
  positionPromptPalette(palette);
  surface.append(palette.container, palette.badge);

  bindNativePaletteSync(palette, actions);
  bindPaletteInput(surface, palette, actions);

  return surface;
}

function createPaletteActions(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  const rerender = () => {
    renderPromptPalette(palette, actions);
    positionPromptPalette(palette);
  };
  const trackLoadedPointer = () => {
    startLoadedPointerTracking(palette, rerender);
  };
  const preparePrompt = (
    prompt: PromptDefinition,
    contextIds: string[],
    options?: PreparePromptOptions,
  ) => {
    preparePromptForExecution(
      surface,
      palette,
      prompt,
      contextIds,
      rerender,
      persistSelection,
      trackLoadedPointer,
      options,
    );
  };

  const persistSelection = (prompt = selectedPrompt(palette)) => {
    if (!prompt) return;
    if (promptScope(prompt) !== "persistent") return;
    void native.selectInterventionArtifact(prompt.id).catch(() => undefined);
  };

  const libraryMutations = createLibraryMutationController({
    palette,
    rerender,
  });
  const projectWrite = createProjectWriteController({
    palette,
    rerender,
  });
  const artifactPanels = createArtifactPanelController({
    surface,
    palette,
    rerender,
    preparePrompt,
    openProjectArtifactWrite: projectWrite.openProjectArtifactWrite,
    applyLibraryResult: libraryMutations.applyLibraryResult,
  });
  const githubImport = createGitHubImportController({
    palette,
    rerender,
    applyLibraryResult: libraryMutations.applyLibraryResult,
  });
  const workflowInput = createWorkflowInputController({
    palette,
    rerender,
    applyLibraryResult: libraryMutations.applyLibraryResult,
    preparePrompt,
  });
  const recoveryPanel = createRecoveryPanelController({
    palette,
    rerender,
    preparePrompt,
  });
  const runCommand = (command: LauncherCommand) => {
    runLauncherCommand(
      surface,
      palette,
      command,
      rerender,
      preparePrompt,
      artifactPanels.openArtifactComposer,
      githubImport.openGitHubImport,
      projectWrite.openProjectArtifactWrite,
      projectWrite.openProjectSetup,
      githubImport.openStarterPacks,
    );
  };
  const copyCommandHandle = (command: LauncherCommand) => {
    const handle = commandHandle(command);
    const clipboard = typeof navigator === "undefined" ? null : navigator.clipboard;
    const write = clipboard?.writeText(handle)
      ?? Promise.reject(new Error("Clipboard is unavailable."));
    void write
      .then(() => {
        setPromptPaletteLauncherFeedback(palette, `Copied ${handle}.`);
        rerender();
      })
      .catch((error) => {
        setPromptPaletteLauncherFeedback(
          palette,
          commandClipboardErrorMessage(error),
          "warning",
        );
        rerender();
      });
  };
  const loadSelected = (target: EventTarget | null) => {
    void loadPromptFromPalette(
      surface,
      palette,
      target,
      rerender,
      persistSelection,
      runCommand,
    );
  };

  const actions = {
    surface,
    loadSelected,
    applySearchComposer: () => {
      if (palette.surfaceMode !== "search") {
        void loadPromptFromPalette(surface, palette, null, rerender, persistSelection);
        return;
      }
      applySearchComposer(palette, rerender, preparePrompt);
    },
    applyLoaded: () => {
      void applyLoadedPrompt(surface, palette);
    },
    applyContextPicker: () => {
      void pasteSelectedEphemeralContext(surface, palette);
    },
    submitTemplate: (values: Record<string, string>) => {
      submitTemplateValues(surface, palette, values, rerender, trackLoadedPointer);
    },
    cancelTemplate: () => {
      cancelTemplate(surface, palette, rerender);
    },
    resolveTemplateVariable: (variable: string) => {
      void resolveTemplateDynamicEnum(palette, variable, rerender);
    },
    updateTemplateValue: (variable: string, value: string) => {
      setPromptPaletteTemplateValue(palette, variable, value);
    },
    updateScratchText: (text: string) => {
      setPromptPaletteScratchText(palette, text);
    },
    updateLoadedDeliveryMode: (mode: DeliveryMode) => {
      if (!setPromptPaletteLoadedDeliveryMode(palette, mode)) return;
      rerender();
    },
    updateSearchQuery: (query: string, options?: { rerender?: boolean }) => {
      if (!setPromptPaletteSearchQuery(palette, query)) return;
      if (options?.rerender === false) {
        positionPromptPalette(palette);
        return;
      }
      rerender();
    },
    setLibraryFilter: (filter: LauncherLibraryFilter) => {
      if (!setPromptPaletteLibraryFilter(palette, filter)) {
        positionPromptPalette(palette);
        return;
      }
      rerender();
    },
    updateLibraryQuery: (query: string) => {
      if (!setPromptPaletteLibraryQuery(palette, query)) {
        positionPromptPalette(palette);
        return;
      }
      rerender();
    },
    setLibrarySort: (sort: LauncherLibrarySort) => {
      if (!setPromptPaletteLibrarySort(palette, sort)) {
        positionPromptPalette(palette);
        return;
      }
      rerender();
    },
    removeSearchHandle: (handle: string) => {
      const nextQuery = removeSearchComposerHandle(palette.searchQuery, handle);
      if (!setPromptPaletteSearchQuery(palette, nextQuery)) return;
      rerender();
    },
    refineScratch: () => {
      void refineScratchInput(palette, rerender);
    },
    acceptScratchRefinement: () => {
      if (!acceptPromptPaletteScratchRefinement(palette)) return;
      rerender();
    },
    restoreScratchOriginal: () => {
      if (!restorePromptPaletteScratchRefinementSource(palette)) return;
      rerender();
    },
    submitScratch: () => {
      void prepareScratchInput(surface, palette, rerender, trackLoadedPointer);
    },
    cancelScratch: () => {
      void native.unloadOverlay().catch(() => undefined);
    },
    selectDelta: (delta: number) => {
      if (
        palette.surfaceMode !== "palette"
        && palette.surfaceMode !== "search"
        && palette.surfaceMode !== "library"
      ) return;
      if (delta === 0) {
        positionPromptPalette(palette);
        return;
      }
      if (palette.surfaceMode === "search") {
        const { rows } = searchRowsForPalette(palette);
        if (!selectLauncherCommandDelta(palette, delta, rows.length)) return;
        rerender();
        return;
      }
      if (palette.surfaceMode === "library") {
        const rows = libraryRowsForPalette(palette);
        if (!selectLauncherCommandDelta(palette, delta, rows.length)) return;
        rerender();
        return;
      }
      if (!selectInterventionArtifactInPalette(palette, delta)) return;
      if (palette.surfaceMode === "palette") {
        persistSelection();
      }
      rerender();
    },
    selectLauncherCommandDelta: (delta: number, count: number) => {
      if (palette.surfaceMode !== "search" && palette.surfaceMode !== "library") return;
      if (!selectLauncherCommandDelta(palette, delta, count)) return;
      rerender();
    },
    selectPanelActionDelta: (delta: number, count: number) => {
      if (!palette.launcherArtifactPanel) return;
      if (!selectLauncherPanelActionDelta(palette, delta, count)) return;
      rerender();
    },
    runLauncherCommand: (command: LauncherCommand) => {
      runCommand(command);
    },
    copyLauncherCommandHandle: (command: LauncherCommand) => {
      copyCommandHandle(command);
    },
    openArtifactReader: (artifactId?: string | null) => {
      artifactPanels.openArtifactPanel("reader", artifactId);
    },
    openArtifactActions: (artifactId?: string | null) => {
      artifactPanels.openArtifactPanel("actions", artifactId);
    },
    openArtifactComposer: artifactPanels.openArtifactComposer,
    openArtifactDelete: artifactPanels.openArtifactDelete,
    openProjectArtifactWrite: projectWrite.openProjectArtifactWrite,
    openProjectSetup: projectWrite.openProjectSetup,
    closeArtifactPanel: artifactPanels.closeArtifactPanel,
    runArtifactAction: artifactPanels.runArtifactAction,
    runRecoveryAction: recoveryPanel.runRecoveryAction,
    saveArtifactDraft: libraryMutations.saveArtifactDraft,
    deleteArtifact: libraryMutations.deleteArtifact,
    openStarterPacks: githubImport.openStarterPacks,
    openGitHubImport: githubImport.openGitHubImport,
    previewGitHubImport: githubImport.previewGitHubImport,
    importGitHubPackages: githubImport.importGitHubPackages,
    previewProjectArtifactWrite: projectWrite.previewProjectArtifactWrite,
    writeProjectArtifact: projectWrite.writeProjectArtifact,
    previewProjectSetup: projectWrite.previewProjectSetup,
    writeProjectSetup: projectWrite.writeProjectSetup,
    submitWorkflowInput: workflowInput.submitWorkflowInput,
    openContextStack: () => {
      setPromptPaletteOverlayMode(surface, palette, "launcher", "stack");
      rerender();
    },
    selectContextPickerDelta: (delta: number) => {
      if (palette.surfaceMode !== "context-picker") return;
      if (!selectEphemeralContextPickerDelta(palette, delta)) return;
      rerender();
    },
    selectPageDelta: (delta: number) => {
      if (
        palette.surfaceMode !== "palette"
        && palette.surfaceMode !== "search"
        && palette.surfaceMode !== "library"
      ) return;
      if (palette.surfaceMode === "search") {
        const { rows } = searchRowsForPalette(palette);
        const pageDelta = delta > 0 ? rows.length - 1 : 1 - rows.length;
        if (!selectLauncherCommandDelta(palette, pageDelta, rows.length)) return;
        rerender();
        return;
      }
      if (palette.surfaceMode === "library") {
        const rows = libraryRowsForPalette(palette);
        const pageDelta = delta > 0 ? rows.length - 1 : 1 - rows.length;
        if (!selectLauncherCommandDelta(palette, pageDelta, rows.length)) return;
        rerender();
        return;
      }
      if (!setPromptPalettePageDelta(palette, delta)) return;
      if (palette.surfaceMode === "palette") {
        persistSelection();
      }
      rerender();
    },
    selectAndLoad: (index: number, target: EventTarget | null) => {
      if (
        palette.surfaceMode !== "palette"
        && palette.surfaceMode !== "search"
      ) return;
      setPromptPaletteSelectedIndex(palette, index);
      rerender();
      loadSelected(target);
    },
    unload: () => {
      void native.unloadOverlay().catch(() => undefined);
    },
    rerender,
    setActive: (active: boolean) => {
      setPromptPaletteActiveState(surface, palette, active);
      rerender();
    },
  };

  return actions;
}

async function loadPromptFromPalette(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  target: EventTarget | null,
  rerender: () => void,
  persistSelection: (prompt?: PromptDefinition) => void,
  runSearchCommand?: (command: LauncherCommand) => void,
) {
  const targetElement = target as HTMLElement | null;
  const launcherRowIndex = targetElement
    ?.closest<HTMLElement>("[data-launcher-row-index]")
    ?.dataset.launcherRowIndex;
  const promptIndex = targetElement
    ?.closest<HTMLElement>(".palette-prompt-control")
    ?.dataset.promptIndex;
  let shouldRerender = false;
  if (launcherRowIndex !== undefined) {
    const nextIndex = Number(launcherRowIndex);
    if (Number.isInteger(nextIndex) && nextIndex >= 0) {
      palette.launcherCommandIndex = nextIndex;
      shouldRerender = true;
    }
  }
  if (promptIndex !== undefined) {
    setPromptPaletteSelectedIndex(palette, Number(promptIndex));
    shouldRerender = true;
  }
  if (shouldRerender) {
    rerender();
  }

  const prompt = selectedPrompt(palette)
    ?? (palette.launcherMode === "recent"
      ? palette.prompts[palette.selectedIndex]
      : undefined);
  const prepareSearchPrompt = (selected: PromptDefinition, contextIds: string[]) => {
    preparePromptForExecution(
      surface,
      palette,
      selected,
      contextIds,
      rerender,
      persistSelection,
      () => {
        startLoadedPointerTracking(palette, rerender);
      },
    );
  };
  if (palette.surfaceMode === "search") {
    if (palette.launcherMode === "search") {
      const selection = selectedLauncherSearchAction(palette);
      if (selection.type === "command") {
        runSearchCommand?.(selection.command);
        return;
      }
      loadSearchSelectionOrPrompt(
        palette,
        selection.type === "artifact" ? selection.prompt : prompt ?? null,
        rerender,
        prepareSearchPrompt,
      );
      return;
    }
    loadSearchSelectionOrPrompt(
      palette,
      prompt ?? null,
      rerender,
      prepareSearchPrompt,
    );
    return;
  }

  if (!prompt) return;
  preparePromptForExecution(
    surface,
    palette,
    prompt,
    [],
    rerender,
    persistSelection,
    () => {
      startLoadedPointerTracking(palette, rerender);
    },
  );
}

function commandClipboardErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Command handle could not be copied.";
}
