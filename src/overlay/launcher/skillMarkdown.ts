export function skillMarkdownBody(markdown: string) {
  if (!markdown.startsWith("---\n")) return markdown;
  const rest = markdown.slice("---\n".length);
  const end = rest.indexOf("\n---");
  if (end < 0) return markdown;
  return rest.slice(end + "\n---".length).replace(/^\r?\n/, "");
}
