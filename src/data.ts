export type Period = "month" | "quarter" | "year";

export interface RegionRow {
  region: string;
  revenue: number;
  orders: number;
  growth: number;
}

export interface SalesPayload {
  period: Period;
  label: string;
  currency: "CNY";
  totalRevenue: number;
  orders: number;
  growth: number;
  updatedAt: string;
  rows: RegionRow[];
}

const BASE_ROWS: RegionRow[] = [
  { region: "华东", revenue: 962000, orders: 6120, growth: 15.2 },
  { region: "华南", revenue: 734000, orders: 4880, growth: 9.8 },
  { region: "华北", revenue: 605000, orders: 3950, growth: 11.1 },
  { region: "西南", revenue: 343000, orders: 2210, growth: 6.4 },
  { region: "其他", revenue: 220000, orders: 1260, growth: 3.1 },
];

const PERIOD_META: Record<Period, { label: string; multiplier: number; growth: number }> = {
  month: { label: "本月", multiplier: 1, growth: 12.4 },
  quarter: { label: "本季度", multiplier: 3, growth: 10.7 },
  year: { label: "本年", multiplier: 12, growth: 14.9 },
};

export function getSales(period: Period): SalesPayload {
  const meta = PERIOD_META[period];
  const rows = BASE_ROWS.map((row) => ({
    ...row,
    revenue: row.revenue * meta.multiplier,
    orders: row.orders * meta.multiplier,
  }));

  return {
    period,
    label: meta.label,
    currency: "CNY",
    totalRevenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    orders: rows.reduce((sum, row) => sum + row.orders, 0),
    growth: meta.growth,
    updatedAt: new Date().toISOString(),
    rows,
  };
}
