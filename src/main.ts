import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createMcpApp } from "./server.js";
import { mockSearch, streamMockChat } from "./mock.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const WEB_DIST = resolve(ROOT, "web/dist");
const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

const STATIC_FILES: Record<string, { path: string; type: string }> = {
  "/vendor/app-with-deps.js": {
    path: `${ROOT}node_modules/@modelcontextprotocol/ext-apps/dist/src/app-with-deps.js`,
    type: "text/javascript; charset=utf-8",
  },
};

type ServerOptions = {
  port?: number;
  host?: string;
  mock?: boolean;
};

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "access-control-allow-origin": "*",
  });
  res.end(payload);
}

async function readBody(req: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error("请求体不是合法 JSON");
  }
}

function getApiKey(req: import("node:http").IncomingMessage) {
  const header = req.headers["x-deepseek-key"];
  const fromHeader = typeof header === "string" ? header.trim() : "";
  return fromHeader || process.env.DEEPSEEK_API_KEY || "";
}

async function serveFile(
  res: import("node:http").ServerResponse,
  filePath: string,
  cacheControl = "no-store",
) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return false;

    res.writeHead(200, {
      "content-type": MIME_TYPES[extname(filePath)] ?? "application/octet-stream",
      "content-length": info.size,
      "cache-control": cacheControl,
      "access-control-allow-origin": "*",
    });
    createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

async function proxyJson(
  res: import("node:http").ServerResponse,
  upstreamUrl: string,
  init: { method: string; key: string; body?: unknown },
) {
  if (!init.key) {
    sendJson(res, 401, {
      error: { message: "请先在设置中填写 DeepSeek API Key" },
    });
    return;
  }

  const upstream = await fetch(upstreamUrl, {
    method: init.method,
    headers: {
      authorization: `Bearer ${init.key}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await upstream.text();
  res.writeHead(upstream.status, {
    "content-type":
      upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(text);
}

function startMockStream(
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
) {
  streamMockChat(res, body);
}

async function proxyChat(
  req: import("node:http").IncomingMessage,
  res: import("node:http").ServerResponse,
  body: Record<string, unknown>,
) {
  const key = getApiKey(req);
  if (!key) {
    sendJson(res, 401, {
      error: { message: "请先在设置中填写 DeepSeek API Key" },
    });
    return;
  }

  const controller = new AbortController();
  const upstream = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }
    res.writeHead(upstream.status, {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    });
    res.end(typeof parsed === "string" ? JSON.stringify({ error: { message: parsed } }) : JSON.stringify(parsed));
    return;
  }

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    "access-control-allow-origin": "*",
  });

  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.once("close", onClose);

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      if (!res.write(chunk)) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            res.off("drain", finish);
            res.off("close", finish);
            resolve();
          };
          res.once("drain", finish);
          res.once("close", finish);
        });
      }
    }
    res.end();
  } catch (error) {
    if (!controller.signal.aborted) {
      console.error("chat stream error:", error);
    }
    if (!res.writableEnded) res.end();
  } finally {
    res.off("close", onClose);
    reader.releaseLock();
  }
}

export async function startServer(options: ServerOptions = {}) {
  const app = await createMcpApp();
  const isMock = options.mock ?? process.env.MOCK_DEEPSEEK === "1";

  const httpServer = createHttpServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    try {
      const staticFile = STATIC_FILES[url.pathname];
      if (staticFile && req.method === "GET") {
        const body = await readFile(staticFile.path);
        res.writeHead(200, {
          "content-type": staticFile.type,
          "content-length": body.byteLength,
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        });
        res.end(body);
        return;
      }

      if (url.pathname === "/api/config" && req.method === "GET") {
        sendJson(res, 200, {
          hasServerKey: Boolean(process.env.DEEPSEEK_API_KEY),
          mock: isMock,
        });
        return;
      }

      if (url.pathname === "/api/models" && req.method === "GET") {
        if (isMock) {
          sendJson(res, 200, {
            object: "list",
            data: [
              { id: "deepseek-flash", object: "model" },
              { id: "deepseek-v4-pro", object: "model" },
            ],
          });
          return;
        }
        await proxyJson(res, `${DEEPSEEK_BASE}/models`, {
          method: "GET",
          key: getApiKey(req),
        });
        return;
      }

      if (url.pathname === "/api/search" && req.method === "POST") {
        const body = await readBody(req);
        if (isMock) {
          sendJson(res, 200, mockSearch(String(body.query ?? "")));
          return;
        }
        await proxyJson(res, `${DEEPSEEK_BASE}/v1/tools/search`, {
          method: "POST",
          key: getApiKey(req),
          body: {
            query: body.query,
            count: body.count ?? 6,
            need_content: body.need_content ?? false,
          },
        });
        return;
      }

      if (url.pathname === "/api/chat" && req.method === "POST") {
        const body = await readBody(req);
        if (isMock) startMockStream(res, body);
        else await proxyChat(req, res, body);
        return;
      }

      if (url.pathname === "/api/tools" && req.method === "GET") {
        sendJson(res, 200, await app.client.listTools());
        return;
      }

      if (url.pathname === "/api/call" && req.method === "POST") {
        const body = await readBody(req);
        const result = await app.client.callTool({
          name: String(body.name),
          arguments: (body.arguments ?? {}) as Record<string, unknown>,
        });
        sendJson(res, 200, result);
        return;
      }

      if (url.pathname === "/api/read" && req.method === "POST") {
        const body = await readBody(req);
        const result = await app.client.readResource({
          uri: String(body.uri),
        });
        sendJson(res, 200, result);
        return;
      }

      if (url.pathname === "/health" && req.method === "GET") {
        sendJson(res, 200, { ok: true, mock: isMock });
        return;
      }

      if (req.method === "GET" && url.pathname.startsWith("/assets/")) {
        const filePath = resolve(WEB_DIST, `.${url.pathname}`);
        if (filePath.startsWith(WEB_DIST) && (await serveFile(res, filePath, "public, max-age=31536000, immutable"))) {
          return;
        }
      }

      if (url.pathname === "/mcp-demo") {
        sendJson(res, 404, { error: "This example is now integrated into the chat page." });
        return;
      }

      if (req.method === "GET" && !extname(url.pathname)) {
        const indexPath = resolve(WEB_DIST, "index.html");
        if (await serveFile(res, indexPath, "no-store")) return;
        sendJson(res, 503, {
          error:
            "前端尚未构建：请先运行 pnpm build:web，或使用 pnpm dev 启动 Vite。",
        });
        return;
      }

      sendJson(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
    } catch (error) {
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      sendJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const host = options.host ?? "127.0.0.1";
  await new Promise<void>((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(options.port ?? 3080, host, () => resolve());
  });

  const address = httpServer.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    port,
    url: `http://${host}:${port}`,
    mock: isMock,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve())),
      );
      await app.close();
    },
  };
}

const isDirectRun =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  const { url, mock } = await startServer();
  console.log(
    `DeepSeek 对比台: ${url}${mock ? " (mock 模式)" : ""}`,
  );
}
