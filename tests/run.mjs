import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  await server.ssrLoadModule("/tests/city-map.test.ts");
} finally {
  await server.close();
}
