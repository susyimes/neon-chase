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
  const snap = `hp=${f.hp} score=${f.score} dash=${f.dash ? "ready" : "down"} hurts=${f.hurts} lastEvent=${f.lastEvent} motif=${f.motif} ahead=${f.ahead}`;

  if (segments > 0) {
    for (let i = 0; i < segments; i += 1) {
      const p = i === 0 ? "" : `s${i}_`;
      const nth = i === 0 ? "first" : i === 1 ? "second" : "third";
      questions[`${p}next_surface`] = {
        type: "choice",
        instructions: `${nth} platform type. ${snap}. This is a calm runner — prefer solid. Ledge if rooftop motif or player is high. Spike only as a rare treat: hp=3, rhythm punish, and the last two surfaces were not spike.`,
        criteria: {
          solid: "Full safe street slab — the default for this easier night",
          ledge: "Thin raised lip — rooftop language, asks for a precise land",
          spike: "Rare magenta teeth — almost never; never on recovery or after another spike",
        },
      };
      questions[`${p}width`] = {
        type: "choice",
        instructions: `${nth} platform width in tiles. Every walkable pad must last ~1s at auto-run (6 tiles = 240px / 230px/s). Never pick shorter than 6. Prefer 8 if hp=1.`,
        criteria: {
          "6": "One-second landing pad — the control floor",
          "8": "Longer stride — room to aim the next jump",
          "10": "Rest slab — breathe and collect",
        },
      };
      questions[`${p}gap`] = {
        type: "choice",
        instructions: `Empty tiles after the ${nth} platform. ${snap}. Opening/recovery (score<60 or hp=1): prefer 0, rare 1. Early (score<160): mix 0 and 1, occasional 2. Mid/late (score>=160): prefer 1–2 so a missed jump can end the run. Never stack two 2-gaps. The client still enforces a 2s safe runway and spacing.`,
        criteria: {
          "0": "Seamless continue — opening runway or right after a hole",
          "1": "Tiny hop — readable lip, coyote may save it",
          "2": "Committed pit — 80px hole, must jump; the usual mid/late tax",
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
      instructions: `Composer rhythm for this slice. ${snap}. easy if hp=1 or hurts>=2; build if score climbing and hp>=2; punish only if hp=3, dash ready, and the last slice was easy or build.`,
      criteria: {
        easy: "Recovery sidewalk — solids, sparse readable pits",
        build: "Teach then tax — mix ledges, a 2-tile pit",
        punish: "A 2-tile pit or one rare spike — never a wall of teeth",
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
      instructions: `Extra spike nubs on otherwise-safe slabs. ${snap}. Prefer low. mid only if hp=3 and rhythm is punish. Never high on this calmer build.`,
      criteria: {
        low: "Clean lips, almost no extra teeth — the usual pick",
        mid: "At most one magenta nub on a long solid",
        high: "Still sparse — the client will thin this down; avoid unless hp=3",
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
        yes: "Ghost slab — glow wider than an honest ~1s collider (never a micro-pad)",
        no: "Honest collision, no decoy",
      },
    };
    questions.flow = {
      type: "score",
      instructions: `How hard should the next slice feel given ${snap}? Bias low. Low scores when hp<=2, hurts high, or lastEvent was a set-piece. High scores only when hp=3, dash ready, and score already rolling.`,
      criteria: [
        "2 street stroll — hp critical or just punished",
        "3 soft recovery sidewalk",
        "4 easy alley, tiny hops",
        "5 standard night run",
        "6 mid flow, ledges appear",
        "7 a gap or one rare spike is allowed",
        "8 hard — wide gaps if dash ready",
        "9 punish window — gaps, not a spike wall",
        "10 peak heat — only hp=3 and score already high",
      ],
    };
    questions.event_beat = {
      type: "choice",
      instructions: `Optional set-piece that MUST change the next screen if not none. Prefer none when lastEvent!=none, hp=1 (except calm_breather), or score<80. Prefer orb_fountain or calm_breather. ambush_spike_run only rarely if hp=3 and dash ready. narrow_gauntlet if dash ready and hp>=2. calm_breather if hp=1 or hurts>=2.`,
      criteria: {
        none: "No set-piece — keep composing normal slabs",
        ambush_spike_run: "One short spike slab — rare magenta sting. Need hp=3",
        orb_fountain: "Arc of extra orbs, a visible gift",
        narrow_gauntlet: "Three ~1s ledges with hops — still a dash check, but each pad is landable",
        calm_breather: "Long safe slab, a breather",
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
