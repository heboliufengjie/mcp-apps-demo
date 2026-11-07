import type { FeatureFlags } from "../types";

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

const NUMBER_PATTERN = /-?\d[\d,]*(?:\.\d+)?/;

export interface ParsedNumber {
  value: number;
  unit: string;
  percent: boolean;
}

export function parseNumeric(raw: string): ParsedNumber | null {
  const text = raw.trim();
  if (!text) return null;

  const matched = text.replace(/\s/g, "").match(NUMBER_PATTERN);
  if (!matched) return null;

  let value = Number(matched[0].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;

  let multiplier = 1;
  let unit = "";
  if (text.includes("亿")) {
    multiplier = 1e8;
    unit = "亿";
  } else if (text.includes("万")) {
    multiplier = 1e4;
    unit = "万";
  } else if (/千|k/i.test(text) && !/kg|km/i.test(text)) {
    multiplier = 1e3;
    unit = "千";
  }

  value *= multiplier;
  const percent = text.includes("%") || text.includes("％");

  return { value, unit, percent };
}

export function detectFeatures(text: string): FeatureFlags {
  const ui = /```ui\b/i.test(text);
  const uiBlock = (type: string) =>
    ui && new RegExp(`"type"\\s*:\\s*"${type}"`).test(text);

  const table =
    (/^\s*\|.+\|\s*$/m.test(text) && /^\s*\|[\s:|-]+\|\s*$/m.test(text)) ||
    uiBlock("table");
  const chart = /```chart\b/i.test(text) || uiBlock("chart");
  const formula = /\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\(|\\\[/.test(text);
  const code =
    (/```[\w-]*\n[\s\S]*?```/.test(text) &&
      !/```(?:chart|ui)\b/i.test(text)) ||
    uiBlock("code");
  return { table, chart, formula, code, ui };
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

export function compressImage(file: File, maxWidth = 1500): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxWidth / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("无法创建画布"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片读取失败"));
    };
    image.src = url;
  });
}
