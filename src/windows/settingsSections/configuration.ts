import { createElement } from "../../dom";
import type { AppSettings } from "../../types";
import { createSettingsRow, createSettingsSection } from "../settingsLayout";
import { createShortcutRecorder } from "../shortcutRecorder";

const DEFAULT_OPEN_PALETTE_SHORTCUT = "Cmd+U";
const DEFAULT_SEARCH_SHORTCUT = "Option+Space";
const DEFAULT_SCRATCH_PROMPT_SHORTCUT = "Cmd+Option+Control+S";
const MIN_PALETTE_VISIBLE_COUNT = 3;
const MAX_PALETTE_VISIBLE_COUNT = 9;

export const LOADED_SHORTCUT_REFERENCE = [
  { key: "Shift+Tab", label: "Change delivery mode" },
  { key: "Esc", label: "Close" },
  { key: "Click target", label: "Deliver" },
] as const;

export const BROWSING_SHORTCUT_REFERENCE = [
  { key: "Enter", label: "Load selected item" },
  { key: "↑↓", label: "Navigate" },
  { key: "Esc", label: "Close" },
] as const;

export function renderShortcutsSection(
  settings: AppSettings,
  onUpdateShortcuts: (
    openShortcut: string,
    searchShortcut: string,
    scratchShortcut: string,
  ) => Promise<void>,
) {
  return [
    createSettingsSection("Keyboard Shortcuts", [
      createSettingsRow(
        "Open Palette",
        "Shows pinned prompts.",
        createShortcutRecorder({
          value: settings.open_palette_shortcut,
          ariaLabel: "Record open palette shortcut",
          resetLabel: "↺",
          resetAriaLabel: "Reset open palette shortcut",
          resetValue: DEFAULT_OPEN_PALETTE_SHORTCUT,
          onChange: (shortcut) => {
            if (!shortcut) return;
            return onUpdateShortcuts(
              shortcut,
              settings.search_shortcut,
              settings.scratch_prompt_shortcut,
            );
          },
          onReset: () => onUpdateShortcuts(
            DEFAULT_OPEN_PALETTE_SHORTCUT,
            settings.search_shortcut,
            settings.scratch_prompt_shortcut,
          ),
        }).root,
      ),
      createSettingsRow(
        "Open Launcher",
        "Search #prompts, @contexts, $skills, and /commands.",
        createShortcutRecorder({
          value: settings.search_shortcut,
          ariaLabel: "Record open launcher shortcut",
          resetLabel: "↺",
          resetAriaLabel: "Reset open launcher shortcut",
          resetValue: DEFAULT_SEARCH_SHORTCUT,
          onChange: (shortcut) => {
            if (!shortcut) return;
            return onUpdateShortcuts(
              settings.open_palette_shortcut,
              shortcut,
              settings.scratch_prompt_shortcut,
            );
          },
          onReset: () => onUpdateShortcuts(
            settings.open_palette_shortcut,
            DEFAULT_SEARCH_SHORTCUT,
            settings.scratch_prompt_shortcut,
          ),
        }).root,
      ),
      createSettingsRow(
        "Open Launcher in Scratch mode",
        "Opens Launcher with a one-off prompt draft.",
        createShortcutRecorder({
          value: settings.scratch_prompt_shortcut,
          ariaLabel: "Record launcher scratch shortcut",
          resetLabel: "↺",
          resetAriaLabel: "Reset launcher scratch shortcut",
          resetValue: DEFAULT_SCRATCH_PROMPT_SHORTCUT,
          onChange: (shortcut) => {
            if (!shortcut) return;
            return onUpdateShortcuts(
              settings.open_palette_shortcut,
              settings.search_shortcut,
              shortcut,
            );
          },
          onReset: () => onUpdateShortcuts(
            settings.open_palette_shortcut,
            settings.search_shortcut,
            DEFAULT_SCRATCH_PROMPT_SHORTCUT,
          ),
        }).root,
      ),
      createSettingsRow(
        "Browsing",
        "Available while browsing Palette or Launcher results.",
        createShortcutReference(BROWSING_SHORTCUT_REFERENCE),
      ),
      createSettingsRow(
        "Loaded Item",
        "Available after a prompt, context, template, or scratch draft is loaded.",
        createShortcutReference(LOADED_SHORTCUT_REFERENCE),
      ),
    ]),
  ];
}

function createShortcutReference(items: readonly { key: string; label: string }[]) {
  const reference = createElement("div", "loaded-shortcut-reference");
  for (const item of items) {
    const chip = createElement("span", "loaded-shortcut-item");
    chip.append(
      createElement("kbd", undefined, item.key),
      createElement("span", undefined, item.label),
    );
    reference.append(chip);
  }
  return reference;
}


export function createPaletteVisibleCountControl(
  selected: number,
  onUpdate: (visibleCount: number) => Promise<void>,
) {
  const input = createElement("input") as HTMLInputElement;
  input.type = "number";
  input.min = String(MIN_PALETTE_VISIBLE_COUNT);
  input.max = String(MAX_PALETTE_VISIBLE_COUNT);
  input.step = "1";
  input.value = String(selected);
  input.addEventListener("change", () => {
    const next = Number(input.value);
    if (!Number.isFinite(next)) {
      input.value = String(selected);
      return;
    }
    const clamped = Math.max(
      MIN_PALETTE_VISIBLE_COUNT,
      Math.min(MAX_PALETTE_VISIBLE_COUNT, Math.round(next)),
    );
    input.value = String(clamped);
    if (clamped === selected) return;
    void onUpdate(clamped);
  });
  return input;
}
