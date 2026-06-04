import {
  parseSearchComposerQuery,
  searchTermForQuery,
} from "../../searchComposer";
import type { LauncherSearchIntent } from "./launcherSearchTypes";

export function parseLauncherSearchIntent(query: string): LauncherSearchIntent {
  const trimmed = query.trim();
  const searchTerm = searchTermForQuery(trimmed);
  const composer = parseSearchComposerQuery(trimmed);
  const namespace = trimmed ? searchTerm?.namespace ?? "plain" : "home";
  return {
    query: trimmed,
    namespace,
    term: searchTerm?.term ?? "",
    commandTerm: commandSearchTermForQuery(trimmed),
    searchTerm,
    selectedContextIds: new Set(composer.contextIds),
    home: trimmed === "",
  };
}

function commandSearchTermForQuery(query: string) {
  const search = searchTermForQuery(query);
  if (search?.namespace === "command") return search.term.toLowerCase();
  return query
    .split(/\s+/)
    .filter((token) => !/^[#@$][A-Za-z0-9_-]*$/.test(token))
    .join(" ")
    .trim()
    .toLowerCase();
}
