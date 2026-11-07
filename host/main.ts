import {
  AppBridge,
  PostMessageTransport,
  getToolUiResourceUri,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import type {
  CallToolResult,
  ReadResourceResult,
} from "@modelcontextprotocol/client";

type ToolInfo = {
  name: string;
  title?: string;
  description?: string;
  _meta?: Record<string, unknown>;
};

interface DemoState {
  phase: "idle" | "calling" | "reading" | "connecting" | "injected" | "result-sent";
  tool?: ToolInfo;
  resourceUri?: string;
  mimeType?: string;
  toolResult?: CallToolResult;
  events: string[];
}

declare global {
  interface Window {
    __demo: DemoState;
  }
}

const state: DemoState = { phase: "idle", events: [] };
window.__demo = state;

const $ = <T extends HTMLElement>(id: string) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
};

function setPhase(phase: DemoState["phase"]) {
  state.phase = phase;
}

function log(who: "host" | "app" | "server", text: string) {
  state.events.push(`${who}: ${text}`);
  const item = document.createElement("li");
  const whoEl = document.createElement("span");
  whoEl.className = `who ${who}`;
  whoEl.textContent = who;
  const textEl = document.createElement("span");
  textEl.textContent = text;
  item.append(whoEl, textEl);

  const list = $("log");
  list.append(item);
  list.scrollTop = list.scrollHeight;
}

function setChatState(text: string, live = false) {
  $("chat-state").textContent = text;
  $("live-dot").classList.toggle("live", live);
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${url} -> HTTP ${response.status}: ${detail}`);
  }
  return (await response.json()) as T;
}

function updateToolPanel(tool: ToolInfo, resourceUri: string) {
  $("tool-name").textContent = tool.name;
  $("tool-uri").textContent = resourceUri;
  $("tool-state").textContent = "已连接，可调用";
  $("run").removeAttribute("disabled");
}

async function bootstrap() {
  const { tools } = await getJson<{ tools: ToolInfo[] }>("/api/tools");
  const tool = tools.find((item) => getToolUiResourceUri(item) !== undefined);
  if (!tool) throw new Error("没有找到声明了 _meta.ui.resourceUri 的工具");

  const resourceUri = getToolUiResourceUri(tool);
  if (!resourceUri) throw new Error("resourceUri 无效");

  state.tool = tool;
  state.resourceUri = resourceUri;
  updateToolPanel(tool, resourceUri);
  log("host", `发现 MCP App 工具 ${tool.name}`);
  log("server", `_meta.ui.resourceUri = ${resourceUri}`);
  setChatState("宿主就绪", true);
}

async function mountWidget(
  html: string,
  args: Record<string, unknown>,
  toolResult: CallToolResult,
) {
  const wrap = $("frame-wrap");
  wrap.replaceChildren();

  const iframe = document.createElement("iframe");
  iframe.id = "app-frame";
  iframe.title = "MCP App";
  iframe.setAttribute("sandbox", "allow-scripts allow-forms");
  iframe.srcdoc = "<!doctype html><html><body></body></html>";
  wrap.append(iframe);

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const bridge = new AppBridge(
    null,
    { name: "local-mcp-apps-host", version: "0.1.0" },
    { serverTools: {}, serverResources: {}, openLinks: {}, logging: {} },
    {
      hostContext: {
        theme: "light",
        displayMode: "inline",
        availableDisplayModes: ["inline"],
        locale: "zh-CN",
        platform: "web",
      },
    },
  );

  bridge.oninitialized = () => {
    log("app", "ui/notifications/initialized");
    void (async () => {
      try {
        await bridge.sendToolInput({ arguments: args });
        log("host", "ui/notifications/tool-input");
        await bridge.sendToolResult(toolResult);
        log("host", "ui/notifications/tool-result");
        setPhase("result-sent");
        setChatState("工具结果已注入，UI 已渲染", true);
      } catch (error) {
        log("host", `发送数据失败：${String(error)}`);
      }
    })();
  };

  bridge.addEventListener("sizechange", (params) => {
    const height = Math.ceil(params.height ?? 0);
    if (height > 0) iframe.style.height = `${height}px`;
    log("app", `size-changed -> ${height}px`);
  });

  bridge.oncalltool = (params) =>
    postJson<CallToolResult>("/api/call", {
      name: params.name,
      arguments: params.arguments ?? {},
    });

  bridge.onreadresource = (params) =>
    postJson<ReadResourceResult>("/api/read", { uri: params.uri });

  const transport = new PostMessageTransport(
    iframe.contentWindow ?? window,
    iframe.contentWindow ?? window,
  );

  setPhase("connecting");
  await bridge.connect(transport);
  log("host", "AppBridge 已连接，注入 ui:// 资源 HTML");

  setPhase("injected");
  iframe.srcdoc = html;
}

async function run() {
  const button = $("run") as HTMLButtonElement;
  const tool = state.tool;
  const resourceUri = state.resourceUri;
  if (!tool || !resourceUri) return;

  button.disabled = true;
  const period = ($("period") as HTMLSelectElement).value;
  const args = { period };

  try {
    setPhase("calling");
    setChatState("正在调用 MCP 工具…", true);
    log("host", `tools/call ${tool.name} ${JSON.stringify(args)}`);

    const toolResult = await postJson<CallToolResult>("/api/call", {
      name: tool.name,
      arguments: args,
    });
    state.toolResult = toolResult;
    const rows = (toolResult.structuredContent as { rows?: unknown[] } | undefined)
      ?.rows?.length;
    log("server", `工具返回 structuredContent，rows=${rows ?? 0}`);
    $("raw-result").textContent = JSON.stringify(toolResult, null, 2);

    setPhase("reading");
    log("host", `resources/read ${resourceUri}`);
    const resource = await postJson<ReadResourceResult>("/api/read", {
      uri: resourceUri,
    });
    const content = resource.contents?.[0];
    if (!content || !("text" in content)) {
      throw new Error("resources/read 没有返回 HTML");
    }

    state.mimeType = content.mimeType;
    $("resource-mime").textContent = content.mimeType ?? "—";
    log("server", `资源 MIME ${content.mimeType}`);

    await mountWidget(content.text, args, toolResult);
  } catch (error) {
    log("host", `失败：${error instanceof Error ? error.message : String(error)}`);
    setChatState("调用失败", false);
  } finally {
    button.disabled = false;
  }
}

$("run").addEventListener("click", () => {
  void run();
});

void bootstrap().catch((error) => {
  log("host", `启动失败：${String(error)}`);
  $("tool-state").textContent = "启动失败";
  setChatState("启动失败", false);
});
