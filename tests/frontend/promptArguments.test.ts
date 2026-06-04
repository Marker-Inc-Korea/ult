import { describe, expect, test } from "bun:test";

import {
  nextPromptTemplateArgumentName,
  normalizePromptTemplateArgument,
  syncPromptTemplateArguments,
} from "../../src/promptArguments";

describe("prompt arguments", () => {
  test("syncs argument metadata to double-brace variables", () => {
    const argumentsList = syncPromptTemplateArguments(
      "Review {{scope}} with {{risk}}.",
      [{
        name: "scope",
        description: "Current scope",
        default_value: "diff",
        value_type: "enum",
        enum_source: "static",
        enum_name: "Scope",
        enum_values: ["diff", "branch"],
      }, {
        name: "stale",
        description: "unused",
      }],
    );

    expect(argumentsList.map((argument) => argument.name)).toEqual(["scope", "risk"]);
    expect(argumentsList[0]).toMatchObject({
      description: "Current scope",
      default_value: "diff",
      value_type: "enum",
      enum_values: ["diff", "branch"],
    });
    expect(argumentsList[1]).toMatchObject({
      name: "risk",
      value_type: "text",
    });
  });

  test("chooses the next available argument name", () => {
    expect(nextPromptTemplateArgumentName("{{argument_1}} {{argument_3}}", [{
      name: "argument_2",
    }])).toBe("argument_4");
  });

  test("keeps dynamic enum command and cwd while dropping resolved values", () => {
    expect(normalizePromptTemplateArgument({
      name: "branch",
      value_type: "enum",
      enum_source: "dynamic",
      enum_name: "Branches",
      enum_values: ["main"],
      enum_dynamic_command: " git branch --format='%(refname:short)' ",
      enum_dynamic_cwd: " ~/Workspace/ult ",
    })).toMatchObject({
      name: "branch",
      value_type: "enum",
      enum_source: "dynamic",
      enum_name: "Branches",
      enum_values: [],
      enum_dynamic_command: "git branch --format='%(refname:short)'",
      enum_dynamic_cwd: "~/Workspace/ult",
    });
  });
});
