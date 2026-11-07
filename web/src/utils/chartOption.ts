import type { EChartsCoreOption } from "echarts/core";
import type { ChartSpec } from "../types";

const COLORS = ["#4d6bfe", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function formatWithUnit(value: number, unit?: string) {
  if (unit === "万") return `${(value / 1e4).toLocaleString("zh-CN")}万`;
  if (unit === "亿") return `${(value / 1e8).toLocaleString("zh-CN")}亿`;
  if (unit === "%") return `${value.toLocaleString("zh-CN")}%`;
  return `${value.toLocaleString("zh-CN")}${unit ?? ""}`;
}

export function buildChartOption(spec: ChartSpec): EChartsCoreOption {
  const unit = spec.unit;
  const baseText = { color: "#a3a3a3", fontSize: 12 };

  if (spec.type === "pie") {
    const nameKey = spec.name ?? "name";
    const valueKey = spec.value ?? "value";
    return {
      backgroundColor: "transparent",
      color: COLORS,
      tooltip: {
        trigger: "item",
        backgroundColor: "#1f1f1f",
        borderColor: "#3a3a3a",
        textStyle: { color: "#f2f2f2" },
        valueFormatter: (value: unknown) =>
          formatWithUnit(Number(value), unit),
      },
      legend: {
        bottom: 0,
        textStyle: baseText,
        itemWidth: 10,
        itemHeight: 10,
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "68%"],
          center: ["50%", "45%"],
          avoidLabelOverlap: true,
          itemStyle: {
            borderColor: "#212121",
            borderWidth: 2,
            borderRadius: 4,
          },
          label: {
            color: "#d4d4d4",
            fontSize: 12,
            formatter: "{b}\n{d}%",
          },
          labelLine: { lineStyle: { color: "#525252" } },
          data: spec.data.map((row) => ({
            name: String(row[nameKey]),
            value: Number(row[valueKey]),
          })),
        },
      ],
    };
  }

  const xKey = spec.x ?? Object.keys(spec.data[0] ?? {})[0] ?? "name";
  const yKey =
    spec.y ??
    Object.keys(spec.data[0] ?? {}).find((key) => typeof spec.data[0][key] === "number") ??
    "value";

  return {
    backgroundColor: "transparent",
    color: COLORS,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1f1f1f",
      borderColor: "#3a3a3a",
      textStyle: { color: "#f2f2f2" },
      valueFormatter: (value: unknown) => formatWithUnit(Number(value), unit),
    },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: "category",
      data: spec.data.map((row) => String(row[xKey])),
      axisLabel: baseText,
      axisLine: { lineStyle: { color: "#3a3a3a" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        ...baseText,
        formatter: (value: number) => formatWithUnit(value, unit),
      },
      splitLine: { lineStyle: { color: "#2e2e2e" } },
    },
    series: [
      {
        type: spec.type,
        data: spec.data.map((row) => Number(row[yKey])),
        smooth: spec.type === "line",
        symbolSize: 7,
        barMaxWidth: 42,
        itemStyle:
          spec.type === "bar"
            ? { borderRadius: [6, 6, 0, 0] }
            : { borderWidth: 2 },
        areaStyle:
          spec.type === "line"
            ? { color: "rgba(77, 107, 254, 0.12)" }
            : undefined,
      },
    ],
  };
}
