export type StarterPackMetadata = {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  reference: string | null;
  includes: string[];
  keywords: string[];
};

const STARTER_PACK_REPO = "https://github.com/taeha/ult-packs";

export const STARTER_PACKS: StarterPackMetadata[] = [
  {
    id: "agent-control",
    title: "Agent Control",
    description: "Pause, redirect, rescue, and summarize coding-agent sessions.",
    sourceUrl: STARTER_PACK_REPO,
    reference: "agent-control",
    includes: ["intervention prompts", "workflow commands", "session contexts"],
    keywords: ["agent", "control", "intervention", "rescue", "summarize"],
  },
  {
    id: "pr-review",
    title: "PR Review",
    description: "Review diffs, prepare PR notes, and check merge readiness.",
    sourceUrl: STARTER_PACK_REPO,
    reference: "pr-review",
    includes: ["review prompts", "PR description commands", "risk checklist contexts"],
    keywords: ["pr", "pull request", "review", "diff", "merge"],
  },
  {
    id: "debugging",
    title: "Debugging",
    description: "Triage failing tests, reproduce failures, and choose next diagnostics.",
    sourceUrl: STARTER_PACK_REPO,
    reference: "debugging",
    includes: ["failure triage prompts", "test-fix commands", "diagnostic contexts"],
    keywords: ["debug", "debugging", "test", "failure", "diagnose"],
  },
  {
    id: "planning",
    title: "Planning",
    description: "Turn vague work into scoped plans, TODOs, and reviewable steps.",
    sourceUrl: STARTER_PACK_REPO,
    reference: "planning",
    includes: ["planning prompts", "scope contexts", "TODO commands"],
    keywords: ["plan", "planning", "todo", "scope", "proposal"],
  },
  {
    id: "release-prep",
    title: "Release Prep",
    description: "Run release checks, summarize risk, and prepare handoff notes.",
    sourceUrl: STARTER_PACK_REPO,
    reference: "release-prep",
    includes: ["release prompts", "preflight contexts", "handoff commands"],
    keywords: ["release", "ship", "preflight", "handoff", "risk"],
  },
];

export function starterPackById(id: string | null | undefined) {
  return STARTER_PACKS.find((pack) => pack.id === id) ?? STARTER_PACKS[0];
}

export function starterPackSearchTerms() {
  return STARTER_PACKS.flatMap((pack) => [
    pack.title,
    pack.id,
    ...pack.keywords,
  ]);
}
