import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import type { ChartSpec } from "../types";
import { ChartBlock } from "./ChartBlock";

type Tone = "up" | "down" | "neutral";
type CalloutTone = "info" | "success" | "warn" | "danger";

interface BlockRecord {
  type?: string;
  [key: string]: unknown;
}

function parseJson(raw: string): unknown {
  const text = raw
    .trim()
    .replace(/^```(?:json|ui)?\s*/i, "")
    .replace(/```\s*$/i, "");

  const attempts = [
    text,
    text.replace(/,\s*([}\]])/g, "$1"),
    text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1),
  ];

  for (const attempt of attempts) {
    if (!attempt.trim()) continue;
    try {
      return JSON.parse(attempt);
    } catch {
      // Try the next repair strategy.
    }
  }

  return undefined;
}

function parse(raw: string): { blocks: BlockRecord[] } | { error: string } {
  const data = parseJson(raw);
  if (data === undefined) {
    return { error: "ui 块不是合法 JSON" };
  }

  const blocks = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { blocks?: unknown }).blocks)
      ? (data as { blocks: unknown[] }).blocks
      : null;

  if (!blocks || blocks.length === 0) {
    return { error: "ui 块缺少 blocks 数组" };
  }

  return {
    blocks: blocks.filter(
      (block): block is BlockRecord =>
        Boolean(block) && typeof block === "object" && !Array.isArray(block),
    ),
  };
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function MetricsBlock({ block }: { block: BlockRecord }) {
  const items = asArray<Record<string, unknown>>(block.items);
  if (items.length === 0) return null;

  return (
    <div className="ui-metrics" data-testid="ui-metrics">
      {items.map((item, index) => {
        const tone = asString(item.tone) as Tone;
        return (
          <article className="ui-metric" key={index}>
            <span>{asString(item.label)}</span>
            <strong>{asString(item.value)}</strong>
            {item.delta ? (
              <small className={`tone-${tone || "neutral"}`}>
                {asString(item.delta)}
              </small>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ChartBlockView({ block }: { block: BlockRecord }) {
  const chart = (block.chart ?? block) as ChartSpec;
  if (
    !chart ||
    !Array.isArray(chart.data) ||
    chart.data.length === 0 ||
    !["bar", "line", "pie"].includes(String(chart.type))
  ) {
    return <UIBlockError message="chart 块缺少合法的 type 或 data" />;
  }

  return (
    <div className="ui-chart" data-testid="ui-chart">
      <ChartBlock raw={JSON.stringify(chart)} />
    </div>
  );
}

function TableBlockView({ block }: { block: BlockRecord }) {
  const columns = asArray<unknown>(block.columns).map((item) =>
    asString(item),
  );
  const rows = asArray<unknown[]>(block.rows);
  if (columns.length === 0 || rows.length === 0) {
    return <UIBlockError message="table 块缺少 columns 或 rows" />;
  }

  return (
    <section className="ui-table-block" data-testid="ui-table">
      {block.title ? <h4>{asString(block.title)}</h4> : null}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{asString(cell, String(cell ?? ""))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CalloutBlock({ block }: { block: BlockRecord }) {
  const tone = (asString(block.tone, "info") as CalloutTone) || "info";
  return (
    <aside className={`ui-callout tone-${tone}`} data-testid="ui-callout">
      {block.title ? <strong>{asString(block.title)}</strong> : null}
      <p>{asString(block.text)}</p>
    </aside>
  );
}

function TimelineBlock({ block }: { block: BlockRecord }) {
  const items = asArray<Record<string, unknown>>(block.items);
  if (items.length === 0) return null;

  return (
    <ol className="ui-timeline" data-testid="ui-timeline">
      {items.map((item, index) => (
        <li key={index}>
          <span className="timeline-dot" />
          <div>
            <strong>{asString(item.title)}</strong>
            {item.date ? <time>{asString(item.date)}</time> : null}
            {item.description ? <p>{asString(item.description)}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function CompareBlock({ block }: { block: BlockRecord }) {
  const left = (block.left ?? {}) as Record<string, unknown>;
  const right = (block.right ?? {}) as Record<string, unknown>;
  const sides = [
    { side: "left", data: left },
    { side: "right", data: right },
  ] as const;

  return (
    <div className="ui-compare" data-testid="ui-compare">
      {sides.map(({ side, data }) => (
        <section key={side} className={side}>
          <h4>{asString(data.title, side === "left" ? "左侧" : "右侧")}</h4>
          <ul>
            {asArray<unknown>(data.items).map((item, index) => (
              <li key={index}>{asString(item)}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function CodeBlockView({ block }: { block: BlockRecord }) {
  const code = asString(block.code);
  if (!code) return <UIBlockError message="code 块缺少 code 字段" />;

  return (
    <div className="code-block" data-testid="ui-code">
      <div className="code-head">
        <span>{asString(block.language, "text")}</span>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function UIBlockError({ message }: { message: string }) {
  return (
    <div className="chart-error">
      <TriangleAlert size={16} />
      <div>
        <strong>UI 组件渲染失败</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function renderBlock(block: BlockRecord, index: number) {
  switch (block.type) {
    case "metrics":
      return <MetricsBlock key={index} block={block} />;
    case "chart":
      return <ChartBlockView key={index} block={block} />;
    case "table":
      return <TableBlockView key={index} block={block} />;
    case "callout":
      return <CalloutBlock key={index} block={block} />;
    case "timeline":
      return <TimelineBlock key={index} block={block} />;
    case "compare":
      return <CompareBlock key={index} block={block} />;
    case "code":
      return <CodeBlockView key={index} block={block} />;
    case "divider":
      return <hr key={index} className="ui-divider" />;
    default:
      return (
        <UIBlockError key={index} message={`未知组件：${asString(block.type)}`} />
      );
  }
}

export function GenerativeUI({ raw }: { raw: string }) {
  const parsed = useMemo(() => parse(raw), [raw]);

  if ("error" in parsed) {
    return (
      <div className="chart-error" data-testid="ui-error">
        <TriangleAlert size={16} />
        <div>
          <strong>生成式 UI 解析失败</strong>
          <p>{parsed.error}</p>
          <pre>{raw}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="generative-ui" data-testid="generative-ui">
      {parsed.blocks.map(renderBlock)}
    </div>
  );
}
