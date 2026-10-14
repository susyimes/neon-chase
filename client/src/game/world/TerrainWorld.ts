import { i18n, t, type Message } from "../../i18n.ts";
import Phaser from "phaser";
import type {
  DirectorPlan,
  EventBeat,
  GapChoice,
  MotifKind,
  TerrainSegmentSpec,
} from "@shared/types.ts";
import { walkableDwellSeconds, walkableWidthPx, WALKABLE_PAD_TILES } from "@shared/pads.ts";
import { isLethalPit, pitBandAt, shapeGap, type PitBand } from "@shared/pits.ts";
import {
  AUTO_RUN,
  DEBUG_PAD_LABELS,
  DEBUG_PIT_DUMP,
  GAME_HEIGHT,
  GAME_WIDTH,
  SPIKE_NUB_KEEP,
  SPIKE_SURFACE_KEEP,
  TILE,
} from "../../config.ts";
import { MOTIF_PALETTES, type MotifPalette } from "../../palette.ts";

export interface BuiltSegment {
  spec: TerrainSegmentSpec;
  source: "jev" | "fallback";
  startX: number;
  endX: number;
  platformY: number;
  /** Standing X on the collider; omitted for orb-only / non-walkable slices. */
  safeX: number;
  /** True when this slice has a real platform body (not an orb fountain). */
  walkable: boolean;
  objects: Phaser.GameObjects.GameObject[];
}

export class TerrainWorld {
  readonly segments: BuiltSegment[] = [];
  cursorX = 0;
  platforms: Phaser.Physics.Arcade.StaticGroup;
  spikes: Phaser.Physics.Arcade.StaticGroup;
  orbs: Phaser.Physics.Arcade.Group;
  motif: MotifKind = "neon_alley";
  lastEvent: EventBeat = "none";
  private spikeSurfaceSeen = 0;
  private nubCandidates = 0;
  /** World X of the last **lethal** (2-tile) pit lip. Cadence clock for `shapeGap`. */
  private lastPitLipX = 0;
  /** Next pad should paint a landing-lip highlight (previous slice ended in a hole). */
  private pendingLandingLip = false;
  /** Lethal pits this run (survives cull) — playtest dump. */
  readonly pitLog: { lipX: number; gap: number; band: PitBand }[] = [];

  constructor(private readonly scene: Phaser.Scene) {
    this.platforms = scene.physics.add.staticGroup();
    this.spikes = scene.physics.add.staticGroup();
    this.orbs = scene.physics.add.group({ allowGravity: false });
  }

  remainingScreens(cameraX: number): number {
    const last = this.segments[this.segments.length - 1];
    if (!last) return 0;
    return (last.endX - cameraX) / GAME_WIDTH;
  }

  aheadEncoding(fromX: number): string[] {
    const out: string[] = [];
    for (const seg of this.segments) {
      if (seg.endX < fromX) continue;
      out.push(`${seg.spec.surface}:${seg.spec.width}`);
      if (seg.spec.gap > 0) out.push(`gap:${seg.spec.gap}`);
      if (out.length >= 8) break;
    }
    return out;
  }

  lastSafeX(): { x: number; y: number } {
    return this.safeSpawn() ?? { x: 80, y: GAME_HEIGHT - 5 * TILE - 28 };
  }

  /**
   * Standing point on a real walkable pad (not spikes, not orb-only slices).
   * Default is the first pad — a new run starts at the beginning of the street.
   * When `fromX` is set, prefer the rightmost pad that starts at or behind the
   * player (used if a mid-run placement is ever needed).
   */
  safeSpawn(fromX?: number): { x: number; y: number } | null {
    const pads = this.segments.filter((seg) => seg.walkable && seg.spec.surface !== "spike");
    if (!pads.length) return null;
    if (fromX != null) {
      for (let i = pads.length - 1; i >= 0; i -= 1) {
        const seg = pads[i];
        if (seg.startX <= fromX) {
          return { x: seg.safeX, y: seg.platformY - 28 };
        }
      }
    }
    const first = pads[0];
    return { x: first.safeX, y: first.platformY - 28 };
  }

  /** Live pit cadence for `__neonChase.pits()` / `?pits=1`. */
  pitTelemetry(): {
    cursorX: number;
    lastPitLipX: number;
    firstPitLipX: number | null;
    firstPitDistanceTiles: number | null;
    gaps: number[];
    pits: { lipX: number; gap: number; band: PitBand }[];
  } {
    const first = this.pitLog[0];
    return {
      cursorX: Math.round(this.cursorX),
      lastPitLipX: Math.round(this.lastPitLipX),
      firstPitLipX: first ? Math.round(first.lipX) : null,
      firstPitDistanceTiles: first ? Math.floor(first.lipX / TILE) : null,
      gaps: this.segments.map((seg) => seg.spec.gap),
      pits: this.pitLog.map((pit) => ({ ...pit, lipX: Math.round(pit.lipX) })),
    };
  }

