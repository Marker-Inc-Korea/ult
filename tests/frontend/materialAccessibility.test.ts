import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const baseCss = readFileSync("src/styles/base.css", "utf8");
const nativeCss = readFileSync("src/styles/native-windows.css", "utf8");
const overlayCss = readCssBundle(new URL("../../src/styles/palette-overlay.css", import.meta.url));

function readCssBundle(url: URL, seen = new Set<string>()): string {
  if (seen.has(url.href)) return "";
  seen.add(url.href);
  const source = readFileSync(url, "utf8");
  return source.replace(/@import\s+"([^"]+)";/g, (_match, importPath: string) =>
    readCssBundle(new URL(importPath, url), seen),
  );
}

function block(css: string, pattern: RegExp) {
  const match = css.match(pattern);
  if (!match?.groups?.body) {
    throw new Error(`Missing CSS block: ${pattern}`);
  }
  return match.groups.body;
}

function cssVar(body: string, name: string) {
  const match = body.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Missing CSS variable: ${name}`);
  return match[1].trim();
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    throw new Error(`Expected 6-digit hex color, received ${hex}`);
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function parseRgbChannels(value: string) {
  const rgba = value.match(/^rgba?\(([^)]+)\)$/);
  if (!rgba) return null;
  const channels = rgba[1].split(",").map((part) => part.trim());
  if (channels.length < 3) return null;
  return {
    r: Number.parseFloat(channels[0]),
    g: Number.parseFloat(channels[1]),
    b: Number.parseFloat(channels[2]),
    a: channels[3] === undefined ? 1 : Number.parseFloat(channels[3]),
  };
}

function blendColor(value: string, backdrop: string) {
  if (value.startsWith("#")) return value;
  const foreground = parseRgbChannels(value);
  if (!foreground) throw new Error(`Unsupported color: ${value}`);
  const background = hexToRgb(backdrop);
  const r = Math.round(foreground.r * foreground.a + background.r * (1 - foreground.a));
  const g = Math.round(foreground.g * foreground.a + background.g * (1 - foreground.a));
  const b = Math.round(foreground.b * foreground.a + background.b * (1 - foreground.a));
  return `#${[r, g, b].map((channelValue) =>
    channelValue.toString(16).padStart(2, "0")
  ).join("")}`;
}

function channel(value: number) {
  const ratio = value / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: string, b: string) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("material accessibility", () => {
  test("native windows expose focus, transparency, and motion safeguards", () => {
    expect(baseCss).toContain("--native-focus-ring");
    expect(baseCss).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(baseCss).toMatch(/--native-material-filter:\s*blur\(36px\) saturate\(1\.8\);/);
    expect(baseCss).toMatch(
      /@media \(prefers-reduced-transparency: reduce\)\s*{[^}]*--native-group-bg:\s*#111111;[^}]*--native-material-filter:\s*none;/s,
    );
    expect(baseCss).toMatch(
      /html\[data-theme="light"\],[^{]+html\[data-theme="system"\]\s*{[^}]*--native-group-bg:\s*rgba\(255,\s*255,\s*255,\s*0\.44\);/s,
    );
    expect(baseCss).toContain(
      "@media (prefers-color-scheme: dark) and (prefers-reduced-transparency: reduce)",
    );
    expect(nativeCss).toMatch(
      /\.native-window button:focus-visible,\s*\.native-window input:focus-visible,\s*\.native-window select:focus-visible,\s*\.native-window textarea:focus-visible,\s*\.native-window summary:focus-visible,[^{]+{[^}]*box-shadow:\s*0 0 0 3px var\(--native-focus-ring\);/s,
    );
    expect(nativeCss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(nativeCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.native-window,[^{]+{[^}]*transition:\s*none !important;[^}]*animation:\s*none !important;/s,
    );
    expect(nativeCss).toMatch(
      /\.native-sidebar,\s*\.native-list,\s*\.native-group\s*{[^}]*backdrop-filter:\s*var\(--native-material-filter\);/s,
    );
  });

  test("primary text contrast stays readable in light and dark materials", () => {
    const nativeDark = block(baseCss, /:root\s*{(?<body>[^}]*)}/s);
    const nativeLight = block(
      baseCss,
      /html\[data-theme="light"\],\s*html\[data-theme="system"\]\s*{(?<body>[^}]*)}/s,
    );
    const overlayDark = block(overlayCss, /\.palette-overlay\s*{(?<body>[^}]*)}/s);
    const overlayLight = block(
      overlayCss,
      /html\[data-theme="light"\] \.palette-overlay,\s*html\[data-theme="system"\] \.palette-overlay\s*{(?<body>[^}]*)}/s,
    );
    const nativeDarkGroup = parseRgbChannels(cssVar(nativeDark, "--native-group-bg"));
    const nativeLightGroup = parseRgbChannels(cssVar(nativeLight, "--native-group-bg"));
    const overlayDarkMaterial = parseRgbChannels(cssVar(overlayDark, "--overlay-material"));
    const overlayLightMaterial = parseRgbChannels(cssVar(overlayLight, "--overlay-material"));

    expect(nativeDarkGroup?.a).toBeLessThanOrEqual(0.46);
    expect(nativeLightGroup?.a).toBeLessThanOrEqual(0.46);
    expect(overlayDarkMaterial?.a).toBeGreaterThanOrEqual(0.92);
    expect(overlayDarkMaterial?.a).toBeLessThanOrEqual(0.98);
    expect(overlayLightMaterial?.a).toBeGreaterThanOrEqual(0.94);
    expect(overlayLightMaterial?.a).toBeLessThanOrEqual(0.99);

    expect(contrastRatio(
      cssVar(nativeDark, "--native-window-bg"),
      cssVar(nativeDark, "--native-text"),
    )).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(
      cssVar(nativeLight, "--native-window-bg"),
      cssVar(nativeLight, "--native-text"),
    )).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(
      blendColor(cssVar(overlayDark, "--overlay-material"), "#000000"),
      cssVar(overlayDark, "--overlay-text"),
    )).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(
      blendColor(cssVar(overlayLight, "--overlay-material"), "#ffffff"),
      cssVar(overlayLight, "--overlay-text"),
    )).toBeGreaterThanOrEqual(4.5);
  });
});
