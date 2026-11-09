export type UiParseResult =
  | { blocks: Record<string, unknown>[] }
  | { error: string };

function completeClosers(input: string): string | undefined {
  const stack: string[] = [];
  let quoted = false;
  let escaped = false;
  for (const char of input) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{" || char === "[") stack.push(char === "{" ? "}" : "]");
    else if (char === "}" || char === "]") {
      if (stack.pop() !== char) return undefined;
    }
  }
  if (quoted) return undefined;
  return input + stack.reverse().join("");
}

export function parseUiBlocks(raw: string): UiParseResult {
  const text = raw.trim().replace(/^```(?:json|ui)?\s*/i, "").replace(/```\s*$/i, "");
  const noTrailingCommas = text.replace(/,\s*([}\]])/g, "$1");
  const candidates = [text, noTrailingCommas, completeClosers(noTrailingCommas)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const data: unknown = JSON.parse(candidate);
      const blocks = Array.isArray(data) ? data : (data as { blocks?: unknown })?.blocks;
      if (Array.isArray(blocks) && blocks.length > 0 && blocks.every(item => item && typeof item === "object" && !Array.isArray(item))) {
        return { blocks: blocks as Record<string, unknown>[] };
      }
    } catch { /* Try a conservative repair. */ }
  }
  return { error: "ui 块不是合法的 blocks JSON" };
}
