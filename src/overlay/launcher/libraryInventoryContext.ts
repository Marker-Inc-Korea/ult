import type { PromptPaletteRuntime } from "../../paletteRuntime";
import { BASE_COMMANDS } from "./launcherCommandDefinitions";
import type { LibraryInventoryContext } from "./libraryInventoryTypes";

export function libraryInventoryContext(
  palette: PromptPaletteRuntime,
): LibraryInventoryContext {
  const recentUseByArtifactId = new Map<string, number>();
  for (const entry of palette.usageHistory) {
    if (!entry.prompt_id) continue;
    const previous = recentUseByArtifactId.get(entry.prompt_id) ?? 0;
    if (entry.timestamp_ms > previous) {
      recentUseByArtifactId.set(entry.prompt_id, entry.timestamp_ms);
    }
  }
  return {
    prompts: palette.prompts,
    promptById: new Map(palette.prompts.map((prompt) => [prompt.id, prompt])),
    recentUseByArtifactId,
    clearExpiredCommand: BASE_COMMANDS.find((command) =>
      command.id === "clear-expired-contexts"
    ) ?? null,
    openLibraryCommand: BASE_COMMANDS.find((command) =>
      command.id === "open-library"
    ) ?? null,
  };
}
