import { WALKABLE_WIDTHS, type WalkableWidth } from "./pads.ts";

export type SurfaceKind = "solid" | "ledge" | "spike";
export type HunterMove = "chase" | "jump" | "bait" | "hold";
export type DecisionSource = "jev" | "fallback";

export type RhythmKind = "easy" | "build" | "punish";
export type MotifKind = "neon_alley" | "rooftop" | "underpass";
export type HazardDensity = "low" | "mid" | "high";
export type OrbStyle = "trail" | "cluster" | "high_risk";
export type EventBeat =
  | "none"
  | "ambush_spike_run"
  | "orb_fountain"
  | "narrow_gauntlet"
  | "calm_breather";
export type JuiceCue = "pulse" | "drop" | "rise" | "sting" | "hush";
export type HunterStance = "pressure" | "bait" | "cut_off" | "retreat";
export type HunterVertical = "above" | "level" | "below";

export const SURFACES: readonly SurfaceKind[] = ["solid", "ledge", "spike"];
/** Jev width choices: 6 / 8 / 10 tiles (all ≥ ~1s at auto-run). See `shared/pads.ts`. */
export const WIDTHS = WALKABLE_WIDTHS;
export const GAPS = [0, 1, 2] as const;
export const HEIGHTS = [4, 5, 6, 7, 8, 9] as const;
export const HUNTER_MOVES: readonly HunterMove[] = [
  "chase",
  "jump",
  "bait",
  "hold",
];
export const RHYTHMS: readonly RhythmKind[] = ["easy", "build", "punish"];
export const MOTIFS: readonly MotifKind[] = [
  "neon_alley",
  "rooftop",
  "underpass",
];
export const HAZARD_DENSITIES: readonly HazardDensity[] = ["low", "mid", "high"];
export const ORB_STYLES: readonly OrbStyle[] = ["trail", "cluster", "high_risk"];
export const EVENT_BEATS: readonly EventBeat[] = [
  "none",
  "ambush_spike_run",
  "orb_fountain",
  "narrow_gauntlet",
  "calm_breather",
];
export const JUICE_CUES: readonly JuiceCue[] = [
  "pulse",
  "drop",
  "rise",
  "sting",
  "hush",
];
export const HUNTER_STANCES: readonly HunterStance[] = [
  "pressure",
  "bait",
  "cut_off",
  "retreat",
];
export const HUNTER_VERTICALS: readonly HunterVertical[] = [
  "above",
  "level",
  "below",
];

export type WidthChoice = WalkableWidth;
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
    /** Player X minus hunter X. Positive = hunter is behind. */
    dist: number;
  };
  ahead: string[];
  score: number;
  /** Times the runner was hurt this run — a death-pressure proxy. */
  hurts: number;
  lastEvent: EventBeat | "none";
  motif: MotifKind;
}

export interface TerrainSegmentSpec {
  surface: SurfaceKind;
  /** Width in tiles. Walkable pads are clamped to ≥ WALKABLE_PAD_TILES when built. */
  width: number;
  gap: GapChoice;
  height: HeightChoice;
}

export interface TerrainComposition {
  rhythm: RhythmKind;
  motif: MotifKind;
  hazardDensity: HazardDensity;
  orbStyle: OrbStyle;
  fakeout: boolean;
}

export interface HunterTactics {
  stance: HunterStance;
  /** Derived move the sprite already understands. */
  move: HunterMove;
  feint: boolean;
  /** 0.2–1.0, from Jev score. */
  aggression: number;
  vertical: HunterVertical;
}

export interface DirectorPlan {
  composition: TerrainComposition;
  difficulty: number;
  event: EventBeat;
  juiceCue: JuiceCue;
  hunter?: HunterTactics;
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
  director?: DirectorPlan;
}

export interface HealthResponse {
  ok: true;
  jevConfigured: boolean;
  model: string;
}
