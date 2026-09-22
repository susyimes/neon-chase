/**
 * Pit cadence + 2-tile jump assertions.
 * Run: npm test
 */
import { jumpClearanceDump, JUMP_COYOTE_MS, JUMP_VELOCITY, PIT_CLEAR_WIDTH_PX } from "../shared/jump.ts";
import {
  measureLethalPitCadence,
  PIT_SAFE_RUNWAY_PX,
  PIT_TARGET_SPACING_PX,
  walkPacedStreet,
} from "../shared/pits.ts";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const report = measureLethalPitCadence(72);
const jump = jumpClearanceDump();
const opening = walkPacedStreet(8).map((pad) => pad.gap);

assert(report.runwayClear, "runway pads must stay gap 0");
assert(report.firstPitLipX >= PIT_SAFE_RUNWAY_PX, `first pit ${report.firstPitLipX} is inside the 2s runway`);
assert(
  report.firstPitLipX <= PIT_SAFE_RUNWAY_PX + 280,
  `first pit ${report.firstPitLipX}px should be the first lip past the 2s runway (was ~1200 / 32m)`,
);
assert(report.firstPitDistanceTiles < 32, `first pit is still ${report.firstPitDistanceTiles} tiles (want < 32)`);
assert(opening[0] === 0, `opening[0] should be runway, got ${opening.join(",")}`);
assert(opening.includes(2), `opening 8 should contain one 2-tile pit, got ${opening.join(",")}`);
assert(
  report.bands.early.count >= 2 && report.bands.mid.count >= 3 && report.bands.late.count >= 4,
  `need enough pits per band: early=${report.bands.early.count} mid=${report.bands.mid.count} late=${report.bands.late.count}`,
);
assert(
  report.bands.early.meanPx > report.bands.mid.meanPx,
  `early mean ${report.bands.early.meanPx} should be > mid ${report.bands.mid.meanPx}`,
);
assert(
  report.bands.mid.meanPx > report.bands.late.meanPx,
  `mid mean ${report.bands.mid.meanPx} should be > late ${report.bands.late.meanPx}`,
);

const near = (got: number, target: number, slack: number, label: string) => {
  assert(
    Math.abs(got - target) <= slack,
    `${label} mean ${got}px is not near target ${target}px (±${slack})`,
  );
};
near(report.bands.early.meanPx, PIT_TARGET_SPACING_PX.early, 280, "early");
near(report.bands.mid.meanPx, PIT_TARGET_SPACING_PX.mid, 280, "mid");
near(report.bands.late.meanPx, PIT_TARGET_SPACING_PX.late, 240, "late");

assert(jump.cases.fromEdge, "edge takeoff must clear an 80px pit");
assert(jump.cases.fromApproachTile, "takeoff from the last 40px must clear an 80px pit");
assert(jump.cases.fromTwoTilesBack, "takeoff from 80px before the lip must clear an 80px pit");
assert(jump.cases.coyoteLate, "coyote jump just past the lip must clear an 80px pit");
assert(!jump.cases.fromPadCenter, "pad-center jump must still miss — pits are not trivial");
assert(JUMP_VELOCITY === -580, "document jump tune: JUMP_VELOCITY is -580");
assert(JUMP_COYOTE_MS === 140, "document jump tune: coyote is 140ms");
assert(jump.pitPx === PIT_CLEAR_WIDTH_PX && jump.pitPx === 80, "injected pits stay 80px / 2 tiles");

const dump = {
  firstPit: {
    lipX: report.firstPitLipX,
    distanceTiles: report.firstPitDistanceTiles,
    travelSecondsFromOrigin: report.firstPitTravelSecondsFromOrigin,
    openingGaps: opening,
  },
  spacing: {
    early: { meanPx: report.bands.early.meanPx, meanSeconds: report.bands.early.meanSeconds, count: report.bands.early.count },
    mid: { meanPx: report.bands.mid.meanPx, meanSeconds: report.bands.mid.meanSeconds, count: report.bands.mid.count },
    late: { meanPx: report.bands.late.meanPx, meanSeconds: report.bands.late.meanSeconds, count: report.bands.late.count },
  },
  jump,
};
console.log(JSON.stringify(dump, null, 2));
console.log("assert-pits: ok");
