import { createElement } from "../dom";

const MODIFIER_KEYS = new Set([
  "Alt",
  "Control",
  "Fn",
  "Meta",
  "Shift",
]);

export type ShortcutRecorder = {
  root: HTMLElement;
  button: HTMLButtonElement;
  setValue: (value: string | null) => void;
};

export type ShortcutRecorderOptions = {
  value: string | null;
  ariaLabel: string;
  emptyLabel?: string;
  resetLabel?: string;
  resetAriaLabel?: string;
  resetValue?: string | null;
  onChange: (shortcut: string | null) => void | Promise<void>;
  onReset?: () => void | Promise<void>;
};

export function createShortcutRecorder(
  options: ShortcutRecorderOptions,
): ShortcutRecorder {
  let value = options.value;
  let recording = false;

  const root = createElement("div", "shortcut-recorder");
  const button = createElement("button", "shortcut-keycap") as HTMLButtonElement;
  button.type = "button";
  button.setAttribute("aria-label", options.ariaLabel);
  const message = createElement("span", "shortcut-recorder-message");

  const reset = createElement(
    "button",
    "shortcut-reset",
    options.resetLabel ?? "Reset",
  ) as HTMLButtonElement;
  reset.type = "button";
  reset.hidden = !options.onReset;
  reset.setAttribute("aria-label", options.resetAriaLabel ?? "Reset shortcut");

  const render = () => {
    button.textContent = recording
      ? "Press shortcut..."
      : value
        ? shortcutDisplayLabel(value)
        : (options.emptyLabel ?? "None");
    button.classList.toggle("is-recording", recording);
    message.textContent = "";
  };

  const stopRecording = () => {
    recording = false;
    render();
  };

  button.addEventListener("click", () => {
    recording = true;
    render();
  });

  button.addEventListener("keydown", (event) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      stopRecording();
      return;
    }

    const shortcut = shortcutFromKeyboardEvent(event);
    if (!shortcut) {
      message.textContent = "Use a modifier with a key.";
      return;
    }

    void Promise.resolve(options.onChange(shortcut))
      .then(() => {
        value = shortcut;
        stopRecording();
      })
      .catch((error) => {
        recording = false;
        render();
        message.textContent = errorMessage(error, "Shortcut could not be saved.");
      });
  });

  reset.addEventListener("click", () => {
    void Promise.resolve(options.onReset?.())
      .then(() => {
        value = options.resetValue ?? null;
        render();
        message.textContent = "";
      })
      .catch((error) => {
        message.textContent = errorMessage(error, "Shortcut could not be reset.");
      });
  });

  root.append(button, reset, message);
  render();

  return {
    root,
    button,
    setValue: (nextValue: string | null) => {
      value = nextValue;
      render();
    },
  };
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent) {
  if (MODIFIER_KEYS.has(event.key)) return null;

  const key = shortcutKeyName(event.key);
  if (!key) return null;

  const modifiers = [
    event.ctrlKey ? "Control" : null,
    event.altKey ? "Option" : null,
    event.shiftKey ? "Shift" : null,
    event.metaKey ? "Cmd" : null,
  ].filter(Boolean);
  if (modifiers.length === 0 && !/^F\d{1,2}$/.test(key)) return null;

  return [...modifiers, key].join("+");
}

export function shortcutDisplayLabel(shortcut: string) {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const modifiers: string[] = [];
  const keys: string[] = [];

  for (const part of parts) {
    const token = part.toLowerCase();
    if (token === "control" || token === "ctrl") {
      modifiers.push("Control");
    } else if (token === "option" || token === "alt") {
      modifiers.push("Option");
    } else if (token === "shift") {
      modifiers.push("Shift");
    } else if (token === "cmd" || token === "command" || token === "super" || token === "meta") {
      modifiers.push("Cmd");
    } else {
      keys.push(displayKey(part));
    }
  }

  const ordered = ["Control", "Option", "Shift", "Cmd"]
    .filter((modifier) => modifiers.includes(modifier))
    .map(displayModifier);
  return [...ordered, ...keys].join("");
}

function shortcutKeyName(key: string) {
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  if (/^F\d{1,2}$/.test(key)) return key;
  if (key.startsWith("Arrow")) return key;

  switch (key) {
    case "Backspace":
    case "Delete":
    case "End":
    case "Enter":
    case "Escape":
    case "Home":
    case "PageDown":
    case "PageUp":
    case "Space":
    case "Tab":
      return key;
    default:
      return null;
  }
}

function displayModifier(modifier: string) {
  switch (modifier) {
    case "Control":
      return "⌃";
    case "Option":
      return "⌥";
    case "Shift":
      return "⇧";
    case "Cmd":
      return "⌘";
    default:
      return modifier;
  }
}

function displayKey(key: string) {
  const token = key.toLowerCase();
  if (token === "space") return "Space";
  if (token === "escape" || token === "esc") return "Esc";
  if (token === "arrowup") return "↑";
  if (token === "arrowdown") return "↓";
  if (token === "arrowleft") return "←";
  if (token === "arrowright") return "→";
  if (token.startsWith("digit")) return token.slice("digit".length);
  if (token.startsWith("key")) return token.slice("key".length).toUpperCase();
  return key.length === 1 ? key.toUpperCase() : key;
}

function errorMessage(error: unknown, defaultMessage: string) {
  return error instanceof Error ? error.message : defaultMessage;
}
