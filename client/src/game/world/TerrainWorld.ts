import Phaser from "phaser";
import type { TerrainSegmentSpec } from "@shared/types.ts";
import { GAME_HEIGHT, GAME_WIDTH, TILE } from "../../config.ts";

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

  append(specs: TerrainSegmentSpec[], source: "jev" | "fallback"): void {
    for (const spec of specs) {
      this.buildOne(spec, source);
    }
  }

  cull(cameraX: number): void {
    const cutoff = cameraX - GAME_WIDTH;
    while (this.segments.length > 0 && this.segments[0].endX < cutoff) {
      const gone = this.segments.shift();
      gone?.objects.forEach((obj) => obj.destroy());
    }
  }

  private buildOne(spec: TerrainSegmentSpec, source: "jev" | "fallback"): void {
    const startX = this.cursorX;
    const width = spec.width * TILE;
    const thickness = spec.surface === "ledge" ? 12 : 20;
    const platformY = GAME_HEIGHT - spec.height * TILE;
    const color = spec.surface === "spike" ? 0x4a1038 : spec.surface === "ledge" ? 0x123044 : 0x14203a;
    const edge = spec.surface === "spike" ? 0xff2bd6 : 0x00f0ff;

    const body = this.scene.add.rectangle(startX, platformY, width, thickness, color).setOrigin(0, 0);
    const lip = this.scene.add.rectangle(startX, platformY, width, 3, edge, 0.9).setOrigin(0, 0);
    this.scene.physics.add.existing(body, true);
    this.platforms.add(body);

    const objects: Phaser.GameObjects.GameObject[] = [body, lip];

    if (spec.surface === "spike") {
      const count = spec.width;
      for (let i = 0; i < count; i += 1) {
        const sx = startX + i * TILE + TILE / 2;
        const spike = this.scene.add.triangle(sx, platformY, 0, 16, 8, 0, 16, 16, 0xff2bd6);
        spike.setOrigin(0.5, 1);
        const hit = this.scene.add.rectangle(sx, platformY - 8, 14, 14, 0xff2bd6, 0);
        this.scene.physics.add.existing(hit, true);
        this.spikes.add(hit);
        objects.push(spike, hit);
      }
    }

    const canOrb = spec.surface !== "spike" || spec.width >= 3;
    if (canOrb && (source === "jev" ? spec.width !== 2 : spec.width === 5)) {
      const ox = startX + width * (spec.surface === "spike" ? 0.5 : 0.62);
      const oy = platformY - (spec.surface === "spike" ? 56 : 42);
      const orb = this.scene.add.circle(ox, oy, 8, 0x00f0ff, 1);
      orb.setData("orb", true);
      this.scene.physics.add.existing(orb);
      const orbBody = orb.body as Phaser.Physics.Arcade.Body;
      orbBody.setAllowGravity(false);
      orbBody.setCircle(8);
      this.orbs.add(orb);
      objects.push(orb);
    }

    const gap = spec.gap * TILE;
    const endX = startX + width + gap;
    this.cursorX = endX;
    this.segments.push({ spec, source, startX, endX, platformY, objects });
  }
}
