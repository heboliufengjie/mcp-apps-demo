# DeepSeek 对比台 · MCP Apps

本地运行的 DeepSeek 风格聊天应用。模型决定何时输出 `ui` 可视化块；聊天页把结构化块送入 MCP 工具，读取 `ui://` 资源，再用官方 `AppBridge` 在沙箱 iframe 中渲染指标卡、图表、表格与提示卡。整个应用只有一个入口：`http://127.0.0.1:3080/`。

## 运行

需要 Node.js 20.19+ 或 22.12+、pnpm。正常对话需要 DeepSeek API Key，可在页面设置中填写，或设置 `DEEPSEEK_API_KEY` 环境变量。

```bash
pnpm install
pnpm start
```

打开 `http://127.0.0.1:3080/`。开发模式可运行 `pnpm dev`，使用 `http://localhost:5173/`。

不使用 API Key 的演示模式：

```bash
$env:MOCK_DEEPSEEK="1"
pnpm start
```

发送任意消息后，Mock 回答会展示指标卡、柱状图、表格和结论卡，并标明数据为演示数据。

## MCP Apps 链路

1. 模型根据问题选择普通 Markdown 或一个 `ui` JSON 代码块。`chart` 代码块作为单个图表块兼容。
2. 聊天页解析 JSON，调用 `render_chat_visualization` MCP 工具，传入 `blocks`。
3. 工具返回 `structuredContent`；宿主读取 `ui://chat/visualization.html`。
4. 宿主通过官方 `AppBridge` 与沙箱 iframe 建立连接，发送 `tool-input` 与 `tool-result`。
5. iframe 中的 MCP App 根据 `structuredContent.blocks` 创建 DOM/SVG，并报告高度。

主要文件：

| 文件 | 职责 |
| --- | --- |
| `src/server.ts` | 注册 MCP 工具与 UI 资源 |
| `src/widget/chat-visualization.html` | 沙箱中的可视化视图 |
| `web/src/components/McpVisualization.tsx` | 聊天宿主与 `AppBridge` |
| `web/src/components/GenerativeUI.tsx` | 模型 `ui` JSON 解析 |
| `web/src/constants.ts` | 模型输出格式提示 |
| `scripts/verify.ts` | 协议和浏览器端到端验证 |

工具仍由本地 HTTP 服务承载；模型回复不是 MCP 工具调用本身。宿主在收到模型的结构化内容后调用 MCP 工具，使卡片、图表的交付与渲染遵循 MCP Apps 协议。普通 Markdown 文本、表格和代码继续由聊天前端渲染。

## 验证

```bash
pnpm typecheck
pnpm build
pnpm verify
```

`pnpm verify` 会验证工具元数据、`ui://` 资源、`structuredContent`，再启动 Mock 聊天并检查沙箱里的指标、图表、表格和提示卡。浏览器验证使用本机 Chrome/Edge，或 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定的 Chromium。

## 其他功能

聊天页还支持流式回答、深度思考、官方 Search API、会话本地保存，以及手动回填 DeepSeek 官方回答进行对比。搜索接口按 DeepSeek 平台规则计费。不要把真实 API Key 写入仓库。