  append(specs: TerrainSegmentSpec[], source: "jev" | "fallback", plan?: DirectorPlan): void {
    if (plan) {
      this.motif = plan.composition.motif;
      this.stampEvent(plan, source);
      if (plan.composition.fakeout) this.buildFakeout(source);
    }
    for (const spec of specs) {
      this.buildOne(spec, source, plan);
    }
  }

  cull(cameraX: number): void {
    const cutoff = cameraX - GAME_WIDTH;
    while (this.segments.length > 0 && this.segments[0].endX < cutoff) {
      const gone = this.segments.shift();
      gone?.objects.forEach((obj) => obj.destroy());
    }
  }

  private stampEvent(plan: DirectorPlan, source: "jev" | "fallback"): void {
    this.lastEvent = plan.event;
    const h = this.segments.at(-1)?.spec.height ?? 5;
    if (plan.event === "calm_breather") {
      this.buildOne({ surface: "solid", width: 10, gap: 0, height: 5 }, source, plan, true);
    } else if (plan.event === "narrow_gauntlet") {
      for (let i = 0; i < 3; i += 1) {
        this.buildOne({ surface: "ledge", width: WALKABLE_PAD_TILES, gap: 1, height: h }, source, plan, true);
      }
    } else if (plan.event === "ambush_spike_run") {
      // Was two slabs (5+3 spike tiles). One short slab is ~1/3 of that.
      this.buildOne({ surface: "spike", width: 3, gap: 1, height: h }, source, plan, true);
    } else if (plan.event === "orb_fountain") {
      this.spawnFountain(this.cursorX + 90, GAME_HEIGHT - h * TILE - 90);
    }
  }

  private buildFakeout(source: "jev" | "fallback"): void {
    const pal = MOTIF_PALETTES[this.motif];
    const startX = this.cursorX;
    const width = walkableWidthPx(WALKABLE_PAD_TILES, "ledge", TILE);
    const decoy = width + TILE * 2;
    const platformY = GAME_HEIGHT - 6 * TILE;
    const glow = this.scene.add
      .rectangle(startX - 6, platformY - 5, decoy + 12, 16, pal.platEdge, 0.22)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const body = this.scene.add
      .rectangle(startX, platformY, width, 16, pal.plat)
      .setOrigin(0, 0);
    const lip = this.scene.add
      .rectangle(startX - 4, platformY, decoy, 3, pal.platEdge, 0.85)
      .setOrigin(0, 0);
    this.scene.physics.add.existing(body, true);
    this.platforms.add(body);
    const objects: Phaser.GameObjects.GameObject[] = [glow, body, lip];
    if (this.pendingLandingLip) this.paintLandingLip(objects, startX, platformY, 16, pal);
    this.paintApproachWarn(objects, startX, width, platformY, 16, pal);
    this.paintPit(objects, startX + width, TILE, platformY, pal);
    // Fake-out is a 1-tile hop — do not tick the lethal-pit clock.
    this.pendingLandingLip = true;
    this.paintPadLabel(objects, startX, platformY, width, "ledge", 1);
    this.cursorX = startX + width + TILE;
    this.segments.push({
      spec: { surface: "ledge", width: WALKABLE_PAD_TILES, gap: 1, height: 6 },
      source,
      startX,
      endX: this.cursorX,
      platformY,
      safeX: startX + width * 0.45,
      walkable: true,
      objects,
    });
  }

