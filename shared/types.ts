export type SurfaceKind = "solid" | "ledge" | "spike";
export type HunterMove = "chase" | "jump" | "bait" | "hold";
export type DecisionSource = "jev" | "fallback";

export const SURFACES: readonly SurfaceKind[] = ["solid", "ledge", "spike"];
export const WIDTHS = [2, 3, 5] as const;
export const GAPS = [0, 1, 2] as const;
export const HEIGHTS = [4, 5, 6, 7, 8, 9] as const;
export const HUNTER_MOVES: readonly HunterMove[] = [
  "chase",
  "jump",
  "bait",
  "hold",
];

export type WidthChoice = (typeof WIDTHS)[number];
export type GapChoice = (typeof GAPS)[number];
export type HeightChoice = (typeof HEIGHTS)[number];

/** Compact snapshot sent to Jev as `state`. Keep this small. */
export interface CompactGameState {
  player: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hp: number;
    dash: boolean;
  };
  hunter: {
    x: number;
    aggression: number;
  };
  ahead: string[];
  score: number;
}

export interface TerrainSegmentSpec {
  surface: SurfaceKind;
  width: WidthChoice;
  gap: GapChoice;
  height: HeightChoice;
}

export interface DecideRequest {
  state: CompactGameState;
  ask: {
    /** How many upcoming segments to generate (1–3). */
    terrainSegments?: number;
    hunter?: boolean;
  };
}

export interface DecideResponse {
  ok: boolean;
  source: DecisionSource;
  latencyMs: number;
  model?: string;
  warning?: string;
  error?: string;
  terrain: TerrainSegmentSpec[];
  hunterMove?: HunterMove;
}

export interface HealthResponse {
  ok: true;
  jevConfigured: boolean;
  model: string;
}
