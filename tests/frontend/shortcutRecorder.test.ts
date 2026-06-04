import { describe, expect, test } from "bun:test";

import {
  shortcutDisplayLabel,
  shortcutFromKeyboardEvent,
} from "../../src/windows/shortcutRecorder";

function key(
  value: string,
  modifiers: Partial<Pick<KeyboardEvent, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">> = {},
) {
  return {
    key: value,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

describe("shortcut recorder", () => {
  test("captures modified shortcuts in native-compatible form", () => {
    expect(shortcutFromKeyboardEvent(key("s", {
      altKey: true,
      ctrlKey: true,
      metaKey: true,
    }))).toBe("Control+Option+Cmd+S");
  });

  test("rejects modifier-only and unmodified non-function keys", () => {
    expect(shortcutFromKeyboardEvent(key("Meta", { metaKey: true }))).toBeNull();
    expect(shortcutFromKeyboardEvent(key("s"))).toBeNull();
  });

  test("formats mac shortcut glyphs for display", () => {
    expect(shortcutDisplayLabel("Cmd+U")).toBe("⌘U");
    expect(shortcutDisplayLabel("Option+Space")).toBe("⌥Space");
    expect(shortcutDisplayLabel("Cmd+Option+Control+Space")).toBe("⌃⌥⌘Space");
    expect(shortcutDisplayLabel("Control+Option+Cmd+S")).toBe("⌃⌥⌘S");
  });
});
