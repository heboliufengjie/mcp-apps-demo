import { useState } from "react";
import {
  Check,
  Copy,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { ChatMessage } from "../types";
import { formatTime } from "../utils/format";
import { Logo } from "./Logo";
import { Markdown } from "./Markdown";
import { Reasoning } from "./Reasoning";
import { Sources } from "./Sources";

interface Props {
  message: ChatMessage;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onVisualize: () => void;
}

export function MessageItem({
  message,
  canRegenerate,
  onRegenerate,
  onVisualize,
}: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Ignore clipboard failures.
    }
  };

  if (message.role === "user") {
    return (
      <article className="message user" data-testid="user-message">
        <div className="user-bubble">{message.content}</div>
        <time>{formatTime(message.createdAt)}</time>
      </article>
    );
  }

  return (
    <article
      className="message assistant"
      data-testid="assistant-message"
      data-status={message.status}
      data-message-id={message.id}
    >
      <header className="assistant-head">
        <Logo size={20} />
        <span className="assistant-name">DeepSeek</span>
        {message.model ? (
          <span className="model-tag">{message.model}</span>
        ) : null}
        {message.variant === "visualization" ? (
          <span className="model-tag">可视化版本</span>
        ) : null}
        <time>{formatTime(message.createdAt)}</time>
      </header>

      <Reasoning
        text={message.reasoning ?? ""}
        streaming={message.status === "streaming" && !message.content}
        durationMs={message.reasoningMs}
      />

      {message.content ? (
        <Markdown content={message.content} />
      ) : message.status === "streaming" ? (
        <div className="thinking-placeholder">
          <span />
          <span />
          <span />
          正在生成回答…
        </div>
      ) : null}

      {message.status === "streaming" && message.content ? (
        <span className="streaming-cursor" aria-hidden="true" />
      ) : null}

      <Sources sources={message.sources ?? []} />

      {message.error ? (
        <div className="error-box" role="alert">
          <strong>请求失败</strong>
          <p>{message.error}</p>
        </div>
      ) : null}

      {message.status !== "streaming" ? (
        <div className="message-actions">
          <button type="button" onClick={copy} title="复制回答">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "已复制" : "复制"}
          </button>
          {canRegenerate ? (
            <button type="button" onClick={onRegenerate} title="重新生成">
              <RefreshCw size={14} />
              重新生成
            </button>
          ) : null}
          {message.content ? (
            <button
              type="button"
              onClick={onVisualize}
              title="让模型把这条回答重排成表格和图表"
            >
              <Sparkles size={14} />
              可视化
            </button>
          ) : null}
          {message.usage ? (
            <span className="usage">
              {message.usage.total_tokens.toLocaleString()} tokens
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
