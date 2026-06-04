import { existsSync, readdirSync, readFileSync } from "fs";

export type NativeCall = {
  command: string;
  payload?: Record<string, unknown>;
};

export function readText(path: string) {
  return readFileSync(path, "utf8");
}

export function readOptionalText(path: string) {
  return existsSync(path) ? readText(path) : null;
}

export function readJson<T>(path: string) {
  return JSON.parse(readText(path)) as T;
}

export function readSources(paths: string[]) {
  return paths.map((path) => readText(path)).join("\n");
}

export type TauriCapability = {
  identifier: string;
  windows?: string[];
  permissions?: string[];
};

export function readTauriCapabilities() {
  return readdirSync("src-tauri/capabilities")
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => readJson<TauriCapability>(`src-tauri/capabilities/${file}`));
}

export function tauriCapabilityWindows() {
  return uniqueSorted(
    readTauriCapabilities().flatMap((capability) => capability.windows ?? []),
  );
}

export function tauriCapabilityPermissions() {
  return uniqueSorted(
    readTauriCapabilities().flatMap((capability) => capability.permissions ?? []),
  );
}

export function promptCommandSourcePaths() {
  const promptCommandDir = "src-tauri/src/commands/prompt_commands";
  return [
    "src-tauri/src/commands/prompt_commands.rs",
    ...readdirSync(promptCommandDir)
      .filter((file) => file.endsWith(".rs"))
      .sort()
      .map((file) => `${promptCommandDir}/${file}`),
  ];
}

export function rustCommandSourcePaths() {
  return [
    "src-tauri/src/commands.rs",
    "src-tauri/src/commands/delivery_commands.rs",
    "src-tauri/src/commands/diagnostics_commands.rs",
    "src-tauri/src/commands/meta_prompting_commands.rs",
    ...promptCommandSourcePaths(),
    "src-tauri/src/commands/settings_commands.rs",
  ];
}

export function readPromptCommandSources() {
  return readSources(promptCommandSourcePaths());
}

export function nativeInvokeCommandNames() {
  return uniqueSorted(
    [...readText("src/native.ts").matchAll(/invokeNative(?:<[^>]+>)?\(\s*"([^"]+)"/g)]
      .map((match) => match[1]),
  );
}

export function rustInvokeHandlerCommandNames() {
  const source = readText("src-tauri/src/lib.rs");
  const match = source.match(/tauri::generate_handler!\[([\s\S]*?)\]/);
  if (!match) {
    throw new Error("Could not find Tauri generate_handler command list.");
  }
  return uniqueSorted(
    match[1]
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function rustCommandParameters() {
  const sources = readSources(rustCommandSourcePaths());
  const signatures = new Map<string, string[]>();
  const commandRegex =
    /#\[tauri::command\]\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)(?:<[^)]*?>)?\s*\(([\s\S]*?)\)\s*(?:->|\{)/g;
  const infrastructureParams = new Set(["app", "state", "window"]);

  for (const match of sources.matchAll(commandRegex)) {
    const [, commandName, paramsSource] = match;
    const userParams = splitTopLevel(paramsSource)
      .map((param) => param.trim())
      .filter(Boolean)
      .map((param) => param.replace(/^#\[[^\]]+\]\s*/, ""))
      .map((param) => param.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/)?.[1] ?? null)
      .filter((param): param is string => Boolean(param))
      .filter((param) => !infrastructureParams.has(param));
    signatures.set(commandName, userParams);
  }

  return signatures;
}

export function rustConstString(path: string, constName: string) {
  const source = readText(path);
  const match = source.match(
    new RegExp(`pub\\s+const\\s+${constName}\\s*:\\s*&str\\s*=\\s*"([^"]*)"`, "m"),
  );
  if (!match) {
    throw new Error(`Could not find Rust string const ${constName} in ${path}.`);
  }
  return match[1];
}

export function rustEnumVariants(path: string, enumName: string) {
  const source = readText(path);
  const match = source.match(
    new RegExp(`(?:pub\\s+)?enum\\s+${enumName}\\s*{([\\s\\S]*?)}`, "m"),
  );
  if (!match) {
    throw new Error(`Could not find Rust enum ${enumName} in ${path}.`);
  }
  return match[1]
    .split(",")
    .map((entry) => entry.replace(/#\[[\s\S]*?\]/g, "").trim())
    .filter(Boolean)
    .map((entry) => entry.match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1])
    .filter((variant): variant is string => Boolean(variant));
}

export function rustFunctionBody(path: string, functionName: string) {
  const source = readText(path);
  const functionStart = source.search(
    new RegExp(`(?:pub(?:\\([^)]*\\))?\\s+)?(?:async\\s+)?fn\\s+${functionName}(?:<[^)]*?>)?\\s*\\(`),
  );
  if (functionStart < 0) {
    throw new Error(`Could not find Rust function ${functionName} in ${path}.`);
  }
  const bodyStart = source.indexOf("{", functionStart);
  if (bodyStart < 0) {
    throw new Error(`Could not find body for Rust function ${functionName} in ${path}.`);
  }

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart + 1, index);
    }
  }

  throw new Error(`Could not parse body for Rust function ${functionName} in ${path}.`);
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort();
}

function splitTopLevel(source: string) {
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of source) {
    if (char === "<" || char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ">" || char === ")" || char === "]" || char === "}") {
      depth = Math.max(0, depth - 1);
    }

    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current);
  }

  return parts;
}
