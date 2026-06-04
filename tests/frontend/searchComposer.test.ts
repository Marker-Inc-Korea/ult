import { describe, expect, test } from "bun:test";

import {
  canonicalArtifactHandle,
  contextArtifactHandle,
  launcherCommandHandle,
  promptArtifactHandle,
  skillArtifactHandle,
} from "../../src/promptUtils";
import {
  composerContextIds,
  composerPrompt,
  parseSearchComposerQuery,
  removeSearchComposerHandle,
  searchComposerHandleBeforeCursor,
  searchQueryWithHandle,
  searchTermForQuery,
} from "../../src/searchComposer";
import type { PromptDefinition } from "../../src/types";

function prompt(id: string): PromptDefinition {
  return {
    id,
    title: id,
    description: "",
    prompt: `Run ${id}`,
  };
}

function context(id: string): PromptDefinition {
  return {
    ...prompt(id),
    artifact_type: "context",
    prompt: `Context ${id}`,
  };
}

function skill(id: string): PromptDefinition {
  return {
    ...prompt(id),
    artifact_type: "skill",
    prompt: `---\nname: ${id}\ndescription: Skill ${id}\n---\n\nUse ${id}.`,
  };
}

describe("search composer", () => {
  test("splits canonical handles by namespace", () => {
    expect(promptArtifactHandle("review")).toBe("#review");
    expect(contextArtifactHandle("repo-policy")).toBe("@repo-policy");
    expect(skillArtifactHandle("diagnose")).toBe("$diagnose");
    expect(launcherCommandHandle("review")).toBe("/review");
    expect(canonicalArtifactHandle(prompt("review"))).toBe("#review");
    expect(canonicalArtifactHandle(context("repo-policy"))).toBe("@repo-policy");
    expect(canonicalArtifactHandle(skill("diagnose"))).toBe("$diagnose");
  });

  test("parses prompt, context, and skill handles", () => {
    const parsed = parseSearchComposerQuery("#review @repo-policy @ticket $diagnose");

    expect(parsed.promptId).toBe("review");
    expect(parsed.commandId).toBeNull();
    expect(parsed.contextIds).toEqual(["repo-policy", "ticket"]);
    expect(parsed.tokens.map((token) => token.kind)).toEqual([
      "prompt",
      "context",
      "context",
      "skill",
    ]);
    expect(parsed.activeToken).toBe("$diagnose");
  });

  test("parses slash tokens as commands only", () => {
    const parsed = parseSearchComposerQuery("/review @repo-policy");

    expect(parsed.promptId).toBeNull();
    expect(parsed.commandId).toBe("review");
    expect(parsed.tokens.map((token) => token.kind)).toEqual(["command", "context"]);
  });

  test("uses active hash, slash, at, or dollar tokens as the search term", () => {
    expect(searchTermForQuery("#rev")).toEqual({
      namespace: "prompt",
      artifactType: "prompt",
      term: "rev",
    });
    expect(searchTermForQuery("/rev")).toEqual({
      namespace: "command",
      artifactType: null,
      term: "rev",
    });
    expect(searchTermForQuery("#review @repo")).toEqual({
      namespace: "context",
      artifactType: "context",
      term: "repo",
    });
    expect(searchTermForQuery("$diag")).toEqual({
      namespace: "skill",
      artifactType: "skill",
      term: "diag",
    });
    expect(searchTermForQuery("#review ")).toBeNull();
  });

  test("adds handles while preserving one prompt and multiple contexts", () => {
    const query = searchQueryWithHandle("", prompt("review"));
    const withContext = searchQueryWithHandle(`${query} @repo`, context("repo-policy"));
    const replacedPrompt = searchQueryWithHandle(`${withContext} `, prompt("fix-tests"));

    expect(query).toBe("#review");
    expect(withContext).toBe("#review @repo-policy");
    expect(replacedPrompt).toBe("#fix-tests @repo-policy");
  });

  test("resolves only local context handles for composed prompts", () => {
    const now = Date.now();
    const library = [
      prompt("review"),
      { ...prompt("75ac6db"), scope: "ephemeral" as const },
      context("repo-policy"),
      {
        ...context("c001234"),
        scope: "ephemeral" as const,
        expires_at: now + 1000,
      },
      {
        ...context("89abcde"),
        scope: "ephemeral" as const,
        expires_at: now - 1000,
      },
      skill("diagnose"),
    ];

    expect(composerPrompt("#review @repo-policy @c001234 @89abcde @missing $diagnose", library)?.id).toBe("review");
    expect(composerPrompt("/review @repo-policy", library)).toBeNull();
    expect(composerPrompt("#75ac6db", library)).toBeNull();
    expect(composerContextIds("#review @repo-policy @c001234 @89abcde @missing $diagnose", library)).toEqual([
      "repo-policy",
      "c001234",
    ]);
    expect(removeSearchComposerHandle("#review @repo-policy", "@repo-policy")).toBe(
      "#review",
    );
  });

  test("finds the inserted handle before the cursor for token deletion", () => {
    expect(searchComposerHandleBeforeCursor("#review @repo-policy", 20))
      .toBe("@repo-policy");
    expect(searchComposerHandleBeforeCursor("#review @repo-policy ", 21))
      .toBe("@repo-policy");
    expect(searchComposerHandleBeforeCursor("#review free text", 17)).toBeNull();
    expect(searchComposerHandleBeforeCursor("#review @repo-policy", 8)).toBe("#review");
    expect(searchComposerHandleBeforeCursor("/review @repo-policy", 8)).toBe("/review");
  });
});
