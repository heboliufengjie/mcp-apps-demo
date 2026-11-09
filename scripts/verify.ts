import assert from "node:assert/strict";
import { createMcpApp, CHAT_TOOL_NAME, CHAT_UI_URI } from "../src/server.js";
import { startServer } from "../src/main.js";
import { launchBrowser } from "./browser.js";
import { parseUiBlocks } from "../web/src/utils/parseUiBlocks.js";

assert.ok("blocks" in parseUiBlocks('{"blocks":[{"type":"table","rows":[["A",1]]}]}'));
assert.ok("blocks" in parseUiBlocks('{"blocks":[{"type":"table","rows":[["A",1]]}]'));
assert.ok("error" in parseUiBlocks('{"blocks":[{"type":"table","rows":[["A",1]]}]}}'));

const app = await createMcpApp();
try {
  const { tools } = await app.client.listTools();
  const tool = tools.find(item => item.name === CHAT_TOOL_NAME);
  assert.equal((tool?._meta?.ui as { resourceUri?: string })?.resourceUri, CHAT_UI_URI);
  const resource = await app.client.readResource({ uri: CHAT_UI_URI });
  assert.equal(resource.contents[0]?.mimeType, "text/html;profile=mcp-app");
  const result = await app.client.callTool({ name: CHAT_TOOL_NAME, arguments: { blocks: [{ type: "callout", text: "验证" }] } });
  assert.equal((result.structuredContent as { blocks: unknown[] }).blocks.length, 1);
  console.log("PASS MCP Apps 工具、UI 资源与 JSON 解析");
} finally { await app.close(); }

const server = await startServer({ port: 0 });
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.locator("[data-testid=empty-state]").waitFor();
  assert.equal(await page.locator('a[href="/mcp-demo"]').count(), 0);
  const config = await page.request.get(`${server.url}/api/config`);
  const data = await config.json() as Record<string, unknown>;
  assert.equal("mock" in data, false);
  const chat = await page.request.post(`${server.url}/api/chat`, { data: { messages: [] } });
  assert.equal(chat.status(), 401);
  console.log("PASS 单入口启动，无内置 Mock，缺少 Key 时拒绝聊天请求");
} finally { await browser.close(); await server.close(); }
