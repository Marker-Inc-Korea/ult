import type { PromptPaletteRuntime } from "../../paletteRuntime";

export function positionPromptPalette(palette: PromptPaletteRuntime) {
  if (isLauncherSurface(palette)) {
    palette.container.style.transform = "translate3d(0, 0, 0)";
    palette.container.classList.toggle("is-flipped-x", false);
    palette.container.classList.toggle("is-flipped-y", false);
    positionLoadedBadge(palette);
    return;
  }
  palette.container.style.transform = `translate3d(${palette.x}px, ${palette.y}px, 0)`;
  const bounds = approximatePaletteBounds(palette);
  palette.container.classList.toggle(
    "is-flipped-x",
    palette.x > window.innerWidth - bounds.width,
  );
  palette.container.classList.toggle(
    "is-flipped-y",
    palette.y > window.innerHeight - bounds.height,
  );
  positionLoadedBadge(palette);
}

export function schedulePromptPalettePosition(palette: PromptPaletteRuntime) {
  if (palette.positionFrame !== null) return;
  palette.positionFrame = window.requestAnimationFrame(() => {
    palette.positionFrame = null;
    positionPromptPalette(palette);
  });
}

function positionLoadedBadge(palette: PromptPaletteRuntime) {
  const badgeWidth = 176;
  const badgeHeight = 42;
  const offsetX = palette.x > window.innerWidth - badgeWidth - 18
    ? -badgeWidth - 14
    : 14;
  const offsetY = palette.y > window.innerHeight - badgeHeight - 18
    ? -badgeHeight - 14
    : 14;
  palette.badge.style.transform = `translate3d(${Math.round(palette.x + offsetX)}px, ${Math.round(palette.y + offsetY)}px, 0)`;
}

function approximatePaletteBounds(palette: PromptPaletteRuntime) {
  if (palette.surfaceMode === "template") {
    return { width: 380, height: 320 };
  }
  if (palette.surfaceMode === "scratch") {
    return { width: 720, height: palette.scratchRefineSourceText ? 304 : 144 };
  }
  if (palette.surfaceMode === "search") {
    return { width: 720, height: 420 };
  }
  if (palette.surfaceMode === "clip-feedback") {
    return { width: 220, height: 28 };
  }
  return { width: 248, height: 260 };
}

function isLauncherSurface(palette: PromptPaletteRuntime) {
  return palette.overlayMode === "launcher"
    && (
      palette.surfaceMode === "search"
      || palette.surfaceMode === "scratch"
      || palette.surfaceMode === "template"
      || palette.surfaceMode === "context-picker"
    );
}
