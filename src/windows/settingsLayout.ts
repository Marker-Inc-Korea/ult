import { createNativeRow, createNativeSection } from "./nativeShell";

export function createSettingsSection(title: string, rows: HTMLElement[]) {
  const section = createNativeSection(title, rows);
  section.classList.add("settings-section");
  return section;
}

export function createSettingsRow(label: string, help: string, control: HTMLElement) {
  const row = createNativeRow(label, help, control);
  row.classList.add("settings-row");
  return row;
}