  private buildOne(
    spec: TerrainSegmentSpec,
    source: "jev" | "fallback",
    plan?: DirectorPlan,
    fromEvent = false,
  ): void {
    const pal = MOTIF_PALETTES[this.motif];
    const startX = this.cursorX;
    const surface = this.effectiveSurface(spec, fromEvent);
    const width = walkableWidthPx(spec.width, surface, TILE);
    const tiles = Math.round(width / TILE);
    const thickness = surface === "ledge" ? 14 : 22;
    const platformY = GAME_HEIGHT - spec.height * TILE;
    const lipX = startX + width;
    const gapTiles: GapChoice = fromEvent ? clampAuthoredGap(spec.gap) : shapeGap(spec.gap, lipX, this.lastPitLipX);
    const color = surface === "spike" ? 0x2a0818 : pal.plat;
    const edge = surface === "spike" ? pal.spike : pal.platEdge;

    const glow = this.scene.add
      .rectangle(startX - 8, platformY - 8, width + 16, 20, edge, surface === "spike" ? 0.5 : 0.32)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const body = this.scene.add.rectangle(startX, platformY, width, thickness, color).setOrigin(0, 0);
    const face = this.scene.add
      .rectangle(startX, platformY + 3, width, thickness - 3, surface === "spike" ? 0x14040c : 0x000000, surface === "spike" ? 0.35 : 0.22)
      .setOrigin(0, 0);
    const lip = this.scene.add.rectangle(startX, platformY, width, 4, edge, 1).setOrigin(0, 0);
    const sheen = this.scene.add
      .rectangle(startX, platformY + 4, width, 2, 0xffffff, surface === "spike" ? 0.08 : 0.18)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const under = this.scene.add
      .rectangle(startX, platformY + thickness, width, 6, 0x000000, 0.45)
      .setOrigin(0, 0);
    this.scene.physics.add.existing(body, true);
    this.platforms.add(body);

    const objects: Phaser.GameObjects.GameObject[] = [glow, body, face, lip, sheen, under];

    if (this.pendingLandingLip) this.paintLandingLip(objects, startX, platformY, thickness, pal);
    if (surface === "spike") this.paintSpikeSlab(objects, startX, width, platformY, thickness, pal);

    this.paintPadLabel(objects, startX, platformY, width, surface, gapTiles);

    if (surface === "spike") {
      const count = tiles;
      for (let i = 0; i < count; i += 1) {
        objects.push(...this.spikeAt(startX + i * TILE + TILE / 2, platformY, pal.spike));
      }
    }

    const density = plan?.composition.hazardDensity ?? "low";
    if (surface !== "spike" && (density === "high" || (density === "mid" && tiles >= WALKABLE_PAD_TILES))) {
      this.nubCandidates += 1;
      const period = Math.max(1, Math.round(1 / SPIKE_NUB_KEEP));
      if (this.nubCandidates % period === 0) {
        const sx = startX + width * 0.62;
        objects.push(...this.spikeAt(sx, platformY, pal.spike));
      }
    }

    this.placeOrbs({ ...spec, surface, width: tiles, gap: gapTiles }, source, startX, width, platformY, plan, fromEvent, objects);

    if (gapTiles > 0) {
      this.paintApproachWarn(objects, startX, width, platformY, thickness, pal);
      this.paintPit(objects, lipX, gapTiles * TILE, platformY, pal);
      if (isLethalPit(gapTiles)) {
        this.lastPitLipX = lipX;
        this.pitLog.push({ lipX, gap: gapTiles, band: pitBandAt(lipX) });
      }
      this.pendingLandingLip = true;
    } else {
      this.pendingLandingLip = false;
    }

    const gap = gapTiles * TILE;
    const endX = startX + width + gap;
    this.cursorX = endX;
    this.segments.push({
      spec: { ...spec, surface, width: tiles, gap: gapTiles },
      source,
      startX,
      endX,
      platformY,
      safeX: startX + width * 0.45,
      walkable: surface !== "spike",
      objects,
    });
  }

  private paintPadLabel(
    objects: Phaser.GameObjects.GameObject[],
    startX: number,
    platformY: number,
    width: number,
    surface: TerrainSegmentSpec["surface"],
    gapTiles = 0,
  ): void {
    if ((!DEBUG_PAD_LABELS && !DEBUG_PIT_DUMP) || surface === "spike") return;
    const tiles = Math.round(width / TILE);
    const dwell = walkableDwellSeconds(width, AUTO_RUN);
    const copy = (): Message => ({ key: "padLabel", params: { tiles, seconds: dwell.toFixed(2), pit: gapTiles > 0 ? t("pitLabel", { tiles: gapTiles }) : "" } });
    const label = this.scene.add
      .text(startX + 8, platformY - 18, t(copy().key, copy().params), {
        fontFamily: '"Noto Sans SC", "Microsoft YaHei", monospace',
        fontSize: "11px",
        color: "#7ef9ff",
      })
      .setOrigin(0, 1)
      .setDepth(8)
      .setAlpha(0.85);
    this.localizeLabel(label, copy);
    objects.push(label);
  }

  /** Update existing debug canvas text even while paused; release listeners on cull/shutdown. */
  private localizeLabel(label: Phaser.GameObjects.Text, copy: () => Message): void {
    const unsubscribe = i18n.subscribe(() => {
      const message = copy();
      label.setText(t(message.key, message.params));
    });
    label.once(Phaser.GameObjects.Events.DESTROY, unsubscribe);
  }

