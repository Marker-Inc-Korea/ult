import { beforeEach, describe, expect, test } from "bun:test";

import {
  FakeElement,
  actions,
  findAllByClass,
  findAllByTag,
  findByClass,
  installPaletteRendererDom,
  keyEvent,
  renderPromptPalette,
  runtime,
  textOf,
} from "./support/paletteRendererHarness";

beforeEach(() => {
  installPaletteRendererDom();
});

describe("palette renderer scratch prompt", () => {
  test("uses Enter for save/load, Cmd+R for refine, Cmd+Enter for newline, and Esc for close", () => {
    const palette = runtime();
    let updatedText = "";
    let refineCount = 0;
    let promoteCount = 0;
    let submitCount = 0;
    let cancelCount = 0;

    renderPromptPalette(palette, actions({
      updateScratchText: (text) => {
        updatedText = text;
      },
      refineScratch: () => {
        refineCount += 1;
      },
      promoteScratchToCreate: () => {
        promoteCount += 1;
      },
      submitScratch: () => {
        submitCount += 1;
      },
      cancelScratch: () => {
        cancelCount += 1;
      },
    }));

    const textarea = findByClass(
      palette.container as unknown as FakeElement,
      "palette-scratch-input",
    );
    expect(textarea).not.toBeNull();

    const refine = keyEvent("r", { metaKey: true });
    textarea?.dispatch("keydown", refine);
    expect(refine.prevented).toBe(true);
    expect(refineCount).toBe(1);

    textarea!.value = "line one";
    textarea!.selectionStart = textarea!.value.length;
    textarea!.selectionEnd = textarea!.value.length;
    const newline = keyEvent("Enter", { metaKey: true });
    textarea?.dispatch("keydown", newline);
    expect(newline.prevented).toBe(true);
    expect(updatedText).toBe("line one\n");
    expect(submitCount).toBe(0);

    const promote = keyEvent("s", { metaKey: true });
    textarea?.dispatch("keydown", promote);
    expect(promote.prevented).toBe(true);
    expect(promoteCount).toBe(1);
    expect(updatedText).toBe("line one\n");

    const submit = keyEvent("Enter");
    textarea?.dispatch("keydown", submit);
    expect(submit.prevented).toBe(true);
    expect(submitCount).toBe(1);

    const cancel = keyEvent("Escape");
    textarea?.dispatch("keydown", cancel);
    expect(cancel.prevented).toBe(true);
    expect(cancelCount).toBe(1);
  });

  test("does not submit Scratch with Shift+Tab before it is loaded", () => {
    const palette = runtime();
    let submitCount = 0;

    renderPromptPalette(palette, actions({
      submitScratch: () => {
        submitCount += 1;
      },
    }));

    const textarea = findByClass(
      palette.container as unknown as FakeElement,
      "palette-scratch-input",
    );
    expect(textarea).not.toBeNull();

    const event = keyEvent("Tab", { shiftKey: true });
    textarea?.dispatch("keydown", event);

    expect(event.prevented).toBe(false);
    expect(submitCount).toBe(0);
  });

  test("keeps scratch composition frame stable while typing", () => {
    const palette = runtime();
    const updates: string[] = [];

    renderPromptPalette(palette, actions({
      updateScratchText: (text) => {
        updates.push(text);
      },
    }));

    const textarea = findByClass(
      palette.container as unknown as FakeElement,
      "palette-scratch-input",
    );
    expect(textarea).not.toBeNull();

    textarea!.value = "line one";
    textarea!.dispatch("input", keyEvent(""));
    expect(updates).toEqual(["line one"]);
    expect(textarea!.style.height).toBeUndefined();

    textarea!.selectionStart = textarea!.value.length;
    textarea!.selectionEnd = textarea!.value.length;
    const newline = keyEvent("Enter", { metaKey: true });
    textarea!.dispatch("keydown", newline);
    expect(newline.prevented).toBe(true);
    expect(textarea!.style.height).toBeUndefined();
  });

  test("keeps scratch input read-only while refine is running", () => {
    const palette = runtime();
    palette.scratchRefining = true;
    palette.scratchRefineSourceText = "rough prompt";
    let updatedText = "";
    let submitCount = 0;

    renderPromptPalette(palette, actions({
      updateScratchText: (text) => {
        updatedText = text;
      },
      submitScratch: () => {
        submitCount += 1;
      },
    }));

    const textarea = findByClass(
      palette.container as unknown as FakeElement,
      "palette-scratch-input",
    );
    expect(textarea?.readOnly).toBe(true);

    textarea!.value = "rough prompt";
    textarea!.selectionStart = textarea!.value.length;
    textarea!.selectionEnd = textarea!.value.length;
    const newline = keyEvent("Enter", { metaKey: true });
    textarea?.dispatch("keydown", newline);

    expect(newline.prevented).toBe(true);
    expect(updatedText).toBe("");
    expect(submitCount).toBe(0);
    expect(textarea?.value).toBe("rough prompt");
  });

  test("renders refined prompt as a same-frame alternative with use and undo commands", () => {
    const palette = runtime();
    palette.scratchText = "rough prompt";
    palette.scratchRefineSourceText = "rough prompt";
    palette.scratchRefineResultText = "refined prompt";
    let acceptCount = 0;
    let restoreCount = 0;

    renderPromptPalette(palette, actions({
      acceptScratchRefinement: () => {
        acceptCount += 1;
      },
      restoreScratchOriginal: () => {
        restoreCount += 1;
      },
    }));

    const inputs = findAllByClass(
      palette.container as unknown as FakeElement,
      "palette-scratch-input",
    );
    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe("rough prompt");
    expect(inputs[1].value).toBe("refined prompt");
    expect(inputs[1].readOnly).toBe(true);

    const keepRefined = keyEvent("k", { metaKey: true });
    inputs[0].dispatch("keydown", keepRefined);
    expect(keepRefined.prevented).toBe(true);
    expect(acceptCount).toBe(1);

    const undoRefined = keyEvent("z", { metaKey: true });
    inputs[0].dispatch("keydown", undoRefined);
    expect(undoRefined.prevented).toBe(true);
    expect(restoreCount).toBe(1);
  });

  test("renders scratch refine errors inline with retry command", () => {
    const palette = runtime();
    palette.scratchRefineError = "OpenAI response was incomplete.";

    renderPromptPalette(palette, actions());

    const error = findByClass(
      palette.container as unknown as FakeElement,
      "palette-scratch-error",
    );
    expect(error).not.toBeNull();
    expect(findByClass(error!, "palette-scratch-command")).not.toBeNull();
    expect(textOf(error!)).toContain("Retry");
    expect(textOf(error!)).toContain("⌘R");
    expect(findAllByTag(error!, "button")).toHaveLength(0);
  });

  test("renders explicit create promotion without replacing scratch load", () => {
    const palette = runtime();
    let promoted = false;
    let updatedText = "";

    renderPromptPalette(palette, actions({
      promoteScratchToCreate: () => {
        promoted = true;
      },
      updateScratchText: (text) => {
        updatedText = text;
      },
    }));

    const root = palette.container as unknown as FakeElement;
    const footer = findByClass(root, "palette-scratch-footer");
    expect(footer).not.toBeNull();
    expect(textOf(footer!)).toContain("Enter load");
    expect(textOf(footer!)).toContain("⌘S create");
    expect(textOf(footer!)).not.toContain("Save Ephemeral");
    const create = findAllByTag(footer!, "button").find((button) =>
      textOf(button) === "Create Prompt"
    );
    expect(create).not.toBeNull();

    const textarea = findByClass(root, "palette-scratch-input") as FakeElement;
    textarea.value = "Promote this scratch draft.";
    create!.dispatch("click", keyEvent("click"));

    expect(updatedText).toBe("Promote this scratch draft.");
    expect(promoted).toBe(true);
  });
});
