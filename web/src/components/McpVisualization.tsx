import { useEffect, useMemo, useRef, useState } from "react";
import { AppBridge, PostMessageTransport, getToolUiResourceUri } from "@modelcontextprotocol/ext-apps/app-bridge";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/client";

const TOOL = "render_chat_visualization";

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function McpVisualization({ blocks }: { blocks: Record<string, unknown>[] }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState("");
  const key = useMemo(() => JSON.stringify(blocks), [blocks]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let cancelled = false;
    let bridge: AppBridge | undefined;

    void (async () => {
      try {
        const args = { blocks: JSON.parse(key) as Record<string, unknown>[] };
        const discovery = await fetch("/api/tools");
        if (!discovery.ok) throw new Error(`tools/list: HTTP ${discovery.status}`);
        const { tools } = await discovery.json() as { tools: Array<{ name: string; _meta?: Record<string, unknown> }> };
        const tool = tools.find(item => item.name === TOOL);
        const uri = tool && getToolUiResourceUri(tool);
        if (!uri) throw new Error("MCP 工具未声明 UI 资源");
        const result = await post<CallToolResult>("/api/call", { name: TOOL, arguments: args });
        const resource = await post<ReadResourceResult>("/api/read", { uri });
        const html = resource.contents[0];
        if (cancelled || !html || !("text" in html) || html.mimeType !== "text/html;profile=mcp-app") {
          if (!cancelled) throw new Error("MCP App 资源无效");
          return;
        }
        bridge = new AppBridge(null, { name: "chat-host", version: "0.1.0" },
          { serverTools: {}, serverResources: {}, openLinks: {}, logging: {} },
          { hostContext: { theme: "dark", displayMode: "inline", availableDisplayModes: ["inline"], locale: "zh-CN", platform: "web" } });
        bridge.oninitialized = () => {
          if (cancelled) return;
          void bridge?.sendToolInput({ arguments: args }).then(() => bridge?.sendToolResult(result));
        };
        bridge.addEventListener("sizechange", (params) => {
          if (!cancelled && params.height && frame) frame.style.height = `${Math.max(80, Math.ceil(params.height))}px`;
        });
        bridge.oncalltool = (params) => post<CallToolResult>("/api/call", { name: params.name, arguments: params.arguments ?? {} });
        bridge.onreadresource = (params) => post<ReadResourceResult>("/api/read", { uri: params.uri });
        await bridge.connect(new PostMessageTransport(frame.contentWindow ?? window, frame.contentWindow ?? window));
        if (!cancelled) frame.srcdoc = html.text;
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();

    return () => { cancelled = true; void bridge?.close(); };
  }, [key]);

  if (error) return <div className="chart-error" role="alert">MCP Apps 渲染失败：{error}</div>;
  return <iframe ref={frameRef} title="MCP Apps 可视化" sandbox="allow-scripts" srcDoc="<!doctype html><html><body></body></html>" style={{ width: "100%", height: 120, border: 0, display: "block" }} data-testid="mcp-visualization" />;
}
