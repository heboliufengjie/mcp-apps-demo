import { readFileSync } from "node:fs";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer } from "@modelcontextprotocol/server";
import { RESOURCE_MIME_TYPE, registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";

export const CHAT_UI_URI = "ui://chat/visualization.html";
export const CHAT_TOOL_NAME = "render_chat_visualization";
const html = readFileSync(new URL("./widget/chat-visualization.html", import.meta.url), "utf8");
const blocksSchema = z.array(z.record(z.string(), z.unknown())).min(1).max(20);

export async function createMcpApp() {
  const server = new McpServer({ name: "chat-visualization-server", version: "1.0.0" });
  registerAppTool(server, CHAT_TOOL_NAME, {
    title: "聊天可视化卡片",
    description: "使用 MCP Apps 渲染模型给出的指标、图表、表格和卡片。",
    inputSchema: z.object({ blocks: blocksSchema }),
    outputSchema: z.object({ blocks: blocksSchema }),
    _meta: { ui: { resourceUri: CHAT_UI_URI } },
  }, async ({ blocks }) => ({
    content: [{ type: "text", text: `可视化内容：${blocks.length} 个组件` }],
    structuredContent: { blocks },
  }));
  registerAppResource(server, "聊天可视化卡片", CHAT_UI_URI, {
    description: "聊天消息内嵌卡片与图表",
    _meta: { ui: { csp: { resourceDomains: [], connectDomains: [] } } },
  }, async () => ({ contents: [{ uri: CHAT_UI_URI, mimeType: RESOURCE_MIME_TYPE, text: html }] }));

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "local-chat-host", version: "1.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client, close: async () => { await client.close(); await server.close(); } };
}
