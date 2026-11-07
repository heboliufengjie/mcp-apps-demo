import { readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import { getSales } from "./data.js";

export const UI_URI = "ui://sales/dashboard.html";
export const TOOL_NAME = "sales_dashboard";

const widgetHtml = readFileSync(
  new URL("./widget/dashboard.html", import.meta.url),
  "utf8",
);

const periodSchema = z.enum(["month", "quarter", "year"]);

const outputSchema = z.object({
  period: periodSchema,
  label: z.string(),
  currency: z.literal("CNY"),
  totalRevenue: z.number(),
  orders: z.number(),
  growth: z.number(),
  updatedAt: z.string(),
  rows: z.array(
    z.object({
      region: z.string(),
      revenue: z.number(),
      orders: z.number(),
      growth: z.number(),
    }),
  ),
});

export async function createMcpApp() {
  const server = new McpServer({ name: "sales-mcp-server", version: "0.1.0" });

  registerAppTool(
    server,
    TOOL_NAME,
    {
      title: "销售数据看板",
      description:
        "返回按区域拆分的销售数据，并在支持 MCP Apps 的宿主中渲染为表格与柱状图。",
      inputSchema: z.object({
        period: periodSchema.default("month").describe("统计周期"),
      }),
      outputSchema,
      _meta: {
        ui: { resourceUri: UI_URI },
      },
    },
    async ({ period }) => {
      const payload = getSales(period);
      return {
        content: [
          { type: "text", text: JSON.stringify(payload, null, 2) },
        ],
        structuredContent: { ...payload },
      };
    },
  );

  registerAppResource(
    server,
    "销售数据看板",
    UI_URI,
    {
      description: "销售数据看板的 HTML 界面（MCP Apps）",
      _meta: {
        ui: {
          csp: { resourceDomains: [], connectDomains: [] },
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: UI_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
        },
      ],
    }),
  );

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({ name: "local-host-bridge", version: "0.1.0" });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  return {
    server,
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}
