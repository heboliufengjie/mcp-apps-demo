import { SYSTEM_PROMPT } from "./constants";
import type {
  SearchSource,
  ServerConfig,
  Settings,
  Usage,
} from "./types";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface StreamOptions {
  settings: Settings;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  thinking: boolean;
  sources: SearchSource[];
  signal: AbortSignal;
  onDelta: (delta: { content?: string; reasoning?: string }) => void;
  onUsage?: (usage: Usage) => void;
}

function apiHeaders(settings: Settings) {
  return {
    "content-type": "application/json",
    "x-deepseek-key": settings.apiKey,
  };
}

async function readError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string } | string;
      message?: string;
    };
    if (typeof parsed.error === "string") return parsed.error;
    return parsed.error?.message ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

function buildSearchContext(sources: SearchSource[]) {
  const blocks = sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.title}\nURL: ${source.url}\n摘要: ${
          source.summary || source.snippet
        }`,
    )
    .join("\n\n");

  return `以下是 DeepSeek 搜索接口返回的实时网页结果，请优先参考。引用时在句末使用 [1]、[2] 这样的角标。若结果与问题无关，请忽略并说明。\n\n${blocks}`;
}

export async function streamChat({
  settings,
  history,
  thinking,
  sources,
  signal,
  onDelta,
  onUsage,
}: StreamOptions) {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (sources.length > 0) {
    messages.push({ role: "system", content: buildSearchContext(sources) });
  }

  const trimmed = history.filter((item) => item.content.trim()).slice(-40);
  messages.push(...trimmed);

  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    thinking: { type: thinking ? "enabled" : "disabled" },
  };

  if (thinking) {
    body.reasoning_effort = settings.effort;
  }

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: apiHeaders(settings),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  if (!response.body) throw new ApiError("服务端没有返回流式内容");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleEvent = (event: string) => {
    for (const line of event.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      let payload: {
        choices?: Array<{
          delta?: { content?: string; reasoning_content?: string };
          finish_reason?: string | null;
        }>;
        usage?: Usage | null;
      };
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }

      const delta = payload.choices?.[0]?.delta;
      if (delta?.reasoning_content) onDelta({ reasoning: delta.reasoning_content });
      if (delta?.content) onDelta({ content: delta.content });
      if (payload.usage) onUsage?.(payload.usage);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? "";
    for (const event of events) handleEvent(event);
  }

  buffer += decoder.decode();
  if (buffer.trim()) handleEvent(buffer);
}

export async function searchWeb(
  query: string,
  settings: Settings,
  signal?: AbortSignal,
): Promise<SearchSource[]> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: apiHeaders(settings),
    body: JSON.stringify({ query, count: 6, need_content: false }),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  const data = (await response.json()) as { results?: SearchSource[] };
  return Array.isArray(data.results) ? data.results : [];
}

export async function testConnection(settings: Settings) {
  const response = await fetch("/api/models", {
    headers: apiHeaders(settings),
  });

  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }

  const data = (await response.json()) as {
    data?: Array<{ id: string }>;
  };
  return (data.data ?? []).map((model) => model.id);
}

export async function fetchServerConfig(): Promise<ServerConfig> {
  try {
    const response = await fetch("/api/config");
    if (!response.ok) return { hasServerKey: false };
    return (await response.json()) as ServerConfig;
  } catch {
    return { hasServerKey: false };
  }
}
