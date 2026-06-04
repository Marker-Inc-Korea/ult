import { visiblePrompts, type PromptPaletteRuntime } from "../../paletteRuntime";
import { interventionDeliveryModes } from "../../promptUtils";
import type { DeliveryMode } from "../../types";

export type PaletteInputActions = {
  loadSelected: (target: EventTarget | null) => void;
  applySearchComposer?: () => void;
  applyLoaded: () => void;
  selectDelta: (delta: number) => void;
  selectContextPickerDelta: (delta: number) => void;
  selectAndLoad: (index: number, target: EventTarget | null) => void;
  selectPageDelta: (delta: number) => void;
  updateLoadedDeliveryMode: (mode: DeliveryMode) => void;
  applyContextPicker: () => void;
  unload: () => void;
};

export function bindPaletteInput(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  actions: PaletteInputActions,
) {
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !palette.active) return;
    const target = event.target as HTMLElement | null;
    if (palette.overlayMode === "launcher") {
      if (target?.closest(".palette-launcher")) return;
      event.preventDefault();
      actions.unload();
      return;
    }
    if (palette.surfaceMode === "context-picker") {
      event.preventDefault();
      return;
    }
    if (palette.surfaceMode === "loaded") {
      event.preventDefault();
      actions.applyLoaded();
      return;
    }
    if (target?.closest(".palette-prompt-control")) {
      return;
    }
    event.preventDefault();
    actions.loadSelected(event.target);
  };
  const onWindowBlur = () => {
    if (!palette.active) return;
    if (palette.overlayMode !== "launcher") return;
    actions.unload();
  };

  const onWheel = (event: WheelEvent) => {
    if (!palette.active) return;
    event.preventDefault();
    if (
      palette.surfaceMode === "loaded"
      || palette.surfaceMode === "template"
      || palette.surfaceMode === "scratch"
      || palette.surfaceMode === "context-picker"
    ) return;
    actions.selectDelta(event.deltaY > 0 ? 1 : -1);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (palette.surfaceMode === "idle") return;
    handlePromptPaletteKeyboard(event, palette, actions);
  };

  surface.addEventListener("pointerdown", onPointerDown);
  surface.addEventListener("wheel", onWheel);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener?.("blur", onWindowBlur);
  surface.tabIndex = -1;

  return () => {
    surface.removeEventListener("pointerdown", onPointerDown);
    surface.removeEventListener("wheel", onWheel);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener?.("blur", onWindowBlur);
  };
}

export function handlePromptPaletteKeyboard(
  event: KeyboardEvent,
  palette: PromptPaletteRuntime,
  actions: PaletteInputActions,
) {
  if (isEditableTarget(event.target)) return false;

  if (event.key === "Escape") {
    event.preventDefault();
    actions.unload();
    return true;
  }

  if (palette.surfaceMode === "loaded") {
    if (
      event.key === "Tab"
      && event.shiftKey
      && !event.metaKey
      && !event.ctrlKey
      && !event.altKey
    ) {
      event.preventDefault();
      const currentMode = palette.preparedExecution?.deliveryMode ?? "paste";
      actions.updateLoadedDeliveryMode(nextDeliveryMode(currentMode));
      return true;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      return true;
    }
    return false;
  }

  if (palette.surfaceMode === "template") {
    return false;
  }

  if (palette.surfaceMode === "scratch") {
    return false;
  }

  if (palette.surfaceMode === "search" && event.key === "Tab") {
    event.preventDefault();
    return true;
  }

  if (palette.surfaceMode === "context-picker") {
    if (event.key === "Enter") {
      event.preventDefault();
      actions.applyContextPicker();
      return true;
    }
    if (
      event.key === "ArrowUp"
      || (event.key === "Tab" && event.shiftKey)
    ) {
      event.preventDefault();
      actions.selectContextPickerDelta(-1);
      return true;
    }
    if (event.key === "ArrowDown" || event.key === "Tab") {
      event.preventDefault();
      actions.selectContextPickerDelta(1);
      return true;
    }
    return false;
  }

  if (palette.surfaceMode === "library") {
    return false;
  }

  if (event.key === "Tab" && event.shiftKey) {
    event.preventDefault();
    actions.selectDelta(-1);
    return true;
  }

  if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "Tab") {
    event.preventDefault();
    actions.selectDelta(1);
    return true;
  }

  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    event.preventDefault();
    actions.selectDelta(-1);
    return true;
  }

  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    actions.loadSelected(null);
    return true;
  }

  if (event.key === "PageDown") {
    event.preventDefault();
    actions.selectPageDelta(1);
    return true;
  }

  if (event.key === "PageUp") {
    event.preventDefault();
    actions.selectPageDelta(-1);
    return true;
  }

  if (/^[1-9]$/.test(event.key)) {
    event.preventDefault();
    const entry = visiblePrompts(palette)[Number(event.key) - 1];
    if (!entry) return true;
    actions.selectAndLoad(entry.index, null);
    return true;
  }

  return false;
}

function nextDeliveryMode(currentMode: DeliveryMode): DeliveryMode {
  const currentIndex = interventionDeliveryModes.indexOf(currentMode);
  const nextIndex = currentIndex < 0
    ? 0
    : (currentIndex + 1) % interventionDeliveryModes.length;
  return interventionDeliveryModes[nextIndex] ?? "paste";
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
}
