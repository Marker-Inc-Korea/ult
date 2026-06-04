export type FakeListener = (event?: unknown) => void;

export type FakeEvent = {
  altKey?: boolean;
  ctrlKey?: boolean;
  isComposing?: boolean;
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
  readonly prevented?: boolean;
  readonly stopped?: boolean;
};

export type FakeNode = FakeElement | string;

export class FakeElement {
  children: FakeNode[] = [];
  attributes = new Map<string, string>();
  checked = false;
  className = "";
  dataset: Record<string, string> = {};
  disabled = false;
  id = "";
  label = "";
  name = "";
  parent: FakeElement | null = null;
  placeholder = "";
  readOnly = false;
  required = false;
  rows = 0;
  selectionEnd = 0;
  selectionStart = 0;
  spellcheck = false;
  style: Record<string, string> = {};
  textContent = "";
  title = "";
  type = "";
  value = "";
  listeners = new Map<string, Set<FakeListener>>();
  scrollIntoViewCalls: ScrollIntoViewOptions[] = [];

  constructor(readonly tagName: string) {}

  classList = {
    add: (...tokens: string[]) => {
      const current = this.classTokens();
      for (const token of tokens) current.add(token);
      this.className = [...current].join(" ");
    },
    remove: (...tokens: string[]) => {
      const current = this.classTokens();
      for (const token of tokens) current.delete(token);
      this.className = [...current].join(" ");
    },
    toggle: (token: string, force?: boolean) => {
      const current = this.classTokens();
      const next = force ?? !current.has(token);
      if (next) current.add(token);
      else current.delete(token);
      this.className = [...current].join(" ");
      return next;
    },
    contains: (token: string) => this.classTokens().has(token),
  };

  append(...children: FakeNode[]) {
    for (const child of children) {
      if (child instanceof FakeElement) child.parent = this;
      this.children.push(child);
    }
  }

  replaceChildren(...children: FakeNode[]) {
    for (const child of this.children) {
      if (child instanceof FakeElement) child.parent = null;
    }
    this.children = [];
    this.append(...children);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string) {
    this.attributes.delete(name);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  setCustomValidity() {
    return undefined;
  }

  addEventListener(
    type: string,
    listener: FakeListener,
    options?: { signal?: AbortSignal },
  ) {
    let listeners = this.listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(listener);
    options?.signal?.addEventListener("abort", () => {
      listeners?.delete(listener);
    }, { once: true });
  }

  dispatch(type: string, event: unknown = { type }) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event);
    }
  }

  closest(selector: string) {
    if (!selector.startsWith(".")) return null;
    const className = selector.slice(1);
    let current: FakeElement | null = this;
    while (current) {
      if (current.classList.contains(className)) return current;
      current = current.parent;
    }
    return null;
  }

  focus() {
    return undefined;
  }

  scrollIntoView(options?: boolean | ScrollIntoViewOptions) {
    this.scrollIntoViewCalls.push(
      typeof options === "object" ? options : {},
    );
  }

  querySelector(selector = "input") {
    return findBySelector(this, selector);
  }

  get elements() {
    const inputs = findAllByTag(this, "input");
    return {
      namedItem: (name: string) =>
        inputs.find((element) => element.name === name) ?? null,
      length: inputs.length,
      item: (index: number) => inputs[index] ?? null,
      [Symbol.iterator]: function* () {
        yield* inputs;
      },
    };
  }

  setRangeText(replacement: string, start: number, end: number) {
    this.value = `${this.value.slice(0, start)}${replacement}${this.value.slice(end)}`;
    this.selectionStart = start + replacement.length;
    this.selectionEnd = this.selectionStart;
  }

  private classTokens() {
    return new Set(this.className.split(/\s+/).filter(Boolean));
  }
}

export function createFakeEventTarget() {
  const listeners = new Map<string, Set<FakeListener>>();
  return {
    addEventListener(
      type: string,
      listener: FakeListener,
      options?: { signal?: AbortSignal },
    ) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener);
      options?.signal?.addEventListener("abort", () => {
        set?.delete(listener);
      }, { once: true });
    },
    dispatch(type: string) {
      for (const listener of [...(listeners.get(type) ?? [])]) {
        listener({ type });
      }
    },
    count(type: string) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

