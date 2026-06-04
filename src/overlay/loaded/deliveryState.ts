import { schedulePromptPalettePosition } from "../shared/positioning";
import { syncOverlaySurfaceState } from "../shared/surfaceState";
import {
  stateForDeliveryResult,
  withDeliveryMode,
  type PreparedPromptExecution,
} from "../../promptExecutor";
import type { DeliveryMode, DeliveryResultEvent } from "../../types";
import type { PromptPaletteRuntime } from "../../paletteRuntime";
import {
  transitionPromptPaletteRuntimeState,
} from "../../paletteRuntimeState";

export function setPromptPaletteApplyingState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
) {
  const result = transitionPromptPaletteRuntimeState(palette, { type: "set-applying" });
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
}

export function setPromptPaletteLoadedState(
  surface: HTMLElement,
  palette: PromptPaletteRuntime,
  prepared: PreparedPromptExecution,
) {
  const result = transitionPromptPaletteRuntimeState(palette, {
    type: "set-loaded",
    prepared,
  });
  syncOverlaySurfaceState(surface, palette, result.surfaceMode);
  if (result.schedulePosition) {
    schedulePromptPalettePosition(palette);
  }
}

export function setPromptPaletteLoadedDeliveryMode(
  palette: PromptPaletteRuntime,
  deliveryMode: DeliveryMode,
) {
  if (!palette.preparedExecution) return false;
  if (palette.preparedExecution.deliveryMode === deliveryMode) return false;
  palette.preparedExecution = withDeliveryMode(palette.preparedExecution, deliveryMode);
  return true;
}

export function setPromptPaletteDeliveryResult(
  palette: PromptPaletteRuntime,
  deliveryResult: DeliveryResultEvent,
) {
  palette.lastDeliveryResult = deliveryResult;
  palette.executionState = stateForDeliveryResult(deliveryResult);
}
