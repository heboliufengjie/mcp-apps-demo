import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createMcpApp, TOOL_NAME, UI_URI } from "../src/server.js";
import { startServer } from "../src/main.js";
import { launchBrowser } from "./browser.js";

const results: string[] = [];

function pass(label: string, detail = "") {
  results.push(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title: string) {
  console.log(`\n${title}`);
}

async function verifyProtocol() {
  section("[1/2] MCP 协议层验证（内存传输）");
  const app = await createMcpApp();

  try {
    const { tools } = await app.client.listTools();
    const tool = tools.find((item) => item.name === TOOL_NAME);
    assert.ok(tool, `tools/list 中没有 ${TOOL_NAME}`);

    const uiMeta = tool._meta?.ui as { resourceUri?: string } | undefined;
    assert.equal(uiMeta?.resourceUri, UI_URI, "tools/list 的 _meta.ui.resourceUri");
    assert.equal(
      tool._meta?.["ui/resourceUri"],
      UI_URI,
      "兼容旧宿主的 _meta['ui/resourceUri']",
    );
    pass("tools/list 暴露 UI 资源声明", UI_URI);

    const { resources } = await app.client.listResources();
    assert.ok(
      resources.some((resource) => resource.uri === UI_URI),
      "resources/list 中没有 UI 资源",
    );
    pass("resources/list 包含 UI 资源");

    const read = await app.client.readResource({ uri: UI_URI });
    const html = read.contents[0];
    assert.equal(html?.mimeType, "text/html;profile=mcp-app", "资源 MIME 类型");
    const htmlText = html && "text" in html ? html.text : undefined;
    assert.ok(
      htmlText?.includes("sales-dashboard"),
      "资源内容不是看板 HTML",
    );
    pass("resources/read 返回 MCP App HTML", "text/html;profile=mcp-app");

    const call = await app.client.callTool({
      name: TOOL_NAME,
      arguments: { period: "month" },
    });
    const data = call.structuredContent as
      | { rows?: unknown[]; totalRevenue?: number; period?: string }
      | undefined;
    assert.equal(call.isError, undefined, "tools/call 返回错误");
    assert.equal(data?.period, "month");
    assert.equal(data?.rows?.length, 5, "structuredContent.rows 数量");
    assert.ok((data?.totalRevenue ?? 0) > 0, "structuredContent.totalRevenue");
    pass("tools/call 返回 structuredContent", `rows=${data?.rows?.length}`);
  } finally {
    await app.close();
  }
}

async function verifyRendering() {
  section("[2/2] 浏览器端渲染验证（官方 AppBridge + 沙箱 iframe）");
  const server = await startServer({ port: 0 });

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 960 },
    });

    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(`${server.url}/mcp-demo`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#run:not([disabled])", { timeout: 10_000 });

    const toolName = await page.textContent("#tool-name");
    const toolUri = await page.textContent("#tool-uri");
    assert.equal(toolName, TOOL_NAME);
    assert.equal(toolUri, UI_URI);
    pass("宿主发现 MCP App 工具", `${toolName} -> ${toolUri}`);

    await page.selectOption("#period", "month");
    await page.click("#run");

    await page.waitForFunction(
      () => window.__demo?.phase === "result-sent",
      undefined,
      { timeout: 20_000 },
    );
    pass("AppBridge 完成握手并发送 tool-input/tool-result");

    const frame = page.frameLocator("#app-frame");
    await frame.locator("#sales-table tbody tr").first().waitFor({
      state: "visible",
      timeout: 10_000,
    });

    const rowCount = await frame.locator("#sales-table tbody tr").count();
    const barCount = await frame.locator("#chart .bar").count();
    assert.equal(rowCount, 5, "表格行数");
    assert.equal(barCount, 5, "柱状图柱子数量");
    pass("表格渲染完成", `${rowCount} 行`);
    pass("柱状图渲染完成", `${barCount} 根柱子`);

    const revenue = await frame.locator("#stat-revenue").textContent();
    assert.ok(revenue && /\d/.test(revenue), "销售额没有渲染");
    pass("指标卡渲染完成", revenue.trim());

    const status = await frame.locator("#status").textContent();
    assert.match(status ?? "", /已渲染 5 行/);
    pass("UI 侧确认收到 tool-result 通知");

    const mime = await page.textContent("#resource-mime");
    assert.equal(mime, "text/html;profile=mcp-app");
    pass("宿主读取到正确 MIME", mime ?? "");

    await page.waitForTimeout(800);
    await mkdir("artifacts", { recursive: true });
    await page.screenshot({
      path: "artifacts/verify.png",
      fullPage: true,
    });
    pass("截图已保存", "artifacts/verify.png");

    if (consoleErrors.length > 0) {
      throw new Error(`浏览器控制台有错误：\n${consoleErrors.join("\n")}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

try {
  await verifyProtocol();
  await verifyRendering();
  console.log(`\n全部验证通过（${results.length} 项）`);
} catch (error) {
  console.error("\n验证失败：");
  console.error(error);
  process.exitCode = 1;
}
