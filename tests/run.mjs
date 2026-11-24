import { createServer } from "vite";
const server = await createServer({ server: { middlewareMode: true }, appType: "custom" });
try {
  await server.ssrLoadModule("/tests/week-report.test.ts");
  await server.ssrLoadModule("/tests/territory.test.ts");
  await server.ssrLoadModule("/tests/medical.test.ts");
  await server.ssrLoadModule("/tests/city-map.test.ts");
  await server.ssrLoadModule("/tests/encounters.test.ts");
  await server.ssrLoadModule("/tests/region-economy.test.ts");
  await server.ssrLoadModule("/tests/combat.test.ts");
  await server.ssrLoadModule("/tests/empire.test.ts");
} finally {
  await server.close();
}
