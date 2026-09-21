import Phaser from "phaser";
import type {
  DirectorPlan,
  EventBeat,
  MotifKind,
  TerrainSegmentSpec,
} from "@shared/types.ts";
import { GAME_HEIGHT, GAME_WIDTH, SPIKE_NUB_KEEP, SPIKE_SURFACE_KEEP, TILE } from "../../config.ts";
import { MOTIF_PALETTES } from "../../palette.ts";

export interface BuiltSegment {
  spec: TerrainSegmentSpec;
  source: "jev" | "fallback";
  startX: number;
  endX: number;
  platformY: number;
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
    for (let i = this.segments.length - 1; i >= 0; i -= 1) {
      const seg = this.segments[i];
      if (seg.spec.surface !== "spike") {
        return { x: seg.startX + TILE, y: seg.platformY - 28 };
      }
    }
    return { x: 80, y: GAME_HEIGHT - 5 * TILE - 28 };
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
      this.buildOne({ surface: "solid", width: 5, gap: 0, height: 5 }, source, plan, true);
    } else if (plan.event === "narrow_gauntlet") {
      for (let i = 0; i < 3; i += 1) {
        this.buildOne({ surface: "ledge", width: 2, gap: 1, height: h }, source, plan, true);
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
    const width = TILE * 3;
    const platformY = GAME_HEIGHT - 6 * TILE;
    const glow = this.scene.add
      .rectangle(startX - 6, platformY - 5, width + 12, 16, pal.platEdge, 0.22)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const body = this.scene.add
      .rectangle(startX, platformY, TILE, 16, pal.plat)
      .setOrigin(0, 0);
    const lip = this.scene.add
      .rectangle(startX - 4, platformY, width, 3, pal.platEdge, 0.85)
      .setOrigin(0, 0);
    this.scene.physics.add.existing(body, true);
    this.platforms.add(body);
    const objects: Phaser.GameObjects.GameObject[] = [glow, body, lip];
    this.cursorX = startX + TILE + TILE;
    this.segments.push({
      spec: { surface: "ledge", width: 2, gap: 1, height: 6 },
      source,
      startX,
      endX: this.cursorX,
      platformY,
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
    const width = spec.width * TILE;
    const surface = this.effectiveSurface(spec, fromEvent);
    const thickness = surface === "ledge" ? 14 : 22;
    const platformY = GAME_HEIGHT - spec.height * TILE;
    const color = surface === "spike" ? 0x4a1838 : pal.plat;
    const edge = surface === "spike" ? pal.spike : pal.platEdge;

    const glow = this.scene.add
      .rectangle(startX - 8, platformY - 8, width + 16, 20, edge, 0.32)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const body = this.scene.add.rectangle(startX, platformY, width, thickness, color).setOrigin(0, 0);
    const face = this.scene.add
      .rectangle(startX, platformY + 3, width, thickness - 3, 0x000000, 0.22)
      .setOrigin(0, 0);
    const lip = this.scene.add.rectangle(startX, platformY, width, 4, edge, 1).setOrigin(0, 0);
    const sheen = this.scene.add
      .rectangle(startX, platformY + 4, width, 2, 0xffffff, 0.18)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    const under = this.scene.add
      .rectangle(startX, platformY + thickness, width, 6, 0x000000, 0.45)
      .setOrigin(0, 0);
    this.scene.physics.add.existing(body, true);
    this.platforms.add(body);

    const objects: Phaser.GameObjects.GameObject[] = [glow, body, face, lip, sheen, under];

    if (surface === "spike") {
      const count = spec.width;
      for (let i = 0; i < count; i += 1) {
        objects.push(...this.spikeAt(startX + i * TILE + TILE / 2, platformY, pal.spike));
      }
    }

    const density = plan?.composition.hazardDensity ?? "low";
    if (surface !== "spike" && (density === "high" || (density === "mid" && spec.width >= 5))) {
      this.nubCandidates += 1;
      const period = Math.max(1, Math.round(1 / SPIKE_NUB_KEEP));
      if (this.nubCandidates % period === 0) {
        const sx = startX + width * 0.62;
        objects.push(...this.spikeAt(sx, platformY, pal.spike));
      }
    }

    this.placeOrbs({ ...spec, surface }, source, startX, width, platformY, plan, fromEvent, objects);

    const gap = spec.gap * TILE;
    const endX = startX + width + gap;
    this.cursorX = endX;
    this.segments.push({
      spec: { ...spec, surface },
      source,
      startX,
      endX,
      platformY,
      objects,
    });
  }

  /** Keep ~SPIKE_SURFACE_KEEP of Jev spike slabs; event spikes stay as authored. */
  private effectiveSurface(spec: TerrainSegmentSpec, fromEvent: boolean): TerrainSegmentSpec["surface"] {
    if (spec.surface !== "spike" || fromEvent) return spec.surface;
    this.spikeSurfaceSeen += 1;
    const period = Math.max(1, Math.round(1 / SPIKE_SURFACE_KEEP));
    return this.spikeSurfaceSeen % period === 0 ? "spike" : "solid";
  }

  private spikeAt(sx: number, platformY: number, color: number): Phaser.GameObjects.GameObject[] {
    const glow = this.scene.add
      .triangle(sx, platformY + 2, 0, 20, 9, 0, 18, 20, color, 0.28)
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    const spike = this.scene.add.triangle(sx, platformY, 0, 16, 8, 0, 16, 16, color);
    spike.setOrigin(0.5, 1);
    const hit = this.scene.add.rectangle(sx, platformY - 8, 14, 14, color, 0);
    this.scene.physics.add.existing(hit, true);
    this.spikes.add(hit);
    return [glow, spike, hit];
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
    if (source === "fallback" && spec.width !== 5 && !fromEvent) return;

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

    const count = rhythm === "easy" || spec.width === 5 ? 2 : 1;
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
