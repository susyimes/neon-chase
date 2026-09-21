import { serve } from "@hono/node-server";
import { config as loadEnv } from "dotenv";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompactGameState, DecideRequest } from "../../shared/types.ts";
import { decide } from "./jev.ts";
import { JEV_MODEL } from "./questions.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "../..");

loadEnv({ path: resolve(repoRoot, ".env.local"), quiet: true });
loadEnv({ path: resolve(repoRoot, ".env"), quiet: true });
loadEnv({ path: resolve(here, "../.env.local"), quiet: true });

const PORT = Number(process.env.PORT ?? 43124);
const app = new Hono();

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

app.get("/api/health", (c) =>
  c.json({
    ok: true as const,
    jevConfigured: Boolean(process.env.TYPESAFE_API_KEY?.trim()),
    model: JEV_MODEL,
  }),
);

app.post("/api/jev/decide", async (c) => {
  let body: DecideRequest;
  try {
    body = (await c.req.json()) as DecideRequest;
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  if (!isCompactState(body?.state) || !body.ask || typeof body.ask !== "object") {
    return c.json({ error: "Expected { state, ask }" }, 400);
  }

  const result = await decide({
    state: body.state,
    ask: {
      terrainSegments: body.ask.terrainSegments,
      hunter: body.ask.hunter,
    },
  });
  return c.json(result);
});

function isCompactState(value: unknown): value is CompactGameState {
  if (!value || typeof value !== "object") return false;
  const s = value as CompactGameState;
  return Boolean(s.player && s.hunter && Array.isArray(s.ahead));
}

serve({ fetch: app.fetch, port: PORT, hostname: "0.0.0.0" }, (info) => {
  const configured = Boolean(process.env.TYPESAFE_API_KEY?.trim());
  console.log(
    `[neon-chase] Jev proxy on http://127.0.0.1:${info.port}  key=${configured ? "set" : "missing (fallback)"}`,
  );
});
