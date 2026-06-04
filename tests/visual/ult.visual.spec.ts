import { expect, test, type Locator, type Page } from "@playwright/test";

test.describe("Ult visual smoke", () => {
  test("Launcher search uses a stable compact dark frame", async ({ page }) => {
    await openVisual(page, "launcher-search", "dark");

    await expect(page.locator(".palette-search-panel")).toBeVisible();
    await expect(page.locator(".palette-search-actionbar")).toHaveCount(0);
    await expect(page.locator(".palette-search-row-actions")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-search-results");

    await expect(page).toHaveScreenshot("canonical-launcher-search-dark.png");
  });

  test("Launcher empty state starts with navigable commands", async ({ page }) => {
    await openVisual(page, "launcher-empty", "dark");

    const rows = page.locator(".palette-search-intervention");
    const rowLabels = await rows.locator(".palette-search-result-name, .palette-search-command-name")
      .allTextContents();
    const searchPanel = page.locator(".palette-search-panel");
    await expect(searchPanel).not.toHaveClass(/is-watermarked/);
    await expect(searchPanel).toHaveScreenshot("canonical-launcher-home-surface-dark.png");
    expect(await searchPanel.evaluate((element) =>
      getComputedStyle(element, "::after").content
    )).toBe("none");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(6);
    expect(rowCount).toBeLessThanOrEqual(8);
    await expect(page.locator(".palette-search-section")).toContainText([
      "Continue",
      "Library",
      "Create",
      "Agent Workflows",
      "Project",
      "Recovery / System",
    ]);
    expect(rowLabels).toEqual([
      "#review-change",
      "Browse Library",
      "Scratch",
      "New Prompt",
      "Review Current Change",
      "Project Setup",
      "Preferences",
    ]);
    await expect(rows.first()).toContainText("#review-change");
    await expect(rows.nth(1)).toContainText("Browse Library");
    await expect(rows.nth(2)).toContainText("Scratch");
    await expect(rows.nth(3)).toContainText("New Prompt");
    await expect(rows.nth(4)).toContainText("Review Current Change");
    await expect(rows.nth(5)).toContainText("Project Setup");
    await expect(rows.nth(rowCount - 1)).toContainText("Preferences");
    await expect(rows.first()).toHaveClass(/is-selected/);
    await expectSelectedWithinContainer(
      page,
      ".palette-search-results",
      ".palette-search-intervention.is-selected",
    );
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-search-results");
    await expect(page).toHaveScreenshot("canonical-launcher-home-dark.png");

    for (let index = 0; index < rowCount + 2; index += 1) {
      await page.locator(".palette-search").press("ArrowDown");
      await expectSelectedWithinContainer(
        page,
        ".palette-search-results",
        ".palette-search-intervention.is-selected",
      );
    }
    await expect(rows.nth(2)).toHaveClass(/is-selected/);

    await expect(page).toHaveScreenshot("launcher-home-arrowdown-dark.png");

    await page.locator(".palette-search").press("PageDown");
    await expectSelectedWithinContainer(
      page,
      ".palette-search-results",
      ".palette-search-intervention.is-selected",
    );
  });

  test("Launcher search aligns mixed command rows and long bilingual text", async ({ page }) => {
    await openVisual(page, "launcher-mixed-search", "dark");

    const mixedRows = page.locator(".palette-search-intervention");
    expect(await mixedRows.count()).toBeGreaterThan(1);
    await expect(mixedRows.first()).toContainText("#review-change");
    await expect(page.locator(".palette-search-command").first()).toBeVisible();
    await expect(page.locator(".palette-search-row-actions")).toBeVisible();
    await expect(page.locator(".palette-search-actionbar")).toHaveCount(0);
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-search-results");
    await expect(page).toHaveScreenshot("launcher-mixed-search-dark.png");

    await openVisual(page, "launcher-long-search", "light");
    await expect(page.locator(".palette-search-intervention").first())
      .toContainText("Long Korean and English title for row overflow coverage.");
    await expect(page.locator(".palette-search-result-handle").first())
      .toContainText("#internationalization-review-guardrail-long-handle");
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-search-results");
    await expect(page).toHaveScreenshot("launcher-long-search-light.png");
  });

  test("Launcher command search collapses sparse result lists", async ({ page }) => {
    await openVisual(page, "launcher-sparse-command-search", "dark");

    const searchPanel = page.locator(".palette-search-panel");
    const rows = page.locator(".palette-search-intervention");
    await expect(searchPanel).toHaveClass(/is-sparse-results/);
    await expect(page.locator(".palette-search-results")).toHaveClass(/is-sparse-results/);
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Sparse Result Command");
    await expectNoHorizontalOverflow(page, ".palette-search-results");
    await expectRowsWithinContainer(page, ".palette-search-results", ".palette-search-intervention");
    const sparseBox = await searchPanel.boundingBox();
    expect(sparseBox).not.toBeNull();
    expect(sparseBox!.height).toBeLessThan(180);

    await expect(searchPanel).toHaveScreenshot("launcher-sparse-command-search-surface-dark.png");
    await expect(page).toHaveScreenshot("launcher-sparse-command-search-dark.png");
  });

  test("Launcher Library browses inventory outside the Search input", async ({ page }) => {
    await openVisual(page, "launcher-library", "dark");

    const libraryPanel = page.locator(".palette-library-panel");
    await expect(libraryPanel).toBeVisible();
    await expect(page.locator(".palette-search")).toHaveCount(0);
    await expect(page.locator(".palette-library-tab")).toHaveCount(5);
    await expect(page.locator(".palette-search-result-name")).toContainText([
      "#review-change",
      "#scope-lock",
      "#qa",
      "#deploy-check",
      "@repo-policy",
      "$diagnose",
    ]);
    await expect(page.locator(".palette-library-panel")).not.toContainText("@89abcde");
    await expect(page.locator(".palette-search-command").first()).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-library-results");
    expect(await libraryPanel.evaluate((element) => {
      element.focus();
      return getComputedStyle(element).outlineStyle;
    })).toBe("none");
    await page.locator(".palette-library-intervention.is-selected").first().focus();
    await expect(libraryPanel).toHaveScreenshot("canonical-library-all-surface-dark.png");
    await expect(page).toHaveScreenshot("canonical-library-all-dark.png");

    await page.keyboard.press("Meta+3");
    await expect(page.locator(".palette-library-tab").nth(2)).toHaveClass(/is-selected/);
    await expect(page.locator(".palette-search-result-name").first()).toContainText("@repo-policy");
  });

  test("Launcher Library filters have visual coverage for prompts contexts and skills", async ({ page }) => {
    await openVisual(page, "launcher-library-prompts", "light");
    await expect(page.locator(".palette-library-tab").nth(1)).toHaveClass(/is-selected/);
    await expect(page.locator(".palette-search-result-name").first()).toContainText("#review-change");
    await expect(page.locator(".palette-library-panel")).not.toContainText("@89abcde");
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-library-results");
    await expect(page).toHaveScreenshot("canonical-library-prompts-light.png");

    await openVisual(page, "launcher-library-contexts", "dark");
    await expect(page.locator(".palette-library-tab").nth(2)).toHaveClass(/is-selected/);
    await expect(page.locator(".palette-search-result-name")).toContainText(["@repo-policy"]);
    await expect(page.locator(".palette-library-panel")).not.toContainText("@89abcde");
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-library-results");
    await expect(page).toHaveScreenshot("canonical-library-contexts-dark.png");

    await openVisual(page, "launcher-library-skills", "light");
    await expect(page.locator(".palette-library-tab").nth(3)).toHaveClass(/is-selected/);
    await expect(page.locator(".palette-search-result-name")).toContainText(["$diagnose", "$review-pr"]);
    await expect(page.locator(".palette-library-skill-path").first()).toContainText("personal-library");
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-library-results");
    await expect(page).toHaveScreenshot("canonical-library-skills-light.png");
  });

  test("Launcher Library handles long bilingual inventory and dense skill rows", async ({ page }) => {
    await openVisual(page, "launcher-library-long", "light");
    await expect(page.locator(".palette-search-result-handle").first())
      .toContainText("#internationalization-review-guardrail-long-handle");
    await expect(page.locator(".palette-library-panel"))
      .toContainText("Long Korean and English prompt title for Library row overflow coverage.");
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-library-results");
    await expect(page).toHaveScreenshot("launcher-library-long-light.png");

    await openVisual(page, "launcher-library-dense-skills", "dark");
    await expect(page.locator(".palette-library-tab").nth(3)).toHaveClass(/is-selected/);
    expect(await page.locator(".palette-library-intervention").count()).toBeGreaterThan(6);
    await expect(page.locator(".palette-library-skill-chip").first()).toContainText("Editable");
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-library-results");
    for (let index = 0; index < 10; index += 1) {
      await page.keyboard.press("ArrowDown");
      await expectSelectedWithinContainer(
        page,
        ".palette-library-results",
        ".palette-library-intervention.is-selected",
      );
    }
    await expect(page.locator(".palette-library-panel"))
      .toHaveScreenshot("launcher-library-dense-skills-surface-dark.png");
    await expect(page).toHaveScreenshot("launcher-library-dense-skills-dark.png");
  });

  test("Launcher Library issue rows and dependencies stay scannable", async ({ page }) => {
    await openVisual(page, "launcher-library-issues", "dark");

    const libraryPanel = page.locator(".palette-library-panel");
    await expect(libraryPanel).toBeVisible();
    await expect(page.locator(".palette-library-sort-button").nth(4)).toHaveClass(/is-selected/);
    await expect(page.locator(".palette-library-issue-row")).toContainText([
      "Malformed package",
      "Missing command context",
    ]);
    await expect(page.locator(".palette-library-dependency-chip")).toContainText([
      "@repo-policy",
      "#review-change",
    ]);
    await expect(libraryPanel).not.toContainText("Use Review Change to guide the coding agent");
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-library-results");
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press("ArrowDown");
      await expectSelectedWithinContainer(
        page,
        ".palette-library-results",
        ".palette-library-intervention.is-selected",
      );
    }
    await expect(libraryPanel).toHaveScreenshot("launcher-library-issues-surface-dark.png");
    await expect(page).toHaveScreenshot("launcher-library-issues-dark.png");

    await page.keyboard.press("PageDown");
    await expectSelectedWithinContainer(
      page,
      ".palette-library-results",
      ".palette-library-intervention.is-selected",
    );
  });

  test("Launcher command and workflow rows handle long bilingual metadata", async ({ page }) => {
    await openVisual(page, "launcher-long-command-search", "light");

    const rows = page.locator(".palette-search-intervention");
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator(".palette-search-command").first()).toContainText("국제화 워크플로우");
    await expect(page.locator(".palette-search-command").nth(1)).toContainText("릴리즈 후보 검토");
    await expect(page.locator(".palette-search-row-actions")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-search-results");
    await expectRowsWithinContainer(page, ".palette-search-results", ".palette-search-intervention");

    await page.locator(".palette-search").press("ArrowDown");
    await expectSelectedWithinContainer(
      page,
      ".palette-search-results",
      ".palette-search-intervention.is-selected",
    );
    await expect(page).toHaveScreenshot("launcher-long-command-search-light.png");

    await page.locator(".palette-search").press("PageDown");
    await expectSelectedWithinContainer(
      page,
      ".palette-search-results",
      ".palette-search-intervention.is-selected",
    );
  });

  test("Launcher scratch uses the same visual frame in light mode", async ({ page }) => {
    await openVisual(page, "launcher-scratch", "light");

    await expect(page.locator(".palette-scratch")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-scratch-body");

    await expect(page).toHaveScreenshot("launcher-scratch-light.png");
  });

  test("Launcher artifact reader and composer keep stable large panels", async ({ page }) => {
    await openVisual(page, "launcher-reader", "dark");
    await expect(page.locator(".palette-artifact-panel.is-reader")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-artifact-reader-body");
    await expect(page).toHaveScreenshot("launcher-reader-dark.png");

    await openVisual(page, "launcher-composer", "light");
    await expect(page.locator(".palette-artifact-panel.is-composer")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-artifact-composer-body");
    await expect(page).toHaveScreenshot("launcher-composer-light.png");

    await openVisual(page, "launcher-github-import", "dark");
    await expect(page.locator(".palette-artifact-panel.is-github-import")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-github-import-body");
    await expect(page).toHaveScreenshot("launcher-github-import-dark.png");
  });

  test("Launcher actions and project writes stay keyboard-oriented", async ({ page }) => {
    await openVisual(page, "launcher-actions", "dark");
    await expect(page.locator(".palette-artifact-panel.is-actions")).toBeVisible();
    await expect(page.locator(".palette-artifact-panel.is-actions")).not.toHaveClass(/is-watermarked/);
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-artifact-actions-body");
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".palette-artifact-action-row").nth(1)).toHaveClass(/is-selected/);
    await expect(page).toHaveScreenshot("launcher-actions-dark.png");

    await openVisual(page, "launcher-project-write", "light");
    await expect(page.locator(".palette-artifact-panel.is-project-write")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-project-write-body");
    await expect(page).toHaveScreenshot("launcher-project-write-light.png");

    await openVisual(page, "launcher-project-setup", "light");
    await expect(page.locator(".palette-artifact-panel.is-project-setup")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-project-setup-body");
    await expect(page).toHaveScreenshot("launcher-project-setup-light.png");

    await openVisual(page, "launcher-recovery", "dark");
    await expect(page.locator(".palette-artifact-panel.is-recovery")).toBeVisible();
    await expectStableLauncherFrame(page);
    await expectNoHorizontalOverflow(page, ".palette-recovery-body");
    await expect(page).toHaveScreenshot("canonical-delivery-failed-recovery-dark.png");
  });

  test("Launcher variables and context stack are covered in both appearances", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await openVisual(page, "launcher-variables", theme);
      await expect(page.locator(".palette-template")).toBeVisible();
      await expectStableLauncherFrame(page);
      await expectNoHorizontalOverflow(page, ".palette-template");
      await expect(page).toHaveScreenshot(`launcher-variables-${theme}.png`);

      await openVisual(page, "launcher-stack", theme);
      await expect(page.locator(".palette-context-picker")).toBeVisible();
      await expectStableLauncherFrame(page);
      await expectNoHorizontalOverflow(page, ".palette-context-body");
      await expect(page).toHaveScreenshot(`launcher-stack-${theme}.png`);
    }
  });

  test("Palette picker and loaded state stay compact near the cursor", async ({ page }) => {
    await openVisual(page, "palette-picker", "dark");
    const palettePanel = page.locator(".palette-panel");
    await expectInViewport(page, palettePanel);
    await expectPointerTransform(page, 540, 260);
    await expect(palettePanel).toHaveCSS("width", "256px");
    await expect(page.locator(".palette-picker-title")).toHaveCount(0);
    await expect(page.locator(".palette-picker-handle")).toContainText("#review-change");
    await expect(page.locator(".palette-picker-ghost-handle")).toHaveCount(2);
    await expectNoHorizontalOverflow(page, ".palette-panel");
    await expect(palettePanel).toHaveScreenshot("canonical-quick-palette-surface-dark.png");
    await expect(page).toHaveScreenshot("canonical-quick-palette-dark.png");

    await openVisual(page, "palette-picker-long", "light");
    const longPalettePanel = page.locator(".palette-panel");
    await expectInViewport(page, longPalettePanel);
    await expectPointerTransform(page, 540, 260);
    await expect(longPalettePanel).toHaveCSS("width", "256px");
    await expect(page.locator(".palette-picker-title")).toHaveCount(0);
    await expect(page.locator(".palette-picker-handle"))
      .toContainText("#internationalization-review-guardrail-long-handle");
    await expect(page.locator(".palette-panel")).not.toContainText("Pinned Context Should Not Render");
    await expect(page.locator(".palette-panel")).not.toContainText("Pinned Skill Should Not Render");
    await expectNoHorizontalOverflow(page, ".palette-panel");
    await expect(longPalettePanel).toHaveScreenshot("palette-picker-long-surface-light.png");
    await expect(page).toHaveScreenshot("palette-picker-long-light.png");

    for (const theme of ["light", "dark"] as const) {
      await openVisual(page, "loaded-ready", theme);
      const loadedBadge = page.locator(".palette-loaded");
      await expectInViewport(page, loadedBadge);
      await expectPointerTransform(page, 520, 260);
      await expect(loadedBadge).toHaveCSS("width", "256px");
      await expect(page.locator(".palette-loaded-label")).toContainText("#review-change");
      await expect(page.locator(".palette-loaded-title")).toHaveCount(0);
      await expect(page.locator(".palette-loaded-mode-carousel")).toHaveCount(0);
      await expect(page.locator(".palette-loaded-mode-hint")).toHaveCount(0);
      await expect(page.locator(".palette-loaded-target-state")).toContainText("Click target app");
      await expectNoHorizontalOverflow(page, ".palette-loaded");
      await expect(loadedBadge).toHaveScreenshot(`canonical-loaded-ready-surface-${theme}.png`);
      await expect(page).toHaveScreenshot(`canonical-loaded-ready-${theme}.png`);
    }

    await openVisual(page, "loaded-context", "dark");
    const contextLoadedBadge = page.locator(".palette-loaded");
    await expectInViewport(page, contextLoadedBadge);
    await expectPointerTransform(page, 520, 260);
    await expect(contextLoadedBadge).toHaveCSS("width", "256px");
    await expect(page.locator(".palette-loaded-label")).toContainText("#review-change");
    await expect(page.locator(".palette-loaded-title")).toHaveCount(0);
    await expect(page.locator(".palette-loaded-target-state")).toContainText("Click target app");
    await expectNoHorizontalOverflow(page, ".palette-loaded");
    await expect(contextLoadedBadge).toHaveScreenshot("canonical-loaded-context-surface-dark.png");
    await expect(page).toHaveScreenshot("canonical-loaded-context-dark.png");

    await openVisual(page, "loaded-copy", "light");
    const copyLoadedBadge = page.locator(".palette-loaded");
    await expectInViewport(page, copyLoadedBadge);
    await expectPointerTransform(page, 520, 260);
    await expect(copyLoadedBadge).toHaveCSS("width", "256px");
    await expect(page.locator(".palette-loaded-label")).toContainText("#review-change");
    await expect(page.locator(".palette-loaded-target-state")).toContainText("Click to copy");
    await expect(page.locator(".palette-loaded-mode-label")).toContainText("Copy");
    await expectNoHorizontalOverflow(page, ".palette-loaded");
    await expect(copyLoadedBadge).toHaveScreenshot("canonical-loaded-copy-surface-light.png");
    await expect(page).toHaveScreenshot("canonical-loaded-copy-light.png");

    await openVisual(page, "loaded-long", "dark");
    const longLoadedBadge = page.locator(".palette-loaded");
    await expectInViewport(page, longLoadedBadge);
    await expectPointerTransform(page, 520, 260);
    await expect(longLoadedBadge).toHaveCSS("width", "256px");
    await expect(page.locator(".palette-loaded-label"))
      .toContainText("#internationalization-review-guardrail-long-handle");
    await expect(page.locator(".palette-loaded-title")).toHaveCount(0);
    await expectNoHorizontalOverflow(page, ".palette-loaded");
    await expect(longLoadedBadge).toHaveScreenshot("loaded-long-surface-dark.png");
    await expect(page).toHaveScreenshot("loaded-long-dark.png");
  });
});

async function openVisual(
  page: Page,
  surface: string,
  theme: "light" | "dark",
) {
  await page.goto(`/tests/visual/harness.html?surface=${surface}&theme=${theme}`);
  await expect(page.locator("body[data-visual-ready='true']")).toBeVisible();
}

async function expectStableLauncherFrame(page: Page) {
  const frame = page.locator(".palette-launcher, .palette-launcher-shell").first();
  const before = await frame.boundingBox();
  expect(before).not.toBeNull();

  await page.keyboard.press("a");
  await page.waitForTimeout(50);
  const after = await frame.boundingBox();
  expect(after).not.toBeNull();
  expect(Math.round(after!.width)).toBe(Math.round(before!.width));
  expect(Math.round(after!.height)).toBe(Math.round(before!.height));
}

async function expectNoHorizontalOverflow(page: Page, selector: string) {
  const overflowing = await page.locator(selector).evaluateAll((elements) =>
    elements.some((element) => {
      const node = element as HTMLElement;
      return node.scrollWidth > node.clientWidth + 1;
    }),
  );
  expect(overflowing).toBe(false);
}

async function expectRowsWithinContainer(
  page: Page,
  containerSelector: string,
  rowSelector: string,
) {
  const container = page.locator(containerSelector);
  const containerBox = await container.boundingBox();
  expect(containerBox).not.toBeNull();
  const rows = await page.locator(rowSelector).evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
      };
    }),
  );
  for (const row of rows) {
    expect(row.top).toBeGreaterThanOrEqual(containerBox!.y - 1);
    expect(row.bottom).toBeLessThanOrEqual(containerBox!.y + containerBox!.height + 1);
  }
}

async function expectSelectedWithinContainer(
  page: Page,
  containerSelector: string,
  selectedSelector: string,
) {
  const containerBox = await page.locator(containerSelector).boundingBox();
  const selectedBox = await page.locator(selectedSelector).boundingBox();
  expect(containerBox).not.toBeNull();
  expect(selectedBox).not.toBeNull();
  expect(selectedBox!.y).toBeGreaterThanOrEqual(containerBox!.y - 1);
  expect(selectedBox!.y + selectedBox!.height)
    .toBeLessThanOrEqual(containerBox!.y + containerBox!.height + 1);
}

async function expectInViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function expectPointerTransform(page: Page, x: number, y: number) {
  const transform = await page.locator(".prompt-palette").evaluate((element) =>
    (element as HTMLElement).style.transform
  );
  expect(transform).toBe(`translate3d(${x}px, ${y}px, 0px)`);
}
