import { beforeEach, describe, expect, test } from "bun:test";

import {
  applyPreparedPrompt,
  prepareRegistryPrompt,
  prepareScratchPrompt,
  prepareTemplatePrompt,
  stateForDeliveryResult,
} from "../../src/promptExecutor";
import type { DeliveryResultEvent, PromptDefinition } from "../../src/types";

type NativeCall = {
  command: string;
  payload?: Record<string, unknown>;
};

const calls: NativeCall[] = [];

function prompt(overrides: Partial<PromptDefinition> = {}): PromptDefinition {
  return {
    id: "scope-lock",
    title: "Scope Lock",
    description: "Constrain scope.",
    prompt: "Stay inside {{scope}}.",
    registry_source: "bundled",
    ...overrides,
  };
}

beforeEach(() => {
  calls.length = 0;
  (globalThis as unknown as { window: unknown }).window = {
    __TAURI_INTERNALS__: {
      invoke: async (command: string, payload?: Record<string, unknown>) => {
        calls.push({ command, payload });
        return { delivery_id: 1, status: "started", message: "Applying" };
      },
    },
  };
});

describe("prompt executor", () => {
  test("prepares registry prompts with source-derived execution kind", () => {
    expect(prepareRegistryPrompt(prompt()).promptKind).toBe("bundled");
    expect(prepareRegistryPrompt(prompt({ registry_source: "local-file" })).promptKind)
      .toBe("local");
    expect(prepareRegistryPrompt(prompt({ artifact_type: "context" })).promptKind)
      .toBe("context");
  });

  test("rejects skills before creating a prepared delivery payload", () => {
    const skill = prompt({
      id: "diagnose",
      title: "diagnose",
      artifact_type: "skill",
      prompt: "---\nname: diagnose\n---\n\nInspect logs.",
    });

    expect(() => prepareRegistryPrompt(skill)).toThrow("Skills cannot be loaded for delivery.");
    expect(() => prepareTemplatePrompt(skill, {})).toThrow("Skills cannot be loaded for delivery.");
  });

  test("prepares templates and scratch prompts without persisting variable text", () => {
    const preparedTemplate = prepareTemplatePrompt(prompt(), { scope: "bug only" });
    expect(preparedTemplate.promptKind).toBe("template");
    expect(preparedTemplate.text).toBe("Stay inside bug only.");

    const preparedScratch = prepareScratchPrompt("one-off", "paste");
    expect(preparedScratch.promptId).toBeNull();
    expect(preparedScratch.promptKind).toBe("scratch");
    expect(preparedScratch.deliveryMode).toBe("paste");
  });

  test("uses loaded runtime default for registry and template prompts", () => {
    expect(prepareRegistryPrompt(prompt()).deliveryMode).toBe("paste");
    expect(prepareTemplatePrompt(prompt(), { scope: "bug only" }).deliveryMode)
      .toBe("paste");
  });

  test("composes explicit context references outside the prompt body", () => {
    const context = prompt({
      id: "repo-policy",
      title: "Repo Policy",
      artifact_type: "context",
      prompt: "Never read terminal contents by default.",
    });
    const prepared = prepareRegistryPrompt(prompt({
      contexts: ["repo-policy"],
      prompt: "Review the current change.",
    }), [context]);

    expect(prepared.contextTitles).toEqual(["Repo Policy"]);
    expect(prepared.contextHandles).toEqual(["@repo-policy"]);
    expect(prepared.artifactHandle).toBe("#scope-lock");
    expect(prepared.text).toBe(
      "Context:\n\n### Repo Policy\nNever read terminal contents by default.\n\nInstruction:\nReview the current change.",
    );
  });

  test("template variable @context handles attach context artifacts", () => {
    const context = prompt({
      id: "repo-policy",
      title: "Repo Policy",
      artifact_type: "context",
      prompt: "Never read terminal contents by default.",
    });
    const prepared = prepareTemplatePrompt(prompt({
      prompt: "Review {{scope}}.",
      template_variables: ["scope"],
    }), { scope: "@repo-policy" }, [context]);

    expect(prepared.contextTitles).toEqual(["Repo Policy"]);
    expect(prepared.contextHandles).toEqual(["@repo-policy"]);
    expect(prepared.templateValueLabels).toEqual(["@repo-policy"]);
    expect(prepared.unresolvedVariables).toEqual([]);
    expect(prepared.text).toBe(
      "Context:\n\n### Repo Policy\nNever read terminal contents by default.\n\nInstruction:\nReview @repo-policy.",
    );
  });

  test("template preparation records unresolved variables for loaded labels", () => {
    const prepared = prepareTemplatePrompt(prompt({
      prompt: "Review {{scope}} for {{risk}}.",
      template_variables: ["scope", "risk"],
    }), { scope: "current diff", risk: "" });

    expect(prepared.artifactHandle).toBe("#scope-lock");
    expect(prepared.templateValueLabels).toEqual(["scope"]);
    expect(prepared.unresolvedVariables).toEqual(["risk"]);
  });

  test("search composer context handles attach to registry and template prompts", () => {
    const context = prompt({
      id: "repo-policy",
      title: "Repo Policy",
      artifact_type: "context",
      prompt: "Never read terminal contents by default.",
    });
    const registryPrepared = prepareRegistryPrompt(prompt({
      prompt: "Review the current change.",
    }), [context], ["repo-policy"]);
    const templatePrepared = prepareTemplatePrompt(prompt({
      prompt: "Review {{scope}}.",
      template_variables: ["scope"],
    }), { scope: "current change" }, [context], ["repo-policy"]);

    expect(registryPrepared.contextTitles).toEqual(["Repo Policy"]);
    expect(templatePrepared.contextTitles).toEqual(["Repo Policy"]);
    expect(registryPrepared.text).toContain("### Repo Policy");
    expect(templatePrepared.text).toContain("Instruction:\nReview current change.");
  });

  test("applies prepared execution through the native executor contract", async () => {
    const prepared = prepareScratchPrompt("private scratch text", "paste");

    await applyPreparedPrompt(prepared);

    expect(calls).toEqual([
      {
        command: "deliver_prompt_at_pointer",
        payload: {
          text: "private scratch text",
          mode: "paste",
          promptId: null,
          promptKind: "scratch",
        },
      },
    ]);
    expect(calls.some((call) => call.command.includes("project"))).toBe(false);
    expect(JSON.stringify(calls)).not.toContain("targetDirectory");
  });

  test("applies registry prompts with metadata ids rather than visible handles", async () => {
    const prepared = prepareRegistryPrompt(prompt({ id: "review-pr" }));

    await applyPreparedPrompt(prepared);

    expect(prepared.artifactHandle).toBe("#review-pr");
    expect(calls).toEqual([
      {
        command: "deliver_prompt_at_pointer",
        payload: {
          text: "Stay inside {{scope}}.",
          mode: "paste",
          promptId: "review-pr",
          promptKind: "bundled",
        },
      },
    ]);
    expect(JSON.stringify(calls)).not.toContain("#review-pr");
    expect(JSON.stringify(calls)).not.toContain("/review-pr");
  });

  test("standardizes delivery result states", () => {
    expect(stateForDeliveryResult({
      delivery_id: 1,
      timestamp_ms: 1,
      prompt_id: null,
      prompt_kind: "scratch",
      mode: "paste",
      execution_state: "clipboard",
      status: "copied",
      message: "Copied",
      clipboard_restored: false,
    } satisfies DeliveryResultEvent)).toBe("clipboard");
  });
});
