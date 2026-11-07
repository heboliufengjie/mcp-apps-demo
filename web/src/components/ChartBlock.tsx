import { useMemo } from "react";
import { TriangleAlert } from "lucide-react";
import type { ChartSpec } from "../types";
import { buildChartOption } from "../utils/chartOption";
import { EChart } from "./EChart";

function parseSpec(raw: string): ChartSpec | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return { error: "图表数据不是合法 JSON" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { error: "图表数据必须是 JSON 对象" };
  }

  const spec = parsed as Partial<ChartSpec>;
  if (!["bar", "line", "pie"].includes(String(spec.type))) {
    return { error: "type 必须是 bar、line 或 pie" };
  }
  if (!Array.isArray(spec.data) || spec.data.length === 0) {
    return { error: "data 必须是非空数组" };
  }

  return spec as ChartSpec;
}

export function ChartBlock({ raw }: { raw: string }) {
  const parsed = useMemo(() => parseSpec(raw), [raw]);
  const option = useMemo(
    () => ("error" in parsed ? null : buildChartOption(parsed)),
    [parsed],
  );

  if ("error" in parsed || !option) {
    return (
      <div className="chart-error" data-testid="chart-error">
        <TriangleAlert size={16} />
        <div>
          <strong>图表渲染失败</strong>
          <p>{"error" in parsed ? parsed.error : "未知错误"}</p>
          <pre>{raw}</pre>
        </div>
      </div>
    );
  }

  return (
    <figure className="chart-card" data-testid="chart-block">
      {parsed.title ? <figcaption>{parsed.title}</figcaption> : null}
      <EChart option={option} height={280} />
    </figure>
  );
}
