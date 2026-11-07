import type { ServerResponse } from "node:http";
import type { SearchSource } from "../web/src/types.js";

const MOCK_REASONING =
  "用户希望从视觉上理解各区域销售数据。这个内容适合用指标卡概括总量、用柱状图做区域对比、用表格保留明细，再给一个结论提示。我会让界面按这个结构呈现。";

const MOCK_CONTENT = `### 本月销售概况

本月销售额合计 **286.4 万元**，订单量 **18,420 单**，整体同比 **+12.4%**。华东贡献最高，西南和其他区域仍有提升空间。

\`\`\`ui
{"blocks":[{"type":"metrics","items":[{"label":"销售额","value":"286.4 万元","delta":"+12.4%","tone":"up"},{"label":"订单量","value":"18,420","delta":"+9.6%","tone":"up"},{"label":"覆盖区域","value":"5 个","delta":"华东占比最高","tone":"neutral"}]},{"type":"chart","chart":{"type":"bar","title":"各区域销售额（万元）","x":"区域","y":"销售额","unit":"万元","data":[{"区域":"华东","销售额":96.2},{"区域":"华南","销售额":73.4},{"区域":"华北","销售额":60.5},{"区域":"西南","销售额":34.3},{"区域":"其他","销售额":22.0}]}},{"type":"table","title":"区域明细","columns":["区域","销售额（万元）","订单量","同比"],"rows":[["华东","96.2","6,120","15.2%"],["华南","73.4","4,880","9.8%"],["华北","60.5","3,950","11.1%"],["西南","34.3","2,210","6.4%"],["其他","22.0","1,260","3.1%"]]},{"type":"callout","tone":"warn","title":"关注点","text":"西南同比增速低于整体水平，建议单独排查渠道转化。"}]}
\`\`\`

**结论**

1. 华东和华南合计贡献约 **59.2%** 的销售额。
2. 西南同比增速低于整体水平，建议单独排查渠道转化。
3. 若保持当前增速，下月销售额预计约为 $286.4 \\times (1+0.124) \\approx 321.9$ 万元。

> 数据为演示用 mock，不代表真实业务。`;

export function mockSearch(query: string): { results: SearchSource[] } {
  return {
    results: [
      {
        title: `如何用图表呈现销售数据：${query.slice(0, 20)}`,
        url: "https://example.com/sales-visualization",
        snippet: "用柱状图对比区域销售额，用折线图观察时间趋势，用表格保留精确数值。",
        summary:
          "数据可视化实践中，柱状图适合分类对比，折线图适合连续时间趋势，饼图适合展示占比但分类不宜过多。",
        site_name: "Example 数据实验室",
        date: "2026-10-18T00:00:00+00:00",
      },
      {
        title: "MCP Apps：让工具结果拥有原生 UI",
        url: "https://example.com/mcp-apps",
        snippet: "工具通过 ui:// 资源声明界面，宿主在沙箱 iframe 中渲染。",
        summary:
          "MCP Apps 允许 MCP Server 为工具声明 HTML 资源，宿主读取后在沙箱中渲染，并通过 postMessage 与工具结果双向通信。",
        site_name: "MCP 文档",
        date: "2026-09-02T00:00:00+00:00",
      },
      {
        title: "DeepSeek API 搜索结果展示的最佳实践",
        url: "https://example.com/deepseek-search",
        snippet: "搜索结果应展示来源、摘要与链接，并支持折叠。",
        summary:
          "在对话产品中展示搜索结果时，建议保留来源标题、站点、摘要与链接，并允许用户展开查看完整内容。",
        site_name: "DeepSeek 开发者",
        date: "2026-08-21T00:00:00+00:00",
      },
    ],
  };
}

function splitText(text: string, size: number) {
  const parts: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    parts.push(text.slice(index, index + size));
  }
  return parts;
}

export function streamMockChat(
  res: ServerResponse,
  body: Record<string, unknown>,
) {
  const thinkingEnabled =
    (body.thinking as { type?: string } | undefined)?.type !== "disabled";
  const chunks: string[] = [];

  if (thinkingEnabled) {
    for (const part of splitText(MOCK_REASONING, 9)) {
      chunks.push(
        `data: ${JSON.stringify({
          choices: [{ delta: { reasoning_content: part } }],
        })}\n\n`,
      );
    }
  }

  for (const part of splitText(MOCK_CONTENT, 22)) {
    chunks.push(
      `data: ${JSON.stringify({
        choices: [{ delta: { content: part } }],
      })}\n\n`,
    );
  }

  chunks.push(
    `data: ${JSON.stringify({
      choices: [{ delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 138, completion_tokens: 642, total_tokens: 780 },
    })}\n\n`,
  );
  chunks.push("data: [DONE]\n\n");

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });

  let index = 0;
  let closed = false;
  res.on("close", () => {
    closed = true;
  });

  const timer = setInterval(() => {
    if (closed || index >= chunks.length) {
      clearInterval(timer);
      if (!closed) res.end();
      return;
    }
    res.write(chunks[index]);
    index += 1;
  }, 28);
}
