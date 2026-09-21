import type {
  CompactGameState,
  EventBeat,
  MotifKind,
} from "../../shared/types.ts";

export const JEV_MODEL = "jev-1.13.0" as const;

export type JevChoiceQuestion = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type JevScoreQuestion = {
  type: "score";
  instructions: string;
  criteria: string[];
};

export type JevNoulQuestion = {
  type: "noul";
  instructions: string;
  criteria?: { true: string; false: string };
};

export type JevQuestion = JevChoiceQuestion | JevScoreQuestion | JevNoulQuestion;

export function clampSegments(value: number | undefined): number {
  if (!value || value < 1) return 0;
  return Math.min(3, Math.floor(value));
}

export function readFacts(state: CompactGameState): {
  hp: number;
  score: number;
  dash: boolean;
  dist: number;
  hurts: number;
  lastEvent: EventBeat | "none";
  motif: MotifKind;
  ahead: string;
  airborne: boolean;
} {
  const dist =
    typeof state.hunter?.dist === "number"
      ? state.hunter.dist
      : Math.round((state.player?.x ?? 0) - (state.hunter?.x ?? 0));
  return {
    hp: state.player?.hp ?? 3,
    score: state.score ?? 0,
    dash: Boolean(state.player?.dash),
    dist,
    hurts: state.hurts ?? 0,
    lastEvent: state.lastEvent ?? "none",
    motif: state.motif ?? "neon_alley",
    ahead: (state.ahead ?? []).slice(0, 8).join(",") || "empty",
    airborne: (state.player?.vy ?? 0) < -40,
  };
}

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
  const f = readFacts(state);
  const snap = `hp=${f.hp} score=${f.score} dash=${f.dash ? "ready" : "down"} hunterDist=${f.dist} hurts=${f.hurts} lastEvent=${f.lastEvent} motif=${f.motif} ahead=${f.ahead}`;

  if (segments > 0) {
    for (let i = 0; i < segments; i += 1) {
      const p = i === 0 ? "" : `s${i}_`;
      const nth = i === 0 ? "first" : i === 1 ? "second" : "third";
      questions[`${p}next_surface`] = {
        type: "choice",
        instructions: `${nth} platform type. ${snap}. Spike only if hp>=2 and this beat is not a recovery. Ledge if rooftop motif or player is high.`,
        criteria: {
          solid: "Full safe street slab — default when hp=1 or lastEvent was punish/ambush",
          ledge: "Thin raised lip — rooftop language, asks for a precise land",
          spike: "Walkable slab with magenta spikes on top — only if hp>=2",
        },
      };
      questions[`${p}width`] = {
        type: "choice",
        instructions: `${nth} platform width in tiles. Short widths punish; long widths breathe. Prefer 5 if hp=1.`,
        criteria: {
          "2": "Stub — gauntlet / punish / dash-check",
          "3": "Medium stride",
          "5": "Long rest slab",
        },
      };
      questions[`${p}gap`] = {
        type: "choice",
        instructions: `Empty tiles after the ${nth} platform. Prefer 0 if previous encoding was a gap or hp=1.`,
        criteria: {
          "0": "Seamless continue",
          "1": "Small hop",
          "2": "Committed jump — only if dash ready or hp>=2",
        },
      };
      questions[`${p}height`] = {
        type: "choice",
        instructions: `${nth} platform row from the bottom. Rooftop likes 7–9, underpass 4–6, alley 5–7.`,
        criteria: {
          "4": "Street / underpass floor",
          "5": "Curb",
          "6": "Low roof",
          "7": "Mid roof",
          "8": "High catwalk",
          "9": "Antenna mast",
        },
      };
    }

    questions.rhythm = {
      type: "choice",
      instructions: `Composer rhythm for this slice. ${snap}. easy if hp=1 or hurts>=2; build if score climbing and hp>=2; punish only if hp=3, dash ready, hunterDist<280.`,
      criteria: {
        easy: "Recovery sidewalk — solids, tiny gaps, hunter should ease",
        build: "Teach then tax — mix ledges, one threat",
        punish: "Tax the confident — spikes/gaps, only when the runner can answer",
      },
    };
    questions.motif = {
      type: "choice",
      instructions: `Visual district for the next slice. Prefer staying on ${f.motif} unless score crossed a hundred or lastEvent was calm_breather. Rooftop if player is high; underpass if low / hp low.`,
      criteria: {
        neon_alley: "Cyan street, magenta fog, mid heights",
        rooftop: "Cold blue catwalks, more ledges, higher rows",
        underpass: "Amber-violet tunnel, lower slabs, heavier solids",
      },
    };
    questions.hazard_density = {
      type: "choice",
      instructions: `Extra spike nubs and danger jewelry on otherwise-safe slabs. ${snap}. high only if hp>=2 and rhythm is build/punish.`,
      criteria: {
        low: "Clean lips, almost no extra teeth",
        mid: "A few magenta nubs on long solids",
        high: "Teeth on most solids — skip if hp=1",
      },
    };
    questions.orb_style = {
      type: "choice",
      instructions: `How to place collectible orbs this slice. high_risk if dash ready and hp>=2; cluster after a miss (hurts>0); trail as default.`,
      criteria: {
        trail: "Orbs along the run line, one or two per slab",
        cluster: "A tight triangle of orbs above a safe slab",
        high_risk: "Orbs hanging over gaps or above spikes",
      },
    };
    questions.fakeout = {
      type: "choice",
      instructions: `Whether to paint a decoy lip that is shorter than it looks. Yes only if hp>=2, dash ready, and rhythm is build or punish. Never after lastEvent=ambush_spike_run.`,
      criteria: {
        yes: "Ghost slab — glow wider than the collider",
        no: "Honest collision, no decoy",
      },
    };
    questions.flow = {
      type: "score",
      instructions: `How hard should the next slice feel given ${snap}? Low scores when hp=1, hurts high, or lastEvent was a set-piece. High scores only when hp=3, dash ready, score already rolling, hunter close.`,
      criteria: [
        "2 street stroll — hp critical or just punished",
        "3 soft recovery, hunter polite",
        "4 easy alley, tiny hops",
        "5 standard night run",
        "6 mid flow, ledges appear",
        "7 pressure on, spikes allowed",
        "8 hard — wide gaps if dash ready",
        "9 punish window, hunter cuts off",
        "10 peak heat — only hp=3 and hunterDist<220",
      ],
    };
    questions.event_beat = {
      type: "choice",
      instructions: `Optional set-piece that MUST change the next screen if not none. Prefer none when lastEvent!=none, hp=1 (except calm_breather), or score<80. ambush_spike_run if hp>=2 and dash ready. orb_fountain if hurts>0 or hp<=2. narrow_gauntlet if dash ready and hp>=2. calm_breather if hp=1 or hurts>=2.`,
      criteria: {
        none: "No set-piece — keep composing normal slabs",
        ambush_spike_run: "Two spike slabs slam in — magenta sting. Need hp>=2",
        orb_fountain: "Arc of extra orbs, a visible gift",
        narrow_gauntlet: "Three stub ledges with hops — dash check",
        calm_breather: "Long safe slab, hunter should retreat",
      },
    };
    questions.juice_cue = {
      type: "choice",
      instructions: `Which audio/VFX accent paints this beat. Match the event and rhythm: hush for easy/breather, pulse for alley trail, rise for orb_fountain, sting for ambush, drop for punish/underpass.`,
      criteria: {
        pulse: "Cyan flash, soft pad swell — default alley",
        drop: "Bass duck, magenta wash — punish / underpass",
        rise: "Rising arpeggio, gold motes — gift / fountain",
        sting: "Hit-stop spark, chromatic flash — ambush / gauntlet",
        hush: "Music ducks, lights dim — recovery / breather",
      },
    };
  }

  if (ask.hunter) {
    questions.hunter_stance = {
      type: "choice",
      instructions: `Hunter stance this tick. ${snap} airborne=${f.airborne}. chase-pressure if hunterDist>220; bait if hunterDist<140; cut_off if player airborne or rooftop; retreat if hp=1 or event will be calm_breather.`,
      criteria: {
        pressure: "Close the gap, sit on the runner's back",
        bait: "Teleport the intent ahead and wait",
        cut_off: "Intercept above/ahead — jump the line",
        retreat: "Give space — recovery, breather, or after a hit",
      },
    };
    questions.hunter_feint = {
      type: "noul",
      instructions: `The hunter should fake the opposite way for a beat before committing. True only if hunterDist is mid (120-320), hp>=2, and stance is pressure or cut_off.`,
      criteria: {
        true: "Shoulder-fake then commit — readable, not cheap",
        false: "Move honestly toward the chosen stance",
      },
    };
    questions.hunter_aggression = {
      type: "score",
      instructions: `How hard the hunter presses this tick. ${snap}. Low if hp=1 or retreat. High if score high, hunter already close, and runner has dash.`,
      criteria: [
        "Hover far, almost ceremonial",
        "Patient shadow",
        "Standard chase pressure",
        "Lean in — occupy the landing",
        "Relentless — occupy the body",
      ],
    };
    questions.hunter_vertical = {
      type: "choice",
      instructions: `Preferred height relative to the runner. above if airborne or rooftop; below if underpass; level otherwise.`,
      criteria: {
        above: "Hang over the head — cut-off / rooftop",
        level: "Same rail as the runner",
        below: "Under the feet — underpass / retreat",
      },
    };
  }

  return { model: JEV_MODEL, state, questions };
}
