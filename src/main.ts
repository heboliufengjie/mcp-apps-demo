import { createServer as createHttpServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createMcpApp } from "./server.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

const STATIC_FILES: Record<string, { path: string; type: string }> = {
  "/": {
    path: `${ROOT}host/index.html`,
    type: "text/html; charset=utf-8",
  },
  "/host.js": {
    path: `${ROOT}public/host.js`,
    type: "text/javascript; charset=utf-8",
  },
  "/host.js.map": {
    path: `${ROOT}public/host.js.map`,
    type: "application/json; charset=utf-8",
  },
  "/vendor/app-with-deps.js": {
    path: `${ROOT}node_modules/@modelcontextprotocol/ext-apps/dist/src/app-with-deps.js`,
    type: "text/javascript; charset=utf-8",
  },
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
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

export async function startServer(
  options: { port?: number; host?: string } = {},
) {
  const app = await createMcpApp();

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
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
    } catch (error) {
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
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve())),
      );
      await app.close();
    },
  };
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectRun) {
  const { url } = await startServer();
  console.log(`MCP Apps demo host: ${url}`);
}
