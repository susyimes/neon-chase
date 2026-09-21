import type {
  DirectorPlan,
  EventBeat,
  HunterTactics,
  MotifKind,
  TerrainComposition,
} from "./types.ts";

export const SAFE_COMPOSITION: TerrainComposition = {
  rhythm: "easy",
  motif: "neon_alley",
  hazardDensity: "low",
  orbStyle: "trail",
  fakeout: false,
};

export const SAFE_HUNTER: HunterTactics = {
  stance: "pressure",
  move: "chase",
  feint: false,
  aggression: 0.35,
  vertical: "level",
};

/** Stub hunter snapshot so the proxy still accepts compact state. Dist is "far". */
export const DISABLED_HUNTER_STATE = {
  x: 0,
  aggression: 0,
  dist: 9999,
} as const;

export function safeDirector(
  extras: {
    hunter?: boolean;
    motif?: MotifKind;
    lastEvent?: EventBeat;
  } = {},
): DirectorPlan {
  return {
    composition: { ...SAFE_COMPOSITION, motif: extras.motif ?? "neon_alley" },
    difficulty: 3,
    event: "none",
    juiceCue: "hush",
    hunter: extras.hunter ? { ...SAFE_HUNTER } : undefined,
  };
}
