import { safeDirector } from "../../shared/defaults.ts";
import { LEGACY_WIDTH_TO_WALKABLE, WALKABLE_PAD_TILES } from "../../shared/pads.ts";
import type {
  DecideRequest,
  DecideResponse,
  EventBeat,
  HunterMove,
  HunterStance,
  HunterTactics,
  JuiceCue,
  MotifKind,
  TerrainComposition,
  TerrainSegmentSpec,
} from "../../shared/types.ts";
import {
  EVENT_BEATS,
  GAPS,
  HAZARD_DENSITIES,
  HEIGHTS,
  HUNTER_STANCES,
  HUNTER_VERTICALS,
  JUICE_CUES,
  MOTIFS,
  ORB_STYLES,
  RHYTHMS,
  SURFACES,
  WIDTHS,
} from "../../shared/types.ts";
import { fallbackResult, safeHunterMove } from "./fallback.ts";
import { buildJevBody, clampSegments, JEV_MODEL } from "./questions.ts";

const JEV_URL = "https://api.typesafe.ai/v1/systemone";
const JEV_TIMEOUT_MS = 750;
const FEINT_NOUL = 0.55;

interface JevChoiceAnswer {
  type?: string;
  choice?: string | number;
  score?: number;
  noul?: number;
}

interface JevApiResponse {
  model?: string;
  answers?: Record<string, JevChoiceAnswer>;
}

const STANCE_TO_MOVE: Record<HunterStance, HunterMove> = {
  pressure: "chase",
  bait: "bait",
  cut_off: "jump",
  retreat: "hold",
};

export async function decide(req: DecideRequest): Promise<DecideResponse> {
  const started = Date.now();
  const terrainCount = clampSegments(req.ask.terrainSegments);
  const wantHunter = Boolean(req.ask.hunter);

  if (terrainCount === 0 && !wantHunter) {
    return {
      ok: false,
      source: "fallback",
      latencyMs: Date.now() - started,
      warning: "Nothing to decide",
      terrain: [],
      director: safeDirector({ motif: req.state?.motif }),
    };
  }

  const key = process.env.TYPESAFE_API_KEY?.trim();
  if (!key) {
    return fallbackResult(req, started, "No TYPESAFE_API_KEY — using local terrain");
  }

  const body = buildJevBody(req.state, {
    terrainSegments: terrainCount || undefined,
    hunter: wantHunter,
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), JEV_TIMEOUT_MS);
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return fallbackResult(
        req,
        started,
        `Jev HTTP ${res.status}${detail ? ` — ${detail.slice(0, 120)}` : ""}`,
      );
    }

    const data = (await res.json()) as JevApiResponse;
    const answers = data.answers ?? {};
    const terrain = parseTerrain(answers, terrainCount);
    const hunter = wantHunter ? parseHunter(answers) : undefined;
    const director =
      terrainCount > 0
        ? {
            composition: parseComposition(answers, req.state?.motif),
            difficulty: parseDifficulty(answers.flow),
            event: pick(asChoice(answers.event_beat), EVENT_BEATS, "none" as EventBeat),
            juiceCue: pick(asChoice(answers.juice_cue), JUICE_CUES, "pulse" as JuiceCue),
            hunter,
          }
        : {
            ...safeDirector({ hunter: wantHunter, motif: req.state?.motif }),
            hunter,
            juiceCue: "hush" as JuiceCue,
          };

    return {
      ok: true,
      source: "jev",
      latencyMs: Date.now() - started,
      model: data.model ?? JEV_MODEL,
      terrain,
      hunterMove: hunter?.move,
      director,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Jev timed out — using local terrain"
        : `Jev request failed — ${error instanceof Error ? error.message : "error"}`;
    return fallbackResult(req, started, message);
  }
}

function parseTerrain(
  answers: Record<string, JevChoiceAnswer>,
  count: number,
): TerrainSegmentSpec[] {
  const out: TerrainSegmentSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const p = i === 0 ? "" : `s${i}_`;
    out.push({
      surface: pick(asChoice(answers[`${p}next_surface`]), SURFACES, "solid"),
      width: parseWalkableWidth(asChoice(answers[`${p}width`])),
      gap: pickNum(asChoice(answers[`${p}gap`]), GAPS, 0),
      height: pickNum(asChoice(answers[`${p}height`]), HEIGHTS, 5),
    });
  }
  return out;
}

function parseComposition(
  answers: Record<string, JevChoiceAnswer>,
  motifFallback?: MotifKind,
): TerrainComposition {
  return {
    rhythm: pick(asChoice(answers.rhythm), RHYTHMS, "easy"),
    motif: pick(asChoice(answers.motif), MOTIFS, motifFallback ?? "neon_alley"),
    hazardDensity: pick(asChoice(answers.hazard_density), HAZARD_DENSITIES, "low"),
    orbStyle: pick(asChoice(answers.orb_style), ORB_STYLES, "trail"),
    fakeout: asChoice(answers.fakeout) === "yes",
  };
}

/** Score criteria are 9 levels (indices 0–8) labeled 2–10. */
function parseDifficulty(answer: JevChoiceAnswer | undefined): number {
  const raw = typeof answer?.score === "number" ? answer.score : 1;
  return clamp(Math.round(raw) + 2, 2, 10);
}

function parseHunter(answers: Record<string, JevChoiceAnswer>): HunterTactics {
  const stance = pick(asChoice(answers.hunter_stance), HUNTER_STANCES, "pressure");
  const vertical = pick(asChoice(answers.hunter_vertical), HUNTER_VERTICALS, "level");
  const noul = typeof answers.hunter_feint?.noul === "number" ? answers.hunter_feint.noul : 0;
  const aggScore = typeof answers.hunter_aggression?.score === "number"
    ? answers.hunter_aggression.score
    : 2;
  const aggression = clamp(0.2 + (aggScore / 4) * 0.8, 0.2, 1);
  return {
    stance,
    move: STANCE_TO_MOVE[stance] ?? safeHunterMove(),
    feint: noul > FEINT_NOUL,
    aggression,
    vertical,
  };
}

function asChoice(answer: JevChoiceAnswer | undefined): string | undefined {
  if (answer?.choice === undefined || answer.choice === null) return undefined;
  return String(answer.choice);
}

function pick<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function pickNum<T extends number>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const n = value === undefined ? Number.NaN : Number(value);
  return (allowed as readonly number[]).includes(n) ? (n as T) : fallback;
}

/** Accept 6/8/10, and remap legacy 2/3/5 stubs onto the 1-second scale. */
function parseWalkableWidth(value: string | undefined): number {
  const n = value === undefined ? Number.NaN : Number(value);
  if ((WIDTHS as readonly number[]).includes(n)) return n;
  if (n in LEGACY_WIDTH_TO_WALKABLE) return LEGACY_WIDTH_TO_WALKABLE[n];
  return WALKABLE_PAD_TILES;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

