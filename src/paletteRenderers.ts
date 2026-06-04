import type { PromptPaletteRuntime } from "./paletteRuntime";
import { renderClipFeedback } from "./overlay/shared/clipFeedbackSurface";
import { renderContextPicker } from "./overlay/launcher/contextPickerSurface";
import { renderLoadedIntervention } from "./overlay/loaded/loadedSurface";
import { renderPanelPalette } from "./overlay/palette/paletteSurface";
import type { PaletteRenderActions } from "./overlay/shared/renderTypes";
import { renderLibrarySurface } from "./overlay/launcher/librarySurface";
import { renderScratchPrompt } from "./overlay/launcher/scratchSurface";
import { renderSearchSurface } from "./overlay/launcher/searchSurface";
import { renderTemplateForm } from "./overlay/launcher/templateSurface";

export type { PaletteRenderActions } from "./overlay/shared/renderTypes";

export function renderPromptPalette(
  palette: PromptPaletteRuntime,
  actions: PaletteRenderActions,
) {
  palette.container.replaceChildren();
  palette.container.className = "prompt-palette";
  palette.container.setAttribute(
    "aria-label",
    palette.overlayMode === "launcher"
      ? launcherAriaLabel(palette)
      : "Palette",
  );
  palette.container.setAttribute("role", "menu");
  renderLoadedBadge(palette);

  if (palette.surfaceMode === "idle") {
    return;
  }

  if (palette.surfaceMode === "clip-feedback") {
    renderClipFeedback(palette);
    return;
  }

  if (palette.surfaceMode === "template") {
    renderTemplateForm(palette, actions);
    return;
  }

  if (palette.surfaceMode === "scratch") {
    renderScratchPrompt(palette, actions);
    return;
  }

  if (palette.surfaceMode === "context-picker") {
    renderContextPicker(palette, actions);
    return;
  }

  if (palette.surfaceMode === "loaded") {
    renderLoadedIntervention(palette, actions);
    return;
  }

  if (palette.surfaceMode === "search") {
    renderSearchSurface(palette, actions);
    return;
  }

  if (palette.surfaceMode === "library") {
    renderLibrarySurface(palette, actions);
    return;
  }

  renderPanelPalette(palette, actions);
}

function launcherAriaLabel(palette: PromptPaletteRuntime) {
  if (palette.launcherMode === "scratch" || palette.launcherMode === "refine") {
    return "Launcher scratch prompt";
  }
  if (palette.launcherMode === "variables") return "Launcher variables";
  if (palette.launcherMode === "stack") return "Launcher clipboard stack";
  if (palette.launcherMode === "library") return "Launcher library";
  return "Launcher search";
}

function renderLoadedBadge(palette: PromptPaletteRuntime) {
  palette.badge.replaceChildren();
  palette.badge.setAttribute("aria-hidden", "true");
}
