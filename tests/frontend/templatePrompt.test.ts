import { describe, expect, test } from "bun:test";

import {
  parseTemplateVariables,
  renderPromptTemplate,
} from "../../src/templatePrompt";

describe("prompt templates", () => {
  test("parses variables while ignoring escaped braces and JSON-like braces", () => {
    const result = parseTemplateVariables(
      "Use {{scope}} for {{task}}. Keep {literal} and JSON { \"x\": true }.",
    );

    expect(result.variables).toEqual(["scope", "task"]);
    expect(result.duplicateVariables).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  test("detects duplicates and rejects empty variable names", () => {
    const result = parseTemplateVariables("Use {{scope}}, {{scope}}, and {{}}.");

    expect(result.variables).toEqual(["scope"]);
    expect(result.duplicateVariables).toEqual(["scope"]);
    expect(result.errors).toEqual(["Template variable names cannot be empty."]);
  });

  test("renders execution text without persisting variable values", () => {
    expect(renderPromptTemplate(
      "Fix {{target}}. Keep {code} literal.",
      { target: "tests" },
    )).toBe("Fix tests. Keep {code} literal.");
  });
});
