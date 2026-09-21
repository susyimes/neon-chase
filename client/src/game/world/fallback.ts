import { safeDirector } from "@shared/defaults.ts";
import type {
  DecideRequest,
  DecideResponse,
  TerrainSegmentSpec,
} from "@shared/types.ts";

export function safeSpecs(count: number): TerrainSegmentSpec[] {
  const n = Math.max(1, Math.min(16, Math.floor(count)));
  return Array.from({ length: n }, () => ({
    surface: "solid" as const,
    width: 5 as const,
    gap: 0 as const,
    height: 5 as const,
  }));
}

export function localFallback(req: DecideRequest, warning: string): DecideResponse {
  const n = req.ask.terrainSegments ?? 0;
  const wantHunter = Boolean(req.ask.hunter);
  return {
    ok: false,
    source: "fallback",
    latencyMs: 0,
    warning,
    error: warning,
    terrain: n > 0 ? safeSpecs(n) : [],
    hunterMove: wantHunter ? "chase" : undefined,
    director: safeDirector({
      hunter: wantHunter,
      motif: req.state?.motif,
      lastEvent: req.state?.lastEvent,
    }),
  };
}