  /** Keep ~SPIKE_SURFACE_KEEP of Jev spike slabs; event spikes stay as authored. */
  private effectiveSurface(spec: TerrainSegmentSpec, fromEvent: boolean): TerrainSegmentSpec["surface"] {
    if (spec.surface !== "spike" || fromEvent) return spec.surface;
    this.spikeSurfaceSeen += 1;
    const period = Math.max(1, Math.round(1 / SPIKE_SURFACE_KEEP));
    return this.spikeSurfaceSeen % period === 0 ? "spike" : "solid";
  }

  private paintPit(
    objects: Phaser.GameObjects.GameObject[],
    lipX: number,
    gapPx: number,
    platformY: number,
    pal: MotifPalette,
  ): void {
    const wellH = GAME_HEIGHT - platformY + 18;
    const voidInk = this.scene.add
      .rectangle(lipX, platformY, gapPx, wellH, 0x050308, 0.94)
      .setOrigin(0, 0)
      .setDepth(3);
    const wash = this.scene.add
      .rectangle(lipX, platformY, gapPx, Math.min(56, wellH), pal.accent, 0.16)
      .setOrigin(0, 0)
      .setDepth(3)
      .setBlendMode(Phaser.BlendModes.ADD);
    const rail = this.scene.add
      .rectangle(lipX, platformY, gapPx, 3, pal.accent, 0.85)
      .setOrigin(0, 0)
      .setDepth(4);
    objects.push(voidInk, wash, rail);

    const step = 14;
    for (let x = lipX + 6; x < lipX + gapPx - 6; x += step) {
      const chevron = this.scene.add
        .triangle(x + 5, platformY + 16, 0, 0, 10, 0, 5, 11, pal.accent, 0.72)
        .setDepth(4);
      this.scene.tweens.add({
        targets: chevron,
        alpha: { from: 0.28, to: 0.88 },
        y: { from: platformY + 14, to: platformY + 22 },
        duration: 420,
        yoyo: true,
        repeat: -1,
      });
      objects.push(chevron);
    }

    if (DEBUG_PIT_DUMP) {
      const tiles = Math.round(gapPx / TILE);
      const stamp = this.scene.add
        .text(lipX + gapPx / 2, platformY + 28, t("pitStamp", { tiles, pixels: gapPx }), {
          fontFamily: '"Noto Sans SC", "Microsoft YaHei", monospace',
          fontSize: "10px",
          color: "#7ef9ff",
        })
        .setOrigin(0.5, 0)
        .setDepth(5)
        .setAlpha(0.9);
      this.localizeLabel(stamp, () => ({ key: "pitStamp", params: { tiles, pixels: gapPx } }));
      objects.push(stamp);
    }

    const leftCliff = this.scene.add
      .rectangle(lipX - 5, platformY - 7, 6, 18, pal.platEdge, 1)
      .setOrigin(0, 0)
      .setDepth(4);
    const leftGlow = this.scene.add
      .rectangle(lipX - 12, platformY - 12, 16, 26, pal.platEdge, 0.42)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
    const rightCliff = this.scene.add
      .rectangle(lipX + gapPx - 1, platformY - 7, 6, 18, pal.platEdge, 1)
      .setOrigin(0, 0)
      .setDepth(4);
    const rightGlow = this.scene.add
      .rectangle(lipX + gapPx - 4, platformY - 12, 16, 26, pal.platEdge, 0.42)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
    objects.push(leftCliff, leftGlow, rightCliff, rightGlow);
  }

  private paintApproachWarn(
    objects: Phaser.GameObjects.GameObject[],
    startX: number,
    width: number,
    platformY: number,
    thickness: number,
    pal: MotifPalette,
  ): void {
    const zoneW = Math.min(TILE, width * 0.35);
    const zone = this.scene.add
      .rectangle(startX + width - zoneW, platformY, zoneW, thickness, 0x1a0810, 0.62)
      .setOrigin(0, 0)
      .setDepth(3);
    const hash = this.scene.add
      .rectangle(startX + width - zoneW, platformY, zoneW, 4, pal.accent, 0.95)
      .setOrigin(0, 0)
      .setDepth(4);
    objects.push(zone, hash);
  }

  private paintLandingLip(
    objects: Phaser.GameObjects.GameObject[],
    startX: number,
    platformY: number,
    thickness: number,
    pal: MotifPalette,
  ): void {
    const lip = this.scene.add
      .rectangle(startX - 2, platformY - 7, 8, thickness + 12, pal.platEdge, 1)
      .setOrigin(0, 0)
      .setDepth(4);
    const glow = this.scene.add
      .rectangle(startX - 8, platformY - 12, 18, thickness + 20, pal.platEdge, 0.38)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
    objects.push(lip, glow);
  }

