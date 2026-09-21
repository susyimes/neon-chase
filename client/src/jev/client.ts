import type { CompactGameState, DecideRequest, DecideResponse, HealthResponse } from "@shared/types.ts";
import { JEV_TIMEOUT_MS } from "../config.ts";
import { localFallback } from "../game/world/fallback.ts";

export class JevService {
  callCount = 0;
  lastLatencyMs = 0;
  lastSource: DecideResponse["source"] | "none" = "none";
  warning: string | null = null;
  inFlight = 0;

  snapshotState(state: CompactGameState): CompactGameState {
    return {
      player: { ...state.player },
      hunter: { ...state.hunter },
      ahead: state.ahead.slice(0, 8),
      score: Math.floor(state.score),
      hurts: Math.max(0, Math.floor(state.hurts)),
      lastEvent: state.lastEvent,
      motif: state.motif,
    };
  }

  async health(): Promise<HealthResponse | null> {
    try {
      const res = await fetch("/api/health");
      if (!res.ok) return null;
      return (await res.json()) as HealthResponse;
    } catch {
      return null;
    }
  }

  async decide(req: DecideRequest): Promise<DecideResponse> {
    const started = performance.now();
    this.callCount += 1;
    this.inFlight += 1;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);

    try {
      const res = await fetch("/api/jev/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: this.snapshotState(req.state),
          ask: req.ask,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as DecideResponse;
      this.lastSource = data.source;
      this.warning = data.warning ?? (data.ok ? null : (data.error ?? "Jev fallback"));
      return {
        ...data,
        terrain: data.terrain ?? [],
        latencyMs: data.latencyMs ?? Math.round(performance.now() - started),
      };
    } catch {
      const fallback = localFallback(req, "Jev timeout or network error — safe terrain");
      this.lastSource = fallback.source;
      this.warning = fallback.warning ?? null;
      return fallback;
    } finally {
      this.lastLatencyMs = Math.round(performance.now() - started);
      this.inFlight -= 1;
      window.clearTimeout(timer);
    }
  }
}
