export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function truncate(text: string, length = 28) {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length)}…` : normalized;
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.max(1, Math.round(ms / 1000))} 秒`;
  return `${(ms / 1000).toFixed(1)} 秒`;
}

export function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dateGroup(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const start = date.getTime();

  if (start >= startOfToday) return "今天";
  if (start >= startOfYesterday) return "昨天";
  if (start >= startOfToday - 7 * 24 * 60 * 60 * 1000) return "7 天内";
  if (start >= startOfToday - 30 * 24 * 60 * 60 * 1000) return "30 天内";
  return "更早";
}

export function extractText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return extractText(props?.children);
  }
  return "";
}
