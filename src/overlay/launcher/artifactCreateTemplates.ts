export type ArtifactCreateTemplateId =
  | "code-review"
  | "debug"
  | "implementation-plan"
  | "summary"
  | "scoped-task";

export type ArtifactCreateTemplate = {
  id: ArtifactCreateTemplateId;
  title: string;
  description: string;
  body: string;
};

export function artifactCreateTemplates(): ArtifactCreateTemplate[] {
  return [
    {
      id: "code-review",
      title: "Code Review",
      description: "Find correctness issues, regressions, and missing tests.",
      body: [
        "Review the current change as if it came from someone else.",
        "",
        "Focus on correctness, regressions, missing tests, and the smallest viable fix. Report findings first, then validation and residual risk.",
      ].join("\n"),
    },
    {
      id: "debug",
      title: "Debug",
      description: "Diagnose a failure before changing code.",
      body: [
        "Diagnose the failure before changing code.",
        "",
        "State the observed symptom, list likely causes, inspect the relevant logs or tests, then propose the smallest fix. Do not patch until the hypothesis is clear.",
      ].join("\n"),
    },
    {
      id: "implementation-plan",
      title: "Implementation Plan",
      description: "Plan the smallest safe patch before editing.",
      body: [
        "Create a short implementation plan for the requested change.",
        "",
        "Identify files to inspect, the smallest safe patch, tests to run, and any privacy or product-contract risks before editing.",
      ].join("\n"),
    },
    {
      id: "summary",
      title: "Summary",
      description: "Prepare a concise handoff summary.",
      body: [
        "Summarize the current work for handoff.",
        "",
        "Include what changed, validation run, known gaps, and the next concrete step.",
      ].join("\n"),
    },
    {
      id: "scoped-task",
      title: "Scoped Task",
      description: "Keep the agent constrained to the requested task.",
      body: [
        "Complete only the requested task.",
        "",
        "Keep changes narrowly scoped, avoid unrelated refactors, preserve existing behavior, and stop if the request requires reading or writing data outside the explicit flow.",
      ].join("\n"),
    },
  ];
}
