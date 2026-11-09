import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { startServer } from "../src/main.js";
import { launchBrowser } from "./browser.js";

function pass(label: string, detail = "") {
  console.log(`  ✔ ${label}${detail ? ` — ${detail}` : ""}`);
}

const server = await startServer({ port: 0, mock: true });
const browser = await launchBrowser();

try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`${message.location().url}: ${message.text()}`);
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem(
      "deepseek-compare.settings.v1",
      JSON.stringify({
        apiKey: "mock-key",
        model: "deepseek-flash",
        effort: "high",
      }),
    );
  });

  await page.goto(server.url, { waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=empty-state]");
  pass("空状态与侧边栏加载");

  await page.getByRole("button", { name: "智能搜索" }).click();
  await page.fill(
    "[data-testid=composer-input]",
    "用表格和图表展示本月各区域销售数据",
  );
  await page.click("[data-testid=send-button]");

  await page.waitForSelector(
    "[data-testid=assistant-message][data-status=done]",
    { timeout: 20_000 },
  );
  pass("流式回答完成", "mock SSE");

  const generativeUi = page.locator("[data-testid=mcp-visualization]");
  assert.equal(await generativeUi.count(), 1, "MCP App 数量");
  const uiFrame = page.frameLocator("[data-testid=mcp-visualization]");
  await uiFrame.locator('html[data-rendered="true"]').waitFor({ state: "attached", timeout: 20_000 });
  assert.equal(
    await uiFrame.locator(".metric").count(),
    3,
    "指标卡数量",
  );
  assert.equal(
    await uiFrame.locator(".chart svg").count(),
    1,
    "生成式图表数量",
  );
  assert.equal(
    await uiFrame.locator("tbody tr").count(),
    5,
    "生成式表格行数",
  );
  assert.equal(
    await uiFrame.locator(".callout").count(),
    1,
    "结论卡数量",
  );
  pass("模型输出的生成式 UI 渲染", "指标卡 + 图表 + 表格 + 结论卡");

  assert.equal(
    await page.locator("[data-testid=auto-chart]").count(),
    0,
    "宿主不应再写死自动图表",
  );
  pass("无宿主写死的自动图表");

  const sources = page.locator("[data-testid=sources]");
  assert.equal(await sources.count(), 1, "搜索结果来源数量");
  await sources.locator("summary").click();
  assert.equal(
    await sources.locator("ol li").count(),
    3,
    "搜索来源条数",
  );
  pass("智能搜索来源展示", "3 条");

  const reasoningText = await page.locator(".reasoning-head").innerText();
  assert.match(reasoningText, /深度思考/);
  pass("深度思考区域渲染");

  await mkdir("artifacts", { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1800 });
  await page.evaluate(() => {
    const scroll = document.querySelector(".chat-scroll");
    if (scroll) scroll.scrollTop = 0;
    document
      .querySelectorAll(".table-scroll")
      .forEach((element) => ((element as HTMLElement).scrollLeft = 0));
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "artifacts/chat-answer.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass("回答截图已保存", "artifacts/chat-answer.png");

  await page.getByRole("button", { name: "对比官方" }).click();
  await page.waitForSelector("[data-testid=compare-panel]");
  await page.fill(
    "[data-testid=official-text]",
    "## 官方回答\n\n| 区域 | 销售额（万元） |\n| --- | ---: |\n| 华东 | 96.2 |\n| 华南 | 73.4 |\n\n官方只展示了表格，没有图表。",
  );
  const matrix = await page
    .locator("[data-testid=feature-matrix]")
    .innerText();
  assert.match(matrix, /生成式 UI/);
  assert.match(matrix, /本地 ✓/);
  assert.match(matrix, /官方 ✓/);
  assert.match(matrix, /差异/);
  await page.screenshot({
    path: "artifacts/chat-compare-verify.png",
    fullPage: false,
  });
  pass("对比面板识别表格/图表差异", matrix.replace(/\n/g, " | "));

  await page.click("[data-testid=save-comparison]");
  await page.waitForSelector(".compared-badge");
  pass("对比结果保存");

  await page.getByRole("button", { name: "可视化" }).click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll("[data-testid=assistant-message]").length === 2 &&
      document.querySelectorAll(
        "[data-testid=assistant-message][data-status=done]",
      ).length === 2,
    undefined,
    { timeout: 20_000 },
  );
  assert.match(
    await page.locator("[data-testid=assistant-message]").last().innerText(),
    /可视化版本/,
  );
  assert.equal(
    await page.locator("[data-testid=mcp-visualization]").count(),
    2,
    "可视化消息也应渲染生成式 UI",
  );
  pass("一键让模型重新生成可视化版本");

  const savedBeforeReload = await page.evaluate(() => {
    const raw = localStorage.getItem("deepseek-compare.conversations.v1");
    return raw ? JSON.parse(raw)[0]?.messages?.length ?? 0 : 0;
  });
  assert.ok(savedBeforeReload >= 2, "localStorage 会话未保存");
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("[data-testid=assistant-message]");
  assert.equal(
    await page.locator("[data-testid=assistant-message]").count(),
    2,
    "刷新后消息数量",
  );
  pass("会话持久化", `${savedBeforeReload} 条消息`);

  await page.getByTestId("open-settings").click();
  await page.waitForSelector("[data-testid=settings-dialog]");
  assert.equal(
    await page.locator("[data-testid=settings-key]").inputValue(),
    "mock-key",
    "API Key 持久化",
  );
  await page.getByRole("button", { name: "测试连接" }).click();
  await page.waitForSelector(".test-result.ok");
  pass("设置页读取本地 Key 并测试连接");

  assert.deepEqual(consoleErrors, [], `浏览器控制台错误：${consoleErrors.join("\n")}`);
  pass("无浏览器控制台错误");

  console.log("\n聊天应用验证全部通过");
} finally {
  await browser.close();
  await server.close();
}
