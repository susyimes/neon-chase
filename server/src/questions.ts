import type { CompactGameState } from "../../shared/types.ts";

const JEV_MODEL = "jev-1.13.0";

export type JevQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export function buildJevBody(
  state: CompactGameState,
  ask: { terrainSegments?: number; hunter?: boolean },
): {
  model: typeof JEV_MODEL;
  state: CompactGameState;
  questions: Record<string, JevQuestion>;
} {
  const questions: Record<string, JevQuestion> = {};
  const segments = clampSegments(ask.terrainSegments);

  for (let i = 0; i < segments; i += 1) {
    const p = i === 0 ? "" : `s${i}_`;
    questions[`${p}next_surface`] = {
      type: "choice",
      instructions: "Next runner platform type. Vary; spike only if hp>=2.",
      criteria: {
        solid: "Safe full platform",
        ledge: "Thin raised ledge",
        spike: "Platform with top spikes",
      },
    };
    questions[`${p}width`] = {
      type: "choice",
      instructions: "Platform width in tiles.",
      criteria: { "2": "short", "3": "medium", "5": "long" },
    };
    questions[`${p}gap`] = {
      type: "choice",
      instructions: "Empty tiles after this platform. Prefer 0 if last was a gap.",
      criteria: { "0": "none", "1": "small jump", "2": "wide jump" },
    };
    questions[`${p}height`] = {
      type: "choice",
      instructions: "Platform height row.",
      criteria: {
        "4": "low",
        "5": "mid-low",
        "6": "mid",
        "7": "mid-high",
        "8": "high",
        "9": "very high",
      },
    };
  }

  if (ask.hunter) {
    questions.hunter_move = {
      type: "choice",
      instructions: "Hunter action. Chase if far; bait if close; jump if player airborne.",
      criteria: {
        chase: "Close the gap",
        jump: "Leap toward the player",
        bait: "Cut off ahead",
        hold: "Pause in place",
      },
    };
  }

  return { model: JEV_MODEL, state, questions };
}

export function clampSegments(value: number | undefined): number {
  if (!value || value < 1) return 0;
  return Math.min(3, Math.floor(value));
}

export { JEV_MODEL };
