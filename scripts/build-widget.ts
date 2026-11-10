import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, type Rollup } from "vite";

const widgetDir = fileURLToPath(new URL("../src/widget/", import.meta.url));
const template = await readFile(new URL("../src/widget/chat-visualization.html", import.meta.url), "utf8");
const result = await build({
  configFile: false,
  root: widgetDir,
  build: {
    write: false,
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL("../src/widget/widget.js", import.meta.url)),
      formats: ["iife"],
      name: "ChatVisualization",
      fileName: () => "widget.js",
    },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) =>
  "output" in item ? item.output : [],
);
const script = outputs.find((item): item is Rollup.OutputChunk => item.type === "chunk");
if (!script || !template.includes("<!-- WIDGET_SCRIPT -->")) {
  throw new Error("无法生成内联的可视化组件脚本");
}
const html = template.replace("<!-- WIDGET_SCRIPT -->", () => `<script>${script.code}</script>`);
const outDir = new URL("../src/widget/dist/", import.meta.url);
await mkdir(outDir, { recursive: true });
await writeFile(new URL("chat-visualization.html", outDir), html);
