import type {
  HunterMove,
  TerrainSegmentSpec,
} from "../../shared/types.ts";

/** Safe flat ground used when Jev is missing, slow, or errors. */
export function safeTerrain(count: number): TerrainSegmentSpec[] {
  const n = Math.max(1, Math.min(3, Math.floor(count)));
  return Array.from({ length: n }, () => ({
    surface: "solid" as const,
    width: 5 as const,
    gap: 0 as const,
    height: 5 as const,
  }));
}

export function safeHunterMove(): HunterMove {
  return "chase";
}
