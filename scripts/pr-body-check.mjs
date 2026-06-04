#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";

const TEMPLATE_PATHS = [
  ".github/pull_request_template.md",
  "../.github/pull_request_template.md",
];

function usage() {
  console.log(`Validates a PR description markdown file against the repository pull request template.

Usage:

    bun scripts/pr-body-check.mjs --file /path/to/pr_body.md`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--file") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("Missing value for --file");
      }
      options.file = value;
      index += 1;
      continue;
    }

    throw new Error(`Invalid option: ${arg}`);
  }

  return options;
}

function readTemplate() {
  for (const path of TEMPLATE_PATHS) {
    if (existsSync(path)) {
      return { path, content: readFileSync(path, "utf8") };
    }
  }

  throw new Error(`Unable to read PR template from any of: ${TEMPLATE_PATHS.join(", ")}`);
}

function readRequiredFile(path) {
  if (!existsSync(path)) {
    throw new Error(`Unable to read ${path}`);
  }

  return readFileSync(path, "utf8");
}

function normalizeMarkdown(value) {
  return value.replaceAll("\r\n", "\n");
}

function extractTemplateHeadings(template, templatePath) {
  const headings = template.match(/^#{4,6}\s+.+$/gm) ?? [];

  if (headings.length === 0) {
    throw new Error(`No markdown headings found in ${templatePath}`);
  }

  return headings;
}

function headingPosition(body, heading) {
  return body.indexOf(heading);
}

function headingsAfter(currentHeading, headings) {
  return headings.filter((heading) => heading !== currentHeading);
}

function captureHeadingSection(document, heading, headings) {
  const headingIndex = document.indexOf(heading);

  if (headingIndex === -1) {
    return null;
  }

  const sectionStart = headingIndex + heading.length;
  if (document.slice(sectionStart, sectionStart + 2) !== "\n\n") {
    return "";
  }

  const contentStart = sectionStart + 2;
  const content = document.slice(contentStart);
  const nextHeadingIndexes = headingsAfter(heading, headings)
    .map((nextHeading) => content.indexOf(`\n${nextHeading}`))
    .filter((index) => index !== -1);

  if (nextHeadingIndexes.length === 0) {
    return content;
  }

  return content.slice(0, Math.min(...nextHeadingIndexes));
}

function checkRequiredHeadings(errors, body, headings) {
  for (const heading of headings) {
    if (headingPosition(body, heading) === -1) {
      errors.push(`Missing required heading: ${heading}`);
    }
  }
}

function checkOrder(errors, body, headings) {
  const positions = headings
    .map((heading) => headingPosition(body, heading))
    .filter((position) => position !== -1);

  const sorted = [...positions].sort((left, right) => left - right);
  if (positions.some((position, index) => position !== sorted[index])) {
    errors.push("Required headings are out of order.");
  }
}

function checkNoPlaceholders(errors, body) {
  if (body.includes("<!--")) {
    errors.push("PR description still contains template placeholder comments (<!-- ... -->).");
  }
}

function maybeRequireBullets(errors, heading, templateSection, bodySection) {
  if (/^- /m.test(templateSection ?? "") && !/^- /m.test(bodySection)) {
    errors.push(`Section must include at least one bullet item: ${heading}`);
  }
}

function maybeRequireCheckboxes(errors, heading, templateSection, bodySection) {
  if (/^- \[ \] /m.test(templateSection ?? "") && !/^- \[[ xX]\] /m.test(bodySection)) {
    errors.push(`Section must include at least one checkbox item: ${heading}`);
  }
}

function checkSectionsFromTemplate(errors, template, body, headings) {
  for (const heading of headings) {
    const templateSection = captureHeadingSection(template, heading, headings);
    const bodySection = captureHeadingSection(body, heading, headings);

    if (bodySection === null) {
      continue;
    }

    if (bodySection.trim() === "") {
      errors.push(`Section cannot be empty: ${heading}`);
      continue;
    }

    maybeRequireBullets(errors, heading, templateSection, bodySection);
    maybeRequireCheckboxes(errors, heading, templateSection, bodySection);
  }
}

function lint(template, body, headings) {
  const errors = [];

  checkRequiredHeadings(errors, body, headings);
  checkOrder(errors, body, headings);
  checkNoPlaceholders(errors, body);
  checkSectionsFromTemplate(errors, template, body, headings);

  return errors;
}

function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    usage();
    return;
  }

  if (!options.file) {
    throw new Error("Missing required option --file");
  }

  const { path: templatePath, content: rawTemplate } = readTemplate();
  const template = normalizeMarkdown(rawTemplate);
  const body = normalizeMarkdown(readRequiredFile(options.file));
  const headings = extractTemplateHeadings(template, templatePath);
  const errors = lint(template, body, headings);

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR: ${error}`);
    }
    throw new Error(`PR body format invalid. Read \`${templatePath}\` and follow it precisely.`);
  }

  console.log("PR body format OK");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
