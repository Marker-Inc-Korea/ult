import { createElement } from "../dom";

export type PreferencesSection =
  | "general"
  | "shortcuts"
  | "meta-prompting"
  | "advanced";

type PreferencesSidebarItem = {
  id: PreferencesSection;
  label: string;
  icon: SidebarIconName;
};

export type NativeSidebarItem<SectionId extends string> = {
  id: SectionId;
  label: string;
  detail?: string;
  icon?: SidebarIconName;
  count?: number;
  disabled?: boolean;
};

export type NativeSidebarShellOptions<SectionId extends string> = {
  title: string;
  items: Array<NativeSidebarItem<SectionId>>;
  selectedId: SectionId;
  onSelect?: (section: SectionId) => void;
  className?: string;
};

type SidebarIconName =
  | "home"
  | "shortcuts"
  | "spark"
  | "advanced";

export const PREFERENCES_SECTIONS: PreferencesSidebarItem[] = [
  { id: "general", label: "General", icon: "home" },
  { id: "shortcuts", label: "Shortcuts", icon: "shortcuts" },
  { id: "meta-prompting", label: "Meta Prompting", icon: "spark" },
  { id: "advanced", label: "Advanced", icon: "advanced" },
];

export function createNativeWindowShell(title: string, subtitle: string) {
  const root = createElement("main", "native-window");
  const header = createElement("header", "native-window-header");
  header.append(createElement("h1", undefined, title), createElement("p", undefined, subtitle));
  const content = createElement("div", "native-window-content");
  const footer = createElement("footer", "native-window-footer");
  root.append(header, content, footer);
  return { root, content, footer };
}

export function createNativeSidebarShell<SectionId extends string>(
  options: NativeSidebarShellOptions<SectionId>,
) {
  const root = createElement(
    "main",
    `native-window native-sidebar-shell${options.className ? ` ${options.className}` : ""}`,
  );
  const sidebar = createElement("aside", "native-sidebar");
  const brand = createElement("div", "native-sidebar-brand");
  brand.append(createElement("strong", undefined, options.title));
  const nav = createElement("nav", "native-sidebar-nav");
  for (const item of options.items) {
    nav.append(createNativeSidebarItem(item, options.selectedId, options.onSelect));
  }
  sidebar.append(brand, nav);

  const main = createElement("section", "native-sidebar-main");
  const header = createElement("header", "native-sidebar-content-header");
  const content = createElement("div", "native-window-content");
  const footer = createElement("footer", "native-window-footer");
  main.append(header, content, footer);
  root.append(sidebar, main);
  return { root, sidebar, header, content, footer };
}

export function createPreferencesWindowShell(
  selectedSection: PreferencesSection,
  onSelectSection?: (section: PreferencesSection) => void,
) {
  const shell = createNativeSidebarShell({
    title: "Ult",
    items: PREFERENCES_SECTIONS,
    selectedId: selectedSection,
    onSelect: onSelectSection,
    className: "preferences-window",
  });
  shell.header.classList.add("preferences-content-header");
  shell.header.append(createElement("h1", undefined, preferencesSectionTitle(selectedSection)));
  return { root: shell.root, content: shell.content, footer: shell.footer };
}

export function preferencesSectionTitle(section: PreferencesSection) {
  switch (section) {
    case "general":
      return "General";
    case "shortcuts":
      return "Shortcuts";
    case "meta-prompting":
      return "Meta Prompting";
    case "advanced":
      return "Advanced";
    default:
      return "General";
  }
}

function createNativeSidebarItem<SectionId extends string>(
  item: NativeSidebarItem<SectionId>,
  selectedSection: SectionId,
  onSelectSection?: (section: SectionId) => void,
) {
  const selected = selectedSection === item.id;
  const button = createElement(
    "button",
    selected ? "native-sidebar-item is-selected" : "native-sidebar-item",
  ) as HTMLButtonElement;
  button.type = "button";
  button.disabled = item.disabled ?? false;
  button.setAttribute("aria-pressed", selected ? "true" : "false");
  if (item.icon) {
    button.append(createSidebarIcon(item.icon));
  } else {
    button.append(createElement("span", "native-sidebar-icon-placeholder"));
  }
  const text = createElement("span", "native-sidebar-item-text");
  text.append(createElement("strong", undefined, item.label));
  if (item.detail) {
    text.append(createElement("small", undefined, item.detail));
  }
  button.append(text);
  if (typeof item.count === "number") {
    button.append(createElement("small", "native-sidebar-count", String(item.count)));
  }
  button.addEventListener("click", () => {
    if (selected || item.disabled) return;
    onSelectSection?.(item.id);
  });
  return button;
}

function createSidebarIcon(name: SidebarIconName) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("native-sidebar-icon");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("d", sidebarIconPath(name));
  svg.append(path);
  return svg;
}

export function createNativeSection(title: string, rows: HTMLElement[]) {
  const section = createElement("section", "native-section");
  section.append(createElement("h2", "native-section-title", title));
  if (
    rows.length === 1
    && (rows[0].classList.contains("native-group") || rows[0].classList.contains("settings-form"))
  ) {
    rows[0].classList.add("native-group");
    section.append(rows[0]);
    return section;
  }
  const group = createElement("div", "native-group");
  group.append(...rows);
  section.append(group);
  return section;
}

export function createNativeRow(label: string, detail: string, control: HTMLElement) {
  const row = createElement("section", "native-group-row");
  const text = createElement("div", "native-row-copy");
  text.append(createElement("strong", undefined, label));
  if (detail) {
    text.append(createElement("span", undefined, detail));
  }
  row.append(text, control);
  return row;
}

export function createNativeStatRow(items: Array<{ value: string; label: string }>) {
  const row = createElement("div", "native-stat-row");
  for (const item of items) {
    const stat = createElement("div", "native-stat-item");
    stat.append(
      createElement("strong", undefined, item.value),
      createElement("span", undefined, item.label),
    );
    row.append(stat);
  }
  return row;
}

export function createNativeKeycap(label: string) {
  return createElement("kbd", "native-keycap", label);
}

export function createNativeShortcutRow(label: string, detail: string, control: HTMLElement) {
  const row = createNativeRow(label, detail, control);
  row.classList.add("native-shortcut-row");
  return row;
}

export function createNativeInlineStatus(label: string, tone: "neutral" | "ok" | "warning" = "neutral") {
  return createElement(
    "span",
    tone === "neutral" ? "native-inline-status" : `native-inline-status is-${tone}`,
    label,
  );
}

function sidebarIconPath(name: SidebarIconName) {
  switch (name) {
    case "home":
      return "m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z";
    case "shortcuts":
      return "M12 3v3m0 12v3m7.8-13.5-2.6 1.5M6.8 15 4.2 16.5m15.6 0L17.2 15M6.8 9 4.2 7.5M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z";
    case "spark":
      return "M12 3 14.2 8.8 20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z";
    case "advanced":
      return "M12 4v16M4 8h16M6 16h12";
    default:
      return "M4 12h16";
  }
}

export function createWindowLoading(title: string) {
  const shell = createNativeWindowShell(title, "Loading local state.");
  shell.content.append(createElement("p", "native-muted", "Loading..."));
  return shell.root;
}

export function createWindowError(title: string, message: string) {
  const shell = createNativeWindowShell(title, "Something went wrong.");
  shell.content.append(createElement("div", "native-message is-error", message));
  return shell.root;
}

export function getAppRoot() {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) {
    throw new Error("App root not found");
  }
  return root;
}

export function errorMessage(error: unknown, defaultMessage: string) {
  return error instanceof Error ? error.message : defaultMessage;
}