export function createFakeDocument(root: FakeElement | null = null) {
  const events = createFakeEventTarget();
  return {
    createElement: (tagName: string) => new FakeElement(tagName),
    createElementNS: (_namespace: string, tagName: string) => new FakeElement(tagName),
    createTextNode: (text: string) => {
      const node = new FakeElement("#text");
      node.textContent = text;
      return node;
    },
    querySelector: (selector: string) => selector === "#app" ? root : null,
    addEventListener: events.addEventListener,
    hidden: false,
    title: "",
    events,
  };
}

export function createFakeWindow(options: { immediateTimeout?: boolean } = {}) {
  const events = createFakeEventTarget();
  const intervals = new Map<number, () => void>();
  let nextTimerId = 1;
  return {
    __TAURI_INTERNALS__: undefined as
      | { invoke: <T>(command: string, payload?: Record<string, unknown>) => Promise<T> }
      | undefined,
    addEventListener: events.addEventListener,
    setTimeout(callback: () => void) {
      const id = nextTimerId;
      nextTimerId += 1;
      if (options.immediateTimeout) callback();
      return id;
    },
    clearTimeout() {
      return undefined;
    },
    setInterval(callback: () => void) {
      const id = nextTimerId;
      nextTimerId += 1;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id: number) {
      intervals.delete(id);
    },
    events,
  };
}

export function installFakeDom(options: {
  immediateTimeout?: boolean;
  root?: FakeElement | null;
} = {}) {
  const document = createFakeDocument(options.root ?? null);
  const window = createFakeWindow({ immediateTimeout: options.immediateTimeout });
  (globalThis as unknown as { document: unknown }).document = document;
  (globalThis as unknown as { window: unknown }).window = window;
  return { document, window };
}

export function findByClass(element: FakeNode, className: string): FakeElement | null {
  if (typeof element === "string") return null;
  if (element.classList.contains(className)) return element;
  for (const child of element.children) {
    const match = findByClass(child, className);
    if (match) return match;
  }
  return null;
}

export function findBySelector(element: FakeNode, selector: string): FakeElement | null {
  if (typeof element === "string") return null;
  if (matchesSelector(element, selector)) return element;
  for (const child of element.children) {
    const match = findBySelector(child, selector);
    if (match) return match;
  }
  return null;
}

function matchesSelector(element: FakeElement, selector: string) {
  const trimmed = selector.trim();
  if (trimmed === "") return false;
  if (trimmed.startsWith(".")) {
    return trimmed
      .slice(1)
      .split(".")
      .filter(Boolean)
      .every((className) => element.classList.contains(className));
  }
  return element.tagName.toLowerCase() === trimmed.toLowerCase();
}

export function findAllByClass(element: FakeNode, className: string): FakeElement[] {
  if (typeof element === "string") return [];
  const matches: FakeElement[] = [];
  if (element.classList.contains(className)) matches.push(element);
  for (const child of element.children) {
    matches.push(...findAllByClass(child, className));
  }
  return matches;
}

export function findByTag(element: FakeNode, tagName: string): FakeElement | null {
  if (typeof element === "string") return null;
  if (element.tagName.toLowerCase() === tagName.toLowerCase()) return element;
  for (const child of element.children) {
    const match = findByTag(child, tagName);
    if (match) return match;
  }
  return null;
}

export function findAllByTag(element: FakeNode, tagName: string): FakeElement[] {
  if (typeof element === "string") return [];
  const matches: FakeElement[] = [];
  if (element.tagName.toLowerCase() === tagName.toLowerCase()) {
    matches.push(element);
  }
  for (const child of element.children) {
    matches.push(...findAllByTag(child, tagName));
  }
  return matches;
}

export function findButtonByText(element: FakeNode, text: string): FakeElement | null {
  if (typeof element === "string") return null;
  if (element.tagName === "button" && textOf(element).trim() === text) return element;
  for (const child of element.children) {
    const match = findButtonByText(child, text);
    if (match) return match;
  }
  return null;
}

export function textOf(element: FakeNode): string {
  if (typeof element === "string") return element;
  return [
    element.textContent,
    ...element.children.map(textOf),
  ].join("");
}

export function keyEvent(key: string, overrides: Partial<FakeEvent> = {}) {
  let prevented = false;
  let stopped = false;
  return {
    key,
    preventDefault: () => {
      prevented = true;
    },
    stopPropagation: () => {
      stopped = true;
    },
    get prevented() {
      return prevented;
    },
    get stopped() {
      return stopped;
    },
    ...overrides,
  };
}

export async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
