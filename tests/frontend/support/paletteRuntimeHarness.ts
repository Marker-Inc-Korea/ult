import type { AppSettings, PromptDefinition } from "../../../src/types";
import type { PromptPaletteRuntime } from "../../../src/paletteRuntime";

export type FakeElement = HTMLElement & {
  classNames: Set<string>;
  listeners: Map<string, Array<(event: FakeDomEvent) => void>>;
  dispatch: (type: string, event: FakeDomEvent) => void;
};

export type FakeDomEvent = {
  button?: number;
  deltaY?: number;
  key?: string;
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  target?: unknown;
  preventDefault: () => void;
};

function fakeClassList(classes: Set<string>) {
  return {
    add: (...tokens: string[]) => {
      for (const token of tokens) classes.add(token);
    },
    remove: (...tokens: string[]) => {
      for (const token of tokens) classes.delete(token);
    },
    contains: (token: string) => classes.has(token),
    toggle: (token: string, force?: boolean) => {
      const next = force ?? !classes.has(token);
      if (next) classes.add(token);
      else classes.delete(token);
      return next;
    },
  } as DOMTokenList;
}

export function fakeElement(): FakeElement {
  const classNames = new Set<string>();
  const listeners = new Map<string, Array<(event: FakeDomEvent) => void>>();
  return {
    classNames,
    listeners,
    style: {},
    classList: fakeClassList(classNames),
    textContent: "",
    className: "",
    addEventListener: (type: string, listener: (event: FakeDomEvent) => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener: (type: string, listener: (event: FakeDomEvent) => void) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
    },
    dispatch: (type: string, event: FakeDomEvent) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  } as FakeElement;
}

export function prompt(index: number): PromptDefinition {
  return {
    id: `prompt-${index}`,
    title: `Prompt ${index}`,
    pinned: true,
    description: "",
    prompt: `Run prompt ${index}`,
  };
}

export function context(index: number): PromptDefinition {
  return {
    ...prompt(index),
    id: `context-${index}`,
    title: `Context ${index}`,
    artifact_type: "context",
    pinned: false,
    prompt: `Context body ${index}`,
  };
}

const EPHEMERAL_CONTEXT_IDS = ["75ac6db", "89abcde", "c001234", "d00f123"];

export function clipContext(index: number, text: string): PromptDefinition {
  const createdAt = 9_000_000_000_000 + index;
  return {
    id: EPHEMERAL_CONTEXT_IDS[index - 1] ?? `e${index.toString(16).padStart(6, "0")}`,
    title: `Clip ${index}`,
    artifact_type: "context",
    scope: "ephemeral",
    pinned: false,
    description: text,
    prompt: text,
    created_at: createdAt,
    expires_at: createdAt + 7 * 24 * 60 * 60 * 1000,
    source: "clipboard",
  };
}

export function expiredClipContext(index: number, text: string): PromptDefinition {
  return {
    ...clipContext(index, text),
    created_at: 1,
    expires_at: 2,
  };
}

export function settings(): AppSettings {
  return {
    palette_visible_count: 5,
    pinned_artifact_ids: [],
    launch_at_login: false,
    project_metadata_enabled: false,
    open_palette_shortcut: "Cmd+U",
    search_shortcut: "Option+Space",
    scratch_prompt_shortcut: "Cmd+Option+Control+S",
    meta_prompting_enabled: false,
    meta_prompting_provider: "openai",
    meta_prompting_model: "gpt-5-mini",
    meta_prompting_template: "Rewrite: {input}",
  };
}

export function runtime(promptCount = 12): PromptPaletteRuntime {
  return {
    container: fakeElement() as PromptPaletteRuntime["container"],
    badge: fakeElement() as HTMLDivElement,
    active: false,
    overlayMode: "palette",
    launcherMode: null,
    surfaceMode: "idle",
    executionState: "selecting",
    x: 10,
    y: 10,
    searchQuery: "",
    launcherCommandIndex: 0,
    launcherFeedback: null,
    launcherLibraryFilter: "all",
    launcherLibraryQuery: "",
    launcherLibrarySort: "recent",
    launcherLibraryDiagnostics: [],
    launcherArtifactPanel: null,
    launcherPanelActionIndex: 0,
    selectedIndex: 0,
    visibleStart: 0,
    preparedExecution: null,
    templatePromptId: null,
    templateValues: {},
    templateContextIds: [],
    templateReturnLauncherMode: null,
    templateValidationErrors: {},
    templateDynamicEnumValues: {},
    templateDynamicEnumErrors: {},
    templateDynamicEnumLoading: {},
    scratchText: "",
    scratchNotice: null,
    scratchMetaConfirmRequired: false,
    scratchMetaConfirmPending: false,
    scratchRefining: false,
    scratchRefineSourceText: null,
    scratchRefineSourceRequiresConfirmation: false,
    scratchRefineResultText: null,
    scratchRefineResultRequiresConfirmation: false,
    scratchRefineApplied: false,
    scratchRefineError: null,
    scratchRefineGeneration: 0,
    ephemeralContextCount: 0,
    contextPickerSelectedIndex: 0,
    clipFeedback: null,
    pendingConfirmPromptId: null,
    prompts: Array.from({ length: promptCount }, (_, index) => prompt(index)),
    userCommands: [],
    usageHistory: [],
    appSettings: settings(),
    accessibilityTrusted: true,
    lastDeliveryResult: null,
    deliveryInFlight: false,
    syncGeneration: 0,
    nativeOverlayGeneration: 0,
    positionFrame: null,
    pointerPollTimer: null,
    pointerSyncInFlight: false,
    unlistenNativeEvents: null,
  };
}

export function keyboard(key: string, shiftKey = false) {
  let prevented = false;
  return {
    key,
    shiftKey,
    target: null,
    preventDefault: () => {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
  } as KeyboardEvent & { prevented: boolean };
}

export function installPaletteRuntimeDom() {
  (globalThis as unknown as { window: unknown }).window = {
    innerWidth: 800,
    innerHeight: 600,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
    clearTimeout: () => undefined,
    setTimeout: () => 1,
    setInterval: () => 1,
    clearInterval: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  (globalThis as unknown as { document: unknown }).document = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
}

export { flushPromises } from "./fakeDom";
