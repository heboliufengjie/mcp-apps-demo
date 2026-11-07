export type Role = "user" | "assistant";

export type Effort = "low" | "high" | "max";

export interface Settings {
  apiKey: string;
  model: string;
  effort: Effort;
}

export interface SearchSource {
  title: string;
  url: string;
  snippet: string;
  summary?: string;
  site_name?: string | null;
  date?: string | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface FeatureFlags {
  table: boolean;
  chart: boolean;
  formula: boolean;
  code: boolean;
  ui: boolean;
}

export interface Comparison {
  officialText?: string;
  officialFeatures: FeatureFlags;
  note?: string;
  hasImage?: boolean;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  reasoning?: string;
  reasoningMs?: number;
  sources?: SearchSource[];
  usage?: Usage;
  model?: string;
  createdAt: number;
  status: "streaming" | "done" | "error";
  error?: string;
  comparison?: Comparison;
  variant?: "visualization";
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface ChartSpec {
  type: "bar" | "line" | "pie";
  title?: string;
  x?: string;
  y?: string;
  name?: string;
  value?: string;
  data: Array<Record<string, string | number>>;
  unit?: string;
}

export interface ServerConfig {
  hasServerKey: boolean;
  mock: boolean;
}