  private paintSpikeSlab(
    objects: Phaser.GameObjects.GameObject[],
    startX: number,
    width: number,
    platformY: number,
    thickness: number,
    pal: MotifPalette,
  ): void {
    const rail = this.scene.add
      .rectangle(startX, platformY - 3, width, 5, pal.spike, 1)
      .setOrigin(0, 0)
      .setDepth(4);
    const pulse = this.scene.add
      .rectangle(startX - 6, platformY - 10, width + 12, thickness + 16, pal.spike, 0.28)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(3);
    this.scene.tweens.add({
      targets: pulse,
      alpha: { from: 0.18, to: 0.55 },
      duration: 360,
      yoyo: true,
      repeat: -1,
    });
    objects.push(rail, pulse);
  }

  private spikeAt(sx: number, platformY: number, color: number): Phaser.GameObjects.GameObject[] {
    const glow = this.scene.add
      .triangle(sx, platformY + 2, 0, 24, 10, 0, 20, 24, color, 0.42)
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(4);
    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.28, to: 0.75 },
      duration: 340,
      yoyo: true,
      repeat: -1,
    });
    const spike = this.scene.add.triangle(sx, platformY, 0, 18, 8, 0, 16, 18, color);
    spike.setOrigin(0.5, 1);
    spike.setDepth(5);
    const tip = this.scene.add.triangle(sx, platformY - 8, 0, 8, 4, 0, 8, 8, 0xffe6fb, 0.95);
    tip.setOrigin(0.5, 1);
    tip.setDepth(5);
    const hit = this.scene.add.rectangle(sx, platformY - 8, 14, 14, color, 0);
    this.scene.physics.add.existing(hit, true);
    this.spikes.add(hit);
    return [glow, spike, tip, hit];
  }

  private placeOrbs(
    spec: TerrainSegmentSpec,
    source: "jev" | "fallback",
    startX: number,
    width: number,
    platformY: number,
    plan: DirectorPlan | undefined,
    fromEvent: boolean,
    objects: Phaser.GameObjects.GameObject[],
  ): void {
    const style = plan?.composition.orbStyle ?? (source === "jev" ? "trail" : "trail");
    const canOrb = spec.surface !== "spike" || spec.width >= 3;
    const rhythm = plan?.composition.rhythm ?? "easy";
    if (!canOrb && style !== "high_risk") return;
    if (source === "fallback" && spec.width < WALKABLE_PAD_TILES && !fromEvent) return;

    if (style === "cluster" && spec.surface !== "spike") {
      const cx = startX + width * 0.55;
      const cy = platformY - 50;
      objects.push(this.makeOrb(cx, cy), this.makeOrb(cx - 16, cy + 12), this.makeOrb(cx + 16, cy + 12));
      return;
    }

    if (style === "high_risk") {
      const ox = startX + width + Math.max(18, spec.gap * TILE * 0.5);
      const oy = platformY - (spec.surface === "spike" ? 64 : 54);
      objects.push(this.makeOrb(ox, oy));
      return;
    }

    const count = rhythm === "easy" || spec.width >= 8 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const t = count === 1 ? 0.62 : 0.35 + i * 0.32;
      objects.push(this.makeOrb(startX + width * t, platformY - 42));
    }
  }

  private spawnFountain(x: number, y: number): void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI * 0.15 - i * 0.22;
      objects.push(this.makeOrb(x + Math.cos(a) * 70, y + Math.sin(a) * 36));
    }
    this.segments.push({
      spec: { surface: "solid", width: 2, gap: 0, height: 5 },
      source: "jev",
      startX: x - 40,
      endX: x + 40,
      platformY: y + 40,
      safeX: x,
      walkable: false,
      objects,
    });
  }

  private makeOrb(x: number, y: number): Phaser.GameObjects.GameObject {
    const pal = MOTIF_PALETTES[this.motif];
    const orb = this.scene.add.image(x, y, "orb");
    orb.setTint(pal.orb);
    orb.setData("orb", true);
    orb.setBlendMode(Phaser.BlendModes.ADD);
    orb.setDepth(4);
    this.scene.physics.add.existing(orb);
    const orbBody = orb.body as Phaser.Physics.Arcade.Body;
    orbBody.setAllowGravity(false);
    orbBody.setCircle(10, 2, 2);
    this.orbs.add(orb);
    this.scene.tweens.add({
      targets: orb,
      scale: { from: 0.88, to: 1.12 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    return orb;
  }
}

function clampAuthoredGap(value: number): GapChoice {
  return value === 1 || value === 2 ? value : 0;
}
