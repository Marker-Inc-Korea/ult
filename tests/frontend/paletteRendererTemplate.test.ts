import { beforeEach, describe, expect, test } from "bun:test";

import { resolveTemplateDynamicEnum } from "../../src/overlay/launcher/templateController";
import {
  FakeElement,
  actions,
  context,
  findAllByClass,
  findAllByTag,
  findByClass,
  installPaletteRendererDom,
  keyEvent,
  prompt,
  renderPromptPalette,
  runtime,
  textOf,
} from "./support/paletteRendererHarness";

beforeEach(() => {
  installPaletteRendererDom();
});

describe("palette renderer template variables", () => {
  test("renders template prompts as compact slot filling with @context options", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.prompts = [
      {
        ...prompt(0),
        title: "Review",
        template_variables: ["scope", "reference"],
        template_arguments: [{
          name: "scope",
          description: "Scope to review",
          default_value: "current diff",
          value_type: "enum",
          enum_source: "static",
          enum_name: "Scope",
          enum_values: ["current diff", "branch"],
        }],
      },
      {
        ...prompt(1),
        id: "repo-policy",
        title: "Repo Policy",
        artifact_type: "context",
      },
    ];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const template = findByClass(root, "palette-template");
    expect(template).not.toBeNull();
    expect(findByClass(template!, "palette-launcher-body")).not.toBeNull();
    const inputs = findAllByTag(root, "input");
    expect(inputs.map((input) => input.name)).toEqual(["scope", "reference"]);
    expect(inputs[0].attributes.get("list")).toBe("template-values-scope");
    expect(inputs[0].placeholder).toBe("Scope to review");
    expect(inputs[0].value).toBe("current diff");
    expect(findAllByTag(root, "button")).toEqual([]);

    const options = findAllByTag(root, "option");
    expect(options[0].value).toBe("current diff");
    expect(options[2].value).toBe("@repo-policy");
  });

  test("renders dynamic enum choices from runtime without persisting them", () => {
    const palette = runtime();
    palette.overlayMode = "launcher";
    palette.launcherMode = "search";
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.templateDynamicEnumValues = {
      branch: ["main", "feature"],
    };
    palette.prompts = [{
      ...prompt(0),
      title: "Review",
      template_variables: ["branch"],
      template_arguments: [{
        name: "branch",
        description: "Branch",
        value_type: "enum",
        enum_source: "dynamic",
        enum_name: "Branches",
        enum_values: [],
        enum_dynamic_command: "git branch",
        enum_dynamic_cwd: "/repo",
      }],
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    const input = findAllByTag(root, "input")[0];
    expect(input.attributes.get("list")).toBe("template-values-branch");
    expect(findAllByTag(root, "option").map((option) => option.value))
      .toEqual(["main", "feature"]);
    expect(palette.prompts[0].template_arguments?.[0].enum_values).toEqual([]);
  });

  test("resolves dynamic enum choices only from explicit shortcut", () => {
    const palette = runtime();
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.prompts = [{
      ...prompt(0),
      template_variables: ["branch", "ticket"],
      template_arguments: [
        {
          name: "branch",
          value_type: "text",
        },
        {
          name: "ticket",
          value_type: "enum",
          enum_source: "dynamic",
          enum_dynamic_command: "printf T1",
          enum_dynamic_cwd: "/repo",
        },
      ],
    }];
    const resolved: string[] = [];

    renderPromptPalette(palette, actions({
      resolveTemplateVariable: (variable) => {
        resolved.push(variable);
      },
    }));

    const inputs = findAllByTag(
      palette.container as unknown as FakeElement,
      "input",
    );
    expect(resolved).toEqual([]);

    inputs[1].dispatch("focus", keyEvent(""));
    expect(resolved).toEqual([]);

    const nonDynamic = keyEvent("r", { metaKey: true });
    inputs[0].dispatch("keydown", nonDynamic);
    expect(nonDynamic.prevented).toBe(false);
    expect(resolved).toEqual([]);

    const dynamic = keyEvent("r", { metaKey: true });
    inputs[1].dispatch("keydown", dynamic);
    expect(dynamic.prevented).toBe(true);
    expect(resolved).toEqual(["ticket"]);
  });

  test("template input keeps manual text in runtime state across rerenders", () => {
    const palette = runtime();
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.prompts = [{
      ...prompt(0),
      template_variables: ["branch"],
      template_arguments: [{
        name: "branch",
        value_type: "enum",
        enum_source: "dynamic",
        enum_dynamic_command: "git branch",
        enum_dynamic_cwd: "/repo",
      }],
    }];

    renderPromptPalette(palette, actions({
      updateTemplateValue: (variable, value) => {
        palette.templateValues = {
          ...palette.templateValues,
          [variable]: value,
        };
      },
    }));

    let root = palette.container as unknown as FakeElement;
    let input = findAllByTag(root, "input")[0];
    input.value = "manual branch";
    input.dispatch("input", keyEvent(""));

    renderPromptPalette(palette, actions());

    root = palette.container as unknown as FakeElement;
    input = findAllByTag(root, "input")[0];
    expect(input.value).toBe("manual branch");
  });

  test("keeps manual template input available when dynamic enum resolution fails", () => {
    const palette = runtime();
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.templateDynamicEnumErrors = {
      branch: "Dynamic enum command timed out.",
    };
    palette.prompts = [{
      ...prompt(0),
      template_variables: ["branch"],
      template_arguments: [{
        name: "branch",
        value_type: "enum",
        enum_source: "dynamic",
        enum_dynamic_command: "sleep 5",
        enum_dynamic_cwd: "/repo",
      }],
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(findAllByTag(root, "input").map((input) => input.name)).toEqual(["branch"]);
    expect(textOf(root)).toContain("Dynamic enum command timed out.");
    expect(textOf(root)).toContain("Type any value to continue.");
    expect(textOf(root)).toContain("Cmd+R retries.");
  });

  test("dynamic enum shortcut refreshes previous choices and errors", async () => {
    const palette = runtime();
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.templateDynamicEnumValues = {
      branch: ["stale"],
    };
    palette.templateDynamicEnumErrors = {
      branch: "Previous failure.",
    };
    palette.prompts = [{
      ...prompt(0),
      template_variables: ["branch"],
      template_arguments: [{
        name: "branch",
        value_type: "enum",
        enum_source: "dynamic",
        enum_dynamic_command: "git branch",
        enum_dynamic_cwd: "/repo",
      }],
    }];
    const calls: Array<Record<string, unknown> | undefined> = [];
    (globalThis.window as unknown as {
      __TAURI_INTERNALS__?: {
        invoke: <T>(command: string, payload?: Record<string, unknown>) => Promise<T>;
      };
    }).__TAURI_INTERNALS__ = {
      invoke: async <T,>(command: string, payload?: Record<string, unknown>) => {
        calls.push(payload);
        expect(command).toBe("resolve_dynamic_enum_argument");
        expect(palette.templateDynamicEnumValues.branch).toBeUndefined();
        expect(palette.templateDynamicEnumErrors.branch).toBeUndefined();
        return {
          argument_name: "branch",
          ok: true,
          values: ["main", "feature"],
          truncated: false,
          timed_out: false,
          retryable: false,
          error: null,
        } as T;
      },
    };
    let renderCount = 0;

    await resolveTemplateDynamicEnum(palette, "branch", () => {
      renderCount += 1;
    });

    expect(calls).toEqual([{
      argumentName: "branch",
      command: "git branch",
      workingDirectory: "/repo",
    }]);
    expect(renderCount).toBe(2);
    expect(palette.templateDynamicEnumValues.branch).toEqual(["main", "feature"]);
    expect(palette.templateDynamicEnumErrors.branch).toBeUndefined();
  });

  test("enter advances template variables and submits on the last field", () => {
    const palette = runtime();
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.prompts = [{
      ...prompt(0),
      template_variables: ["scope", "risk"],
    }];
    let submitted: Record<string, string> | null = null;

    renderPromptPalette(palette, actions({
      submitTemplate: (values) => {
        submitted = values;
      },
    }));

    const inputs = findAllByTag(
      palette.container as unknown as FakeElement,
      "input",
    );
    inputs[0].value = "current diff";
    inputs[1].value = "@repo-policy";

    const next = keyEvent("Enter");
    inputs[0].dispatch("keydown", next);
    expect(next.prevented).toBe(true);
    expect(submitted).toBeNull();

    const submit = keyEvent("Enter");
    inputs[1].dispatch("keydown", submit);
    expect(submit.prevented).toBe(true);
    expect(submitted).toEqual({
      scope: "current diff",
      risk: "@repo-policy",
    });
  });

  test("renders required variable errors inside the compact launcher form", () => {
    const palette = runtime();
    palette.surfaceMode = "template";
    palette.templatePromptId = "prompt-0";
    palette.templateValidationErrors = {
      risk: "Required",
    };
    palette.prompts = [{
      ...prompt(0),
      title: "Review",
      template_variables: ["scope", "risk"],
    }];

    renderPromptPalette(palette, actions());

    const root = palette.container as unknown as FakeElement;
    expect(textOf(root)).toContain("#prompt-0 (scope, risk)");
    expect(textOf(root)).toContain("Required");
    const risk = findAllByTag(root, "input").find((input) => input.name === "risk");
    expect(risk?.attributes.get("aria-invalid")).toBe("true");
  });
});
