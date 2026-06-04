export type ExternalSkillDiscoveryIntent =
  | "discover"
  | "find"
  | "install";

export type ExternalSkillDiscoverySource = {
  id: string;
  title: string;
  description: string;
  source: string;
  packageIdentity: string;
  installLocation: string;
  trustStatus: string;
  exactCommand: string;
  badges: string[];
};

export const EXTERNAL_SKILL_DISCOVERY_SOURCES: ExternalSkillDiscoverySource[] = [
  {
    id: "skills-sh",
    title: "skills.sh",
    description: "External agent skills directory.",
    source: "https://www.skills.sh/",
    packageIdentity: "GitHub owner/repo listed by the directory.",
    installLocation: "No local write in Ult until a GitHub import preview imports selected packages.",
    trustStatus: "External source. Review package source and audit status per package.",
    exactCommand: "npx skills add <owner/repo> (not run by Ult)",
    badges: ["external", "directory"],
  },
  {
    id: "github-import-preview",
    title: "GitHub Import Preview",
    description: "Ult preview gate for a user-selected repository.",
    source: "https://github.com/<owner>/<repo>",
    packageIdentity: "Recognized persistent/skills/*/SKILL.md packages.",
    installLocation: "~/.ult/personal-library/persistent/skills/<handle>/SKILL.md",
    trustStatus: "Preview shows recognized, ignored, and malformed files before import.",
    exactCommand: "Preview GitHub Pack -> Import Selected Packages",
    badges: ["local gate", "preview"],
  },
];

export function externalSkillDiscoveryTitle(intent: ExternalSkillDiscoveryIntent) {
  if (intent === "find") return "Find Agent Skills";
  if (intent === "install") return "Install Agent Skill";
  return "Discover Skills";
}

export function externalSkillDiscoverySummary(intent: ExternalSkillDiscoveryIntent) {
  if (intent === "install") {
    return "External install stays behind source review, GitHub preview, and explicit local import.";
  }
  if (intent === "find") {
    return "External search starts from source identity and package review, not local project scanning.";
  }
  return "External discovery is metadata-only until a selected repository is previewed.";
}

export function externalSkillDiscoverySearchTerms() {
  return [
    "skills.sh",
    "agent skills",
    "external skills",
    "discover skills",
    "find skills",
    "install agent skill",
    "skill directory",
  ];
}
