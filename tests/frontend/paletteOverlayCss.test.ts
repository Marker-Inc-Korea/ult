import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readCssBundle(new URL("../../src/styles/palette-overlay.css", import.meta.url));

function readCssBundle(url: URL, seen = new Set<string>()): string {
  if (seen.has(url.href)) return "";
  seen.add(url.href);
  const source = readFileSync(url, "utf8");
  return source.replace(/@import\s+"([^"]+)";/g, (_match, importPath: string) =>
    readCssBundle(new URL(importPath, url), seen),
  );
}

function cssDeclarations(selector: string) {
  const selectorStart = css.indexOf(`${selector} {`);
  if (selectorStart < 0) {
    throw new Error(`Missing CSS selector: ${selector}`);
  }
  const bodyStart = css.indexOf("{", selectorStart);
  const bodyEnd = css.indexOf("}", bodyStart);
  if (bodyStart < 0 || bodyEnd < 0) {
    throw new Error(`Missing CSS body: ${selector}`);
  }
  return Object.fromEntries(
    css.slice(bodyStart + 1, bodyEnd)
      .split(";")
      .map((declaration) => declaration.trim())
      .filter(Boolean)
      .map((declaration) => {
        const separator = declaration.indexOf(":");
        return [
          declaration.slice(0, separator).trim(),
          declaration.slice(separator + 1).trim(),
        ];
      }),
  );
}

