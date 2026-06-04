import { native } from "../../native";
import { STARTER_PACKS } from "../../data/starterPacks";
import {
  positionPromptPalette,
  setPromptPaletteArtifactPanel,
  type PromptPaletteRuntime,
} from "../../paletteRuntime";
import type { ApplyLibraryResult } from "./libraryMutationController";

export function createGitHubImportController(options: {
  palette: PromptPaletteRuntime;
  rerender: () => void;
  applyLibraryResult: ApplyLibraryResult;
}) {
  const { palette, rerender, applyLibraryResult } = options;

  const openStarterPacks = () => {
    if (!setPromptPaletteArtifactPanel(palette, {
      mode: "starter-packs",
      selectedPackId: STARTER_PACKS[0]?.id ?? "",
    })) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const openGitHubImport = () => {
    if (!setPromptPaletteArtifactPanel(palette, {
      mode: "github-import",
      status: "form",
      url: "",
      reference: null,
      preview: null,
      selectedPaths: [],
      error: null,
      result: null,
    })) {
      positionPromptPalette(palette);
      return;
    }
    rerender();
  };

  const previewGitHubImport = async (
    url: string,
    reference: string | null,
  ) => {
    const trimmedUrl = url.trim();
    const trimmedReference = reference?.trim() || null;
    if (!trimmedUrl) {
      setPromptPaletteArtifactPanel(palette, {
        mode: "github-import",
        status: "form",
        url: trimmedUrl,
        reference: trimmedReference,
        error: "Enter a GitHub repository URL.",
      });
      rerender();
      return;
    }
    setPromptPaletteArtifactPanel(palette, {
      mode: "github-import",
      status: "previewing",
      url: trimmedUrl,
      reference: trimmedReference,
      error: null,
    });
    rerender();
    try {
      const preview = await native.previewGitHubLibraryImport(trimmedUrl, trimmedReference);
      setPromptPaletteArtifactPanel(palette, {
        mode: "github-import",
        status: "preview",
        url: trimmedUrl,
        reference: trimmedReference,
        preview,
        selectedPaths: preview.entries.map((entry) => entry.source_path),
        error: null,
        result: null,
      });
      rerender();
    } catch (error) {
      setPromptPaletteArtifactPanel(palette, {
        mode: "github-import",
        status: "form",
        url: trimmedUrl,
        reference: trimmedReference,
        error: githubImportErrorMessage(error, "GitHub pack could not be previewed."),
      });
      rerender();
    }
  };

  const importGitHubPackages = async (
    url: string,
    reference: string | null,
    selectedPaths: string[],
  ) => {
    const current = palette.launcherArtifactPanel?.mode === "github-import"
      ? palette.launcherArtifactPanel
      : null;
    const cleanPaths = selectedPaths.map((path) => path.trim()).filter(Boolean);
    if (cleanPaths.length === 0) {
      setPromptPaletteArtifactPanel(palette, {
        mode: "github-import",
        status: "preview",
        url,
        reference,
        preview: current?.preview ?? null,
        selectedPaths: cleanPaths,
        error: "Select at least one package to import.",
      });
      rerender();
      return;
    }
    setPromptPaletteArtifactPanel(palette, {
      mode: "github-import",
      status: "importing",
      url,
      reference,
      preview: current?.preview ?? null,
      selectedPaths: cleanPaths,
      error: null,
    });
    rerender();
    try {
      const result = await native.importGitHubLibraryPack(url, reference, cleanPaths);
      applyLibraryResult(result.library, result.imported_artifact_ids[0] ?? null);
      setPromptPaletteArtifactPanel(palette, {
        mode: "github-import",
        status: "result",
        url,
        reference,
        preview: current?.preview ?? null,
        selectedPaths: cleanPaths,
        result,
        error: null,
      });
      rerender();
    } catch (error) {
      setPromptPaletteArtifactPanel(palette, {
        mode: "github-import",
        status: "preview",
        url,
        reference,
        preview: current?.preview ?? null,
        selectedPaths: cleanPaths,
        error: githubImportErrorMessage(error, "GitHub packages could not be imported."),
      });
      rerender();
    }
  };

  return {
    openStarterPacks,
    openGitHubImport,
    previewGitHubImport,
    importGitHubPackages,
  };
}

function githubImportErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return fallback;
}
