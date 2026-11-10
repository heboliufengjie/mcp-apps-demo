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
  const widgetHtml = resource.contents[0] && "text" in resource.contents[0] ? resource.contents[0].text : "";
  assert.match(widgetHtml, /<script>/);
  assert.doesNotMatch(widgetHtml, /WIDGET_SCRIPT|\/vendor\/app-with-deps\.js/);
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

  const now = Date.now();
  const conversations = [
    { id: "visual", title: "可视化会话", createdAt: now, updatedAt: now,
      messages: [{ id: "visual-message", role: "assistant", status: "done", createdAt: now,
        content: '```ui\n{"blocks":[{"type":"callout","text":"缓存验证"}]}\n```' }] },
    { id: "plain", title: "普通会话", createdAt: now - 1, updatedAt: now - 1,
      messages: [{ id: "plain-message", role: "assistant", status: "done", createdAt: now - 1,
        content: "普通消息" }] },
  ];
  await page.evaluate((items) => {
    localStorage.setItem("deepseek-compare.conversations.v1", JSON.stringify(items));
    localStorage.setItem("deepseek-compare.active.v1", "visual");
  }, conversations);
  const requests = { tools: 0, call: 0, read: 0 };
  page.on("request", (request) => {
    const name = new URL(request.url()).pathname.slice(5);
    if (name in requests) requests[name as keyof typeof requests]++;
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.frameLocator("[data-testid=mcp-visualization]").getByText("缓存验证").waitFor({ state: "attached" });
  assert.deepEqual(requests, { tools: 1, call: 1, read: 1 });
  await page.getByRole("button", { name: "普通会话" }).click();
  await page.getByRole("button", { name: "可视化会话" }).click();
  await page.frameLocator("[data-testid=mcp-visualization]").getByText("缓存验证").waitFor({ state: "attached" });
  assert.deepEqual(requests, { tools: 1, call: 1, read: 1 });
  console.log("PASS 历史会话切换复用 MCP 工具结果和 UI 资源");
} finally { await browser.close(); await server.close(); }
