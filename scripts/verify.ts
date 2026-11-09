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
  const result = await app.client.callTool({ name: CHAT_TOOL_NAME, arguments: { blocks: [{ type: "metrics", items: [{ label: "销售额", value: "286.4 万元" }] }] } });
  assert.equal((result.structuredContent as { blocks: unknown[] }).blocks.length, 1);
  console.log("PASS MCP Apps 工具、UI 资源与 structuredContent");
} finally { await app.close(); }

const server = await startServer({ port: 0, mock: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.fill("[data-testid=composer-input]", "用图表展示本月销售数据");
  await page.click("[data-testid=send-button]");
  await page.waitForSelector("[data-testid=assistant-message][data-status=done]", { timeout: 20000 });
  const frame = page.frameLocator('[data-testid="mcp-visualization"]');
  await frame.locator('html[data-rendered="true"]').waitFor({ state: "attached", timeout: 20000 });
  assert.equal(await frame.locator(".metric").count(), 3);
  assert.equal(await frame.locator(".chart svg").count(), 1);
  assert.equal(await frame.locator("tbody tr").count(), 5);
  assert.equal(await frame.locator(".callout").count(), 1);
  assert.equal(await page.locator('a[href="/mcp-demo"]').count(), 0);
  console.log("PASS 单入口聊天页通过 MCP Apps 渲染指标、图表、表格和卡片");
} finally { await browser.close(); await server.close(); }