describe("palette overlay css", () => {
  test("palette selection modes do not dim the host window behind surfaces", () => {
    expect(css).toContain(".palette-overlay.is-palette-mode,");
    expect(css).toContain(".palette-overlay.is-launcher-mode,");
    expect(css).toContain(".palette-overlay.is-loaded-mode,");
    expect(css).toMatch(
      /\.palette-overlay\.is-palette-mode,\s*\.palette-overlay\.is-launcher-mode,\s*\.palette-overlay\.is-loaded-mode\s*{[^}]*background:\s*transparent;/s,
    );
    expect(css).not.toContain("is-permission-mode");
    expect(css).not.toContain("palette-permission");
    expect(css).not.toContain("--overlay-shield-bg");
    expect(css).not.toMatch(/background:\s*var\(--overlay-shield-bg\)/);
  });

  test("palette and search panel backgrounds are allowed to wrap their rows", () => {
    const overlay = cssDeclarations(".palette-overlay");
    const panel = cssDeclarations(".palette-panel");

    expect(css).not.toMatch(
      /\.palette-panel,\s*\.palette-search-panel\s*{\s*width:\s*1px;\s*height:\s*1px;\s*}/,
    );
    expect(overlay["--palette-cursor-width"]).toBe("256px");
    expect(panel["--palette-picker-width"]).toBe("var(--palette-cursor-width)");
    expect(panel.width).toBe("var(--palette-picker-width)");
    expect(css).not.toMatch(
      /\.palette-panel,\s*\.palette-search-panel\s*{[^}]*width:\s*224px;/s,
    );
    expect(overlay["--launcher-frame-width"]).toBe("min(720px, calc(100vw - 40px))");
    expect(overlay["--launcher-frame-height"]).toBe("min(440px, calc(100vh - 128px))");
    expect(overlay["--launcher-frame-max-height"]).toBe("min(70vh, 520px)");
    expect(overlay["--launcher-frame-radius"]).toBe("var(--overlay-radius)");
    expect(overlay["--launcher-frame-padding"]).toBe("0");
    expect(overlay["--launcher-frame-top"]).toBe("max(64px, 12vh)");
    expect(overlay["--launcher-input-height"]).toBe("56px");
    expect(overlay["--launcher-row-height"]).toBe("44px");
    expect(overlay["--launcher-result-columns"]).toBe("24px minmax(0, 1fr)");
    expect(css).toMatch(
      /\.palette-launcher-shell\s*{[^}]*width:\s*var\(--launcher-frame-width\);[^}]*max-height:\s*var\(--launcher-frame-max-height\);[^}]*border-radius:\s*var\(--launcher-frame-radius\);[^}]*padding:\s*var\(--launcher-frame-padding\);/s,
    );
    expect(css).not.toMatch(
      /\.palette-search-panel\s*{[^}]*width:\s*min\(720px,\s*calc\(100vw - 24px\)\);/s,
    );
  });

  test("overlay material surfaces use one stable material shell", () => {
    expect(css).toMatch(
      /\.palette-panel,\s*\.palette-launcher,\s*\.palette-search-panel,\s*\.palette-template,\s*\.palette-loaded,\s*\.palette-scratch,\s*\.palette-context-picker,\s*\.palette-launcher-shell,\s*\.palette-clip-feedback\s*{[^}]*border:\s*1px solid var\(--overlay-border\);[^}]*background:\s*var\(--overlay-material\);[^}]*background-clip:\s*padding-box;[^}]*-webkit-backdrop-filter:\s*var\(--overlay-material-filter\);[^}]*backdrop-filter:\s*var\(--overlay-material-filter\);[^}]*box-shadow:\s*var\(--overlay-shadow\);/s,
    );
    expect(css).toMatch(
      /\.palette-panel,\s*\.palette-launcher,\s*\.palette-search-panel,\s*\.palette-template,\s*\.palette-loaded,\s*\.palette-scratch,\s*\.palette-context-picker,\s*\.palette-launcher-shell\s*{[^}]*position:\s*absolute;[^}]*overflow:\s*hidden;[^}]*border-radius:\s*var\(--overlay-radius\);/s,
    );
    expect(css).not.toContain("inset 0 1px 0");
    expect(css).not.toContain("0 0 0 0.5px");
    expect(css).not.toContain("border-color: rgba(61, 145, 255");
    expect(css).not.toContain("border-color: rgba(255, 194, 92");
    expect(css).toContain("--overlay-material-filter: none");
    expect(css).not.toContain(".palette-loaded-mode-carousel");
  });

  test("overlay material remains stable when the host window loses focus", () => {
    expect(css).toContain("--overlay-material: rgba(32, 32, 34, 0.96)");
    expect(css).not.toContain("--overlay-shield-bg");
    expect(css).toContain("--overlay-material: rgba(248, 248, 249, 0.97)");
    expect(css).not.toContain("blur(40px)");
    expect(css).not.toContain("--overlay-material: rgba(255, 255, 255, 0.42)");
    expect(css).not.toContain("--overlay-material: rgba(10, 10, 12, 0.38)");
  });

  test("overlay interaction states share material tokens", () => {
    expect(css).toContain("--overlay-selection-bg");
    expect(css).toContain("--overlay-confirming-bg");
    expect(css).toContain("--overlay-focus-ring");
    expect(css).toContain("--overlay-danger-bg");
    expect(css).toMatch(
      /\.panel-intervention:hover,\s*\.panel-intervention\.is-selected,\s*\.panel-intervention\.is-confirming\s*{[^}]*background:\s*var\(--overlay-selection-bg\);/s,
    );
    expect(css).toMatch(
      /\.panel-intervention\.is-confirming\s*{[^}]*background:\s*var\(--overlay-confirming-bg\);/s,
    );
    expect(css).toMatch(
      /\.palette-search-intervention:hover,\s*\.palette-search-intervention\.is-selected,\s*\.palette-search-intervention\.is-confirming\s*{[^}]*background:\s*var\(--overlay-selection-bg\);/s,
    );
    expect(css).toMatch(
      /\.palette-context-entry:hover,\s*\.palette-context-entry\.is-selected\s*{[^}]*background:\s*var\(--overlay-selection-bg\);/s,
    );
    expect(css).toMatch(
      /\.palette-scratch-error\s*{[^}]*border:\s*0;[^}]*border-top:\s*1px solid var\(--overlay-danger-border\);[^}]*background:\s*var\(--overlay-danger-bg\);/s,
    );
    expect(css).toMatch(
      /\.palette-template-field input:focus,\s*\.palette-template-field select:focus,\s*\.palette-scratch-input:focus\s*{[^}]*box-shadow:\s*0 0 0 3px var\(--overlay-focus-ring\);/s,
    );
  });

  test("palette picker ghost rows stay transparent and loaded state shows one current mode", () => {
    const panel = cssDeclarations(".palette-panel");
    const current = cssDeclarations(".palette-picker-entry.is-current");
    const ghost = cssDeclarations(".palette-picker-entry.is-ghost");
    const loaded = cssDeclarations(".palette-loaded");
    const loadedIdentity = cssDeclarations(".palette-loaded-identity");
    const loadedStatus = cssDeclarations(".palette-loaded-status");
    const loadedMode = cssDeclarations(".palette-loaded-mode");
    const loadedTarget = cssDeclarations(".palette-loaded-target-state");

    expect(panel).toMatchObject({
      "pointer-events": "none",
      padding: "0",
      border: "0",
      overflow: "visible",
      background: "transparent",
      "-webkit-backdrop-filter": "none",
      "backdrop-filter": "none",
      "box-shadow": "none",
    });
    expect(current).toMatchObject({
      "pointer-events": "auto",
      "min-height": "44px",
      border: "1px solid var(--overlay-border)",
      background: "var(--overlay-material)",
      "box-shadow": "var(--overlay-shadow)",
      "text-align": "left",
      "justify-items": "stretch",
    });
    expect(css).toMatch(
      /\.palette-picker-entry\.is-current:hover,\s*\.palette-picker-entry\.is-current\.is-selected\s*{[^}]*background:\s*var\(--overlay-material\);/s,
    );
    expect(css).toMatch(
      /\.palette-picker-current-copy\s*{[^}]*display:\s*grid;[^}]*min-width:\s*0;[^}]*gap:\s*3px;/s,
    );
    expect(css).toMatch(
      /\.palette-picker-handle\s*{[^}]*color:\s*var\(--overlay-text-strong\);[^}]*font-family:\s*ui-monospace,[^}]*font-size:\s*0\.76rem;[^}]*text-overflow:\s*ellipsis;/s,
    );
    expect(css).not.toContain(".palette-picker-title");
    expect(ghost).toMatchObject({
      "justify-self": "center",
      width: "max-content",
      background: "transparent",
      "min-height": "18px",
      "border-radius": "999px",
      opacity: "0.38",
    });
    expect(css).toMatch(
      /\.palette-picker-ghost-handle\s*{[^}]*display:\s*block;[^}]*color:\s*var\(--overlay-text-subtle\);[^}]*font-size:\s*0\.64rem;[^}]*text-overflow:\s*ellipsis;/s,
    );
    expect(css).toMatch(
      /\.palette-picker-entry\.is-ghost:hover,\s*\.palette-picker-entry\.is-ghost\.is-selected,\s*\.palette-picker-entry\.is-ghost\.is-confirming\s*{[^}]*background:\s*transparent;/s,
    );
    expect(loaded).toMatchObject({
      display: "grid",
      "grid-template-columns": "minmax(0, 1fr) auto",
      width: "min(var(--palette-cursor-width), calc(100vw - 40px))",
    });
    expect(loadedIdentity).toMatchObject({ display: "block", "min-width": "0" });
    expect(loadedStatus).toMatchObject({
      "justify-content": "flex-end",
      gap: "6px",
      color: "var(--overlay-text-subtle)",
    });
    expect(loadedMode).toMatchObject({
      "border-left": "1px solid var(--overlay-border-muted)",
      padding: "0 0 0 6px",
      background: "transparent",
      color: "var(--overlay-text-muted)",
    });
    expect(css).toMatch(
      /\.palette-loaded-mode-label\s*{[^}]*font-size:\s*0\.62rem;[^}]*text-overflow:\s*ellipsis;/s,
    );
    expect(loadedTarget).toMatchObject({
      padding: "0",
      background: "transparent",
      color: "var(--overlay-text-subtle)",
    });
    expect(css).not.toContain(".palette-loaded-target-dot");
    expect(css).not.toContain(".palette-loaded-mode-hint");
    expect(css).not.toContain(".palette-loaded-mode.is-previous");
    expect(css).not.toContain(".palette-loaded-title");
    expect(css).not.toContain(".palette-loaded-mode.is-next");
    expect(css).not.toMatch(/\.palette-loaded\.is-delivery-[^{]+\s*{[^}]*--palette-loaded-mode-bg:/s);
  });

  test("light overlay text uses appearance-aware tokens instead of dark hardcoded colors", () => {
    expect(css).toContain("--overlay-text-subtle");
    expect(css).toContain("--overlay-control-text");
    expect(css).toContain("--overlay-warning-text");
    expect(css).toContain("--overlay-warning-bg");
    expect(css).toContain("--overlay-warning-border");
    expect(css).toMatch(
      /\.panel-intervention\s*{[^}]*color:\s*var\(--overlay-text\);/s,
    );
    expect(css).toMatch(
      /\.palette-search\s*{[^}]*color:\s*var\(--overlay-text-strong\);/s,
    );
    expect(css).toMatch(
      /\.palette-scratch-input\s*{[^}]*color:\s*var\(--overlay-text-strong\);/s,
    );
    expect(css).toMatch(
      /\.palette-context-entry\s*{[^}]*color:\s*var\(--overlay-text\);/s,
    );
    expect(css).toMatch(
      /\.palette-search::placeholder\s*{[^}]*color:\s*var\(--overlay-text-subtle\);/s,
    );
    expect(css).toMatch(
      /\.palette-search-token\.is-context\s*{[^}]*color:\s*var\(--overlay-context-text\);/s,
    );
    expect(css).toMatch(
      /\.meta-chip\s*{[^}]*border:\s*1px solid var\(--overlay-border-muted\);[^}]*background:\s*var\(--overlay-control-bg\);[^}]*color:\s*var\(--overlay-text-muted\);/s,
    );
    expect(css).toMatch(
      /\.meta-chip-warning\s*{[^}]*border-color:\s*var\(--overlay-warning-border\);[^}]*background:\s*var\(--overlay-warning-bg\);[^}]*color:\s*var\(--overlay-warning-text\);/s,
    );
    expect(css).not.toMatch(
      /\.palette-search(?:[^{]*)\s*{[^}]*rgba\(217, 222, 225, 0\.44\)/s,
    );
    expect(css).not.toMatch(
      /\.palette-search(?:[^{]*)\s*{[^}]*rgba\(237, 241, 242, 0\.86\)/s,
    );
    expect(css).not.toContain("--line");
    expect(css).not.toContain("--amber");
    expect(css).not.toContain("#0d1013");
    expect(css).not.toContain("--overlay-material: #000");
    expect(css).not.toContain("--overlay-material: black");
    expect(css).not.toContain("--overlay-material: rgba(0, 0, 0");
  });

  test("overlay materials support reduced transparency and reduced motion", () => {
    expect(css).toContain("@media (prefers-reduced-transparency: reduce)");
    expect(css).toMatch(
      /@media \(prefers-reduced-transparency: reduce\)\s*{[^}]*\.palette-overlay\s*{[^}]*--overlay-material:\s*var\(--overlay-material-opaque\);[^}]*--overlay-material-soft:\s*var\(--overlay-material-soft-opaque\);[^}]*--overlay-material-filter:\s*none;/s,
    );
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{[^}]*\.palette-overlay,\s*\.prompt-palette,\s*\.palette-scratch-input\s*{[^}]*transition:\s*none;/s,
    );
    expect(css).toMatch(
      /\.palette-scratch-refine-status::before,\s*\.palette-scratch-alternative-shell\.is-loading \.palette-scratch-alternative\s*{[^}]*animation:\s*none;/s,
    );
    expect(css).not.toMatch(/\.palette-overlay\s*{[^}]*transition:\s*background-color/s);
    expect(css).not.toMatch(/\.prompt-palette\s*{[^}]*transition:\s*opacity/s);
  });

  test("overlay focus rings remain visible on material surfaces", () => {
    expect(css).toMatch(
      /\.palette-overlay button:focus-visible,\s*\.palette-overlay input:focus-visible,\s*\.palette-overlay textarea:focus-visible,\s*\.palette-overlay select:focus-visible\s*{[^}]*box-shadow:\s*0 0 0 3px var\(--overlay-focus-ring\);/s,
    );
    expect(css).toMatch(
      /\.palette-overlay \.palette-search:focus\s*{[^}]*box-shadow:\s*none;/s,
    );
    expect(css).toMatch(
      /\.palette-overlay \.palette-search:focus-visible\s*{[^}]*box-shadow:\s*none;/s,
    );
    expect(css).toMatch(
      /\.palette-template-field input:focus,\s*\.palette-template-field select:focus,\s*\.palette-scratch-input:focus\s*{[^}]*0 0 0 3px var\(--overlay-focus-ring\);/s,
    );
    expect(css).toMatch(
      /\.palette-library-panel:focus\s*{[^}]*outline:\s*none;/s,
    );
    expect(css).not.toMatch(
      /\.palette-library-panel:focus(?:-visible)?\s*{[^}]*box-shadow:\s*0 0 0 3px var\(--overlay-focus-ring\);/s,
    );
  });

  test("launcher overlays use one upper-centered command surface", () => {
    expect(css).toMatch(
      /\.palette-overlay\.is-launcher-mode \.prompt-palette\s*{[^}]*width:\s*100vw;[^}]*height:\s*100vh;[^}]*transform:\s*none !important;/s,
    );
    expect(css).toMatch(
      /\.palette-overlay\.is-launcher-mode \.palette-launcher,\s*\.palette-overlay\.is-launcher-mode \.palette-launcher-shell\s*{[^}]*top:\s*var\(--launcher-frame-top\);[^}]*left:\s*50%;[^}]*width:\s*var\(--launcher-frame-width\);[^}]*max-height:\s*var\(--launcher-frame-max-height\);[^}]*transform:\s*translateX\(-50%\);/s,
    );
    expect(css).not.toMatch(/\.palette-overlay\.is-search-mode \.prompt-palette/);
    expect(css).not.toMatch(/\.palette-overlay\.is-scratch-mode \.prompt-palette/);
    expect(css).not.toMatch(
      /\.palette-overlay\.is-palette-mode \.prompt-palette,[^{]+\.palette-overlay\.is-scratch-mode \.prompt-palette\s*{[^}]*transform:\s*none !important;/s,
    );
    expect(css).not.toMatch(
      /\.palette-overlay\.is-loaded-mode \.prompt-palette,[^{]+\.palette-overlay\.is-scratch-mode \.prompt-palette\s*{[^}]*transform:\s*none !important;/s,
    );
    expect(css).not.toMatch(
      /\.palette-overlay\.is-loaded-mode \.prompt-palette,\s*\.palette-overlay\.is-scratch-mode \.prompt-palette\s*{[^}]*position:\s*fixed;/s,
    );
    expect(css).not.toMatch(/\.palette-overlay\.is-search-mode \.palette-search-panel/);
    expect(css).not.toMatch(
      /\.palette-scratch\s*{[^}]*top:\s*max\(64px,\s*12vh\);/s,
    );
    expect(css).not.toMatch(
      /\.palette-scratch\s*{[^}]*transform:\s*translateX\(-50%\);/s,
    );
  });

  test("Launcher Search keeps a stable input-first frame", () => {
    const sparsePanel = cssDeclarations(".palette-search-panel.is-sparse-results");
    const sparseBody = cssDeclarations(".palette-search-body.is-sparse-results");
    const sparseResults = cssDeclarations(".palette-search-results.is-sparse-results");

    expect(css).toMatch(
      /\.palette-search-panel\s*{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);[^}]*height:\s*var\(--launcher-frame-height\);/s,
    );
    expect(sparsePanel).toMatchObject({
      "grid-template-rows": "auto auto",
      height: "auto",
      "min-height": "0",
    });
    expect(css).toMatch(
      /\.palette-search-input-row\s*{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*border-bottom:\s*1px solid var\(--overlay-border-muted\);/s,
    );
    expect(css).toMatch(
      /\.palette-search-body\s*{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(sparseBody["grid-template-rows"]).toBe("auto");
    expect(css).toMatch(
      /\.palette-search-results\s*{[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s,
    );
    expect(css).toMatch(
      /\.palette-search-results\.is-home-results\s*{[^}]*gap:\s*0;[^}]*padding:\s*6px 8px 10px;/s,
    );
    expect(sparseResults).toMatchObject({
      "max-height": "calc((var(--launcher-row-height) + 32px) * 2)",
      overflow: "visible",
    });
  });

  test("Launcher Search removes unused header and footer chrome", () => {
    expect(css).not.toContain(".palette-search-title");
    expect(css).not.toContain(".palette-search-grip");
    expect(css).not.toContain(".palette-search-footer");
    expect(css).not.toContain(".palette-search-actionbar");
    expect(css).not.toContain(".palette-search-hint");
    expect(css).not.toContain(".palette-search-library");
  });

  test("Launcher Search rows do not inherit Palette centering", () => {
    expect(css).toMatch(
      /\.palette-search-intervention\s*{[^}]*justify-items:\s*stretch;[^}]*text-align:\s*left;/s,
    );
    expect(css).toMatch(
      /\.palette-search-result-text\s*{[^}]*grid-template-columns:\s*var\(--launcher-result-columns\);[^}]*justify-items:\s*stretch;[^}]*width:\s*100%;[^}]*text-align:\s*left;/s,
    );
    expect(css).toContain(".palette-launcher-row-icon");
    expect(css).toContain(".palette-launcher-row-copy");
    expect(css).toMatch(
      /\.palette-search-command-text\s*{[^}]*grid-template-columns:\s*var\(--launcher-result-columns\);[^}]*width:\s*100%;[^}]*text-align:\s*left;/s,
    );
    expect(css).toMatch(
      /\.palette-search-row-meta\s*{[^}]*justify-content:\s*flex-end;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).toMatch(
      /\.palette-search-intervention\.is-home-row\s*{[^}]*box-sizing:\s*border-box;[^}]*min-height:\s*42px;[^}]*margin:\s*2px 8px;[^}]*padding:\s*7px 10px;/s,
    );
    expect(css).toMatch(
      /\.palette-search-intervention\.is-home-row\.is-selected\s*{[^}]*box-shadow:\s*inset 0 0 0 1px var\(--overlay-border-muted\);/s,
    );
    expect(css).not.toContain(".palette-search-intervention.is-home-row .palette-search-row-kind");
    expect(css).toMatch(
      /\.palette-search-intervention\.is-home-row \.palette-search-row-action:not\(\.is-primary\)\s*{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\.palette-search-result-handle,\s*\.palette-search-command-name\s*{[^}]*color:\s*var\(--overlay-text-strong\);[^}]*font-family:\s*ui-monospace,/s,
    );
    expect(css).toMatch(
      /\.palette-search-command-text strong\s*{[^}]*font-family:\s*ui-monospace,/s,
    );
    expect(css).toMatch(
      /\.palette-library-intervention\.is-selected\s*{[^}]*box-shadow:\s*inset 0 0 0 1px var\(--overlay-border-muted\);/s,
    );
    expect(css).toMatch(
      /\.palette-library-intervention\.is-selected \.palette-search-row-action:not\(\.is-primary\)\s*{[^}]*display:\s*none;/s,
    );
    expect(css).toMatch(
      /\.palette-library-intervention\.is-skill-row \.palette-search-row-meta\s*{[^}]*min-width:\s*min\(320px,\s*44vw\);[^}]*max-width:\s*min\(420px,\s*52vw\);/s,
    );
    expect(css).toMatch(
      /\.palette-library-intervention\.is-skill-row \.palette-library-skill-package\s*{[^}]*max-width:\s*min\(270px,\s*34vw\);/s,
    );
  });

  test("Launcher Search long handles and titles ellipsize inside rows", () => {
    expect(css).toMatch(
      /\.palette-launcher-row-copy,\s*\.palette-search-result-description,\s*\.palette-search-command-description,\s*\.palette-search-result-name,\s*\.palette-search-result-handle,\s*\.palette-search-command-name,\s*\.palette-search-command-text strong,\s*\.palette-search-command-text small\s*{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s,
    );
    expect(css).toMatch(
      /\.palette-search-result-text\s*{[^}]*grid-template-columns:\s*var\(--launcher-result-columns\);[^}]*min-width:\s*0;[^}]*max-width:\s*100%;/s,
    );
    expect(css).toContain(".palette-search-result-description");
  });

  test("Launcher Scratch uses a stable composition frame", () => {
    expect(css).toMatch(
      /\.palette-scratch\s*{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto;[^}]*height:\s*var\(--launcher-frame-height\);/s,
    );
    expect(css).toMatch(
      /\.palette-scratch-body\s*{[^}]*display:\s*grid;[^}]*gap:\s*0;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*padding:\s*0;/s,
    );
    expect(css).toMatch(
      /\.palette-scratch-input\s*{[^}]*height:\s*100%;[^}]*min-height:\s*144px;[^}]*max-height:\s*none;[^}]*border:\s*0;[^}]*background:\s*transparent;/s,
    );
    expect(css).toMatch(
      /\.palette-scratch-body > \.palette-scratch-input:first-child:last-child\s*{[^}]*height:\s*100%;/s,
    );
    expect(css).toMatch(
      /\.palette-scratch-alternative\s*{[^}]*height:\s*124px;[^}]*min-height:\s*124px;[^}]*border:\s*0;[^}]*background:\s*transparent;/s,
    );
    expect(css).not.toMatch(/\.palette-scratch-input\s*{[^}]*background:\s*var\(--overlay-material-soft\);/s);
  });

  test("LauncherFrame body contract is shared by modes", () => {
    expect(css).toMatch(
      /\.palette-launcher-body\s*{[^}]*min-width:\s*0;[^}]*min-height:\s*0;/s,
    );
    expect(css).toMatch(
      /\.palette-template\s*{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);[^}]*height:\s*var\(--launcher-frame-height\);[^}]*padding:\s*0;/s,
    );
    expect(css).toMatch(
      /\.palette-template-body\s*{[^}]*display:\s*grid;[^}]*grid-auto-rows:\s*min-content;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;[^}]*padding:\s*0;/s,
    );
    expect(css).toMatch(
      /\.palette-template-field\s*{[^}]*grid-template-columns:\s*var\(--launcher-result-columns\);[^}]*min-height:\s*44px;[^}]*border-bottom:\s*1px solid var\(--overlay-border-muted\);/s,
    );
    expect(css).toMatch(
      /\.palette-template-field input,\s*\.palette-template-field select\s*{[^}]*background:\s*var\(--overlay-control-bg\);/s,
    );
    expect(css).toMatch(
      /\.palette-context-picker\s*{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);[^}]*height:\s*var\(--launcher-frame-height\);[^}]*padding:\s*0;/s,
    );
    expect(css).toMatch(
      /\.palette-context-body\s*{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).not.toContain(".palette-context-grip");
  });

  test("launcher has one click-outside dismiss layer behind the shell", () => {
    expect(css).toMatch(
      /\.palette-launcher-dismiss-layer\s*{[^}]*pointer-events:\s*auto;[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*0;/s,
    );
    expect(css).toMatch(
      /\.palette-overlay\.is-launcher-mode \.palette-launcher,\s*\.palette-overlay\.is-launcher-mode \.palette-launcher-shell\s*{[^}]*z-index:\s*1;/s,
    );
  });

  test("loaded overlay is buttonless visual state, not a crosshair execution sheet", () => {
    const loaded = cssDeclarations(".palette-loaded");

    expect(css).toContain(".palette-loaded");
    expect(css).not.toContain(".palette-loaded.is-delivery-send");
    expect(css).not.toContain(".palette-loaded.is-delivery-interrupt-send");
    expect(loaded).toMatchObject({
      "pointer-events": "none",
      position: "absolute",
      top: "var(--loaded-target-gap)",
      left: "var(--loaded-target-gap)",
    });
    expect(css).toContain("--loaded-target-gap: 6px");
    expect(css).toMatch(
      /\.prompt-palette\.is-flipped-x \.palette-loaded\s*{[^}]*right:\s*var\(--loaded-target-gap\);[^}]*left:\s*auto;/s,
    );
    expect(css).toMatch(
      /\.prompt-palette\.is-flipped-y \.palette-loaded\s*{[^}]*top:\s*auto;[^}]*bottom:\s*var\(--loaded-target-gap\);/s,
    );
    expect(loaded.width).toBe("min(var(--palette-cursor-width), calc(100vw - 40px))");
    expect(loaded["min-height"]).toBe("44px");
    expect(loaded.display).toBe("grid");
    expect(loaded["grid-template-columns"]).toBe("minmax(0, 1fr) auto");
    expect(css).toMatch(
      /\.palette-loaded-label\s*{[^}]*display:\s*block;[^}]*overflow:\s*hidden;/s,
    );
    expect(css).not.toContain(".palette-loaded-mode-carousel");
    expect(css).not.toContain(".palette-loaded button");
    expect(css).not.toContain(".palette-loaded .primary-button");
    expect(css).not.toContain(".palette-loaded-action");
    expect(css).not.toContain(".palette-loaded-actions");
    expect(css).toMatch(
      /\.palette-loaded-mode\s*{[^}]*background:\s*transparent;[^}]*color:\s*var\(--overlay-text-muted\);/s,
    );
    expect(css).not.toContain(".palette-loaded-mode-hint");
    expect(css).not.toMatch(
      /\.palette-loaded\s*{[^}]*position:\s*fixed;[^}]*top:\s*max\(64px,\s*12vh\);/s,
    );
    expect(css).not.toContain(".palette-overlay.is-loaded-mode {\n  cursor: crosshair;");
    expect(css).not.toContain(".palette-execution-mode");
    expect(css).not.toContain(".palette-execution-footer .primary-button");
    expect(css).not.toContain(".palette-template-footer .primary-button");
    expect(css).not.toContain(".palette-scratch-action");
  });

  test("context picker stack mode uses the shared Launcher shell", () => {
    expect(css).toMatch(
      /\.palette-overlay\.is-launcher-mode \.palette-launcher,\s*\.palette-overlay\.is-launcher-mode \.palette-launcher-shell\s*{[^}]*position:\s*fixed;[^}]*top:\s*var\(--launcher-frame-top\);/s,
    );
    expect(css).toMatch(
      /\.palette-launcher-dismiss-layer\s*{[^}]*pointer-events:\s*auto;[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*0;/s,
    );
    expect(css).toContain(".palette-context-title");
    expect(css).toContain(".palette-context-footer");
    expect(css).toContain(".palette-context-entry.is-selected");
  });

  test("Launcher Search distinguishes stack, artifact, and command rows with namespace icons", () => {
    expect(css).toContain(".palette-search-stack-label");
    expect(css).toContain(".palette-search-stack-expiry");
    expect(css).toMatch(
      /\.palette-search-command\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto;[^}]*color:\s*var\(--overlay-text\);[^}]*box-shadow:\s*none;/s,
    );
    expect(css).toContain(".palette-launcher-row-icon.is-prompt");
    expect(css).toContain(".palette-launcher-row-icon.is-context");
    expect(css).toContain(".palette-launcher-row-icon.is-skill");
    expect(css).toContain(".palette-launcher-row-icon.is-command");
    expect(css).toMatch(
      /\.palette-search-command-text strong\s*{[^}]*color:\s*var\(--overlay-text-strong\);/s,
    );
    expect(css).toContain(".palette-search-row-actions");
    expect(css).toContain(".palette-search-row-action.is-primary .palette-search-row-key");
    expect(css).toContain(".palette-search-intervention.is-command-row.is-selected");
  });

  test("launcher home does not render a watermark behind rows", () => {
    expect(css).not.toContain("--overlay-logo-tint");
    expect(css).not.toContain("is-watermarked");
    expect(css).not.toContain("ult-no-bg-logo-white.svg");
    expect(css).not.toMatch(/\.palette-launcher-shell[^{}]*::after/);
  });
});
