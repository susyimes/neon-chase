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
