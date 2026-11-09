import { startServer } from "./main.js";

const { url } = await startServer({ port: 3081 });
console.log(`开发 API 服务: ${url}`);
