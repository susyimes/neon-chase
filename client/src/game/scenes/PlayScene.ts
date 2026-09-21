import Phaser from "phaser";
import type { CompactGameState, HunterMove } from "@shared/types.ts";
import {
  BUFFER_SCREENS,
  GAME_HEIGHT,
  GAME_WIDTH,
  GRAVITY,
  HUNTER_TICK_MS,
  MAX_HP,
  ORB_SCORE,
  TERRAIN_BATCH,
  TILE,
} from "../../config.ts";
import type { ControlState } from "../entities/Player.ts";
import { Hunter } from "../entities/Hunter.ts";
import { Player } from "../entities/Player.ts";
import { safeSpecs } from "../world/fallback.ts";
import { TerrainWorld } from "../world/TerrainWorld.ts";
import type { JevService } from "../../jev/client.ts";

export interface PlayHooks {
  jev: JevService;
  controls: ControlState;
  onHud: (snap: HudSnapshot) => void;
  onGameOver: (result: RunResult) => void;
}

export interface HudSnapshot {
  score: number;
  hp: number;
  maxHp: number;
  latencyMs: number;
  callCount: number;
  source: "jev" | "fallback" | "none";
  warning: string | null;
  hunterMove: string;
}

export interface RunResult {
  score: number;
  distance: number;
  callCount: number;
}

export class PlayScene extends Phaser.Scene {
  static readonly KEY = "play";

  private hooks!: PlayHooks;
  private world!: TerrainWorld;
  private player!: Player;
  private hunter!: Hunter;
  private keys!: {
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    up: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    shift: Phaser.Input.Keyboard.Key;
  };
  private hunterDue = 0;
  private terrainBusy = false;
  private hunterBusy = false;
  private ended = false;
  private orbsCollected = 0;

  constructor() {
    super(PlayScene.KEY);
  }

  init(data: PlayHooks): void {
    this.hooks = data;
  }

  create(): void {
    this.ended = false;
    this.orbsCollected = 0;
    this.hooks.jev.callCount = 0;
    this.hooks.jev.warning = null;
    this.hooks.jev.lastSource = "none";

    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, 0, Number.MAX_SAFE_INTEGER, GAME_HEIGHT + 80);
    this.cameras.main.setBackgroundColor(0x050510);
    this.paintBackdrop();
    this.makeTextures();

    this.world = new TerrainWorld(this);
    this.world.append(safeSpecs(8), "fallback");

    const spawn = this.world.lastSafeX();
    const playerSprite = this.physics.add.sprite(spawn.x, spawn.y, "runner");
    this.player = new Player(playerSprite);
    this.player.spawn(spawn.x, spawn.y);

    const hunterSprite = this.physics.add.sprite(spawn.x - 160, spawn.y - 20, "hunter");
    this.hunter = new Hunter(hunterSprite);
    this.hunter.apply("chase", this.player.x, this.player.y, 0);

    this.physics.add.collider(this.player.sprite, this.world.platforms);
    this.physics.add.overlap(this.player.sprite, this.world.spikes, () => this.hitHazard());
    this.physics.add.overlap(this.player.sprite, this.world.orbs, (_p, orb) => {
      const obj = orb as Phaser.GameObjects.GameObject;
      if (!obj.active) return;
      this.orbsCollected += 1;
      obj.destroy();
    });
    this.physics.add.overlap(this.player.sprite, this.hunter.sprite, () => this.hitHazard(true));

    this.cameras.main.startFollow(this.player.sprite, true, 0.14, 0.1);
    this.cameras.main.setFollowOffset(-240, 30);
    this.cameras.main.setDeadzone(60, 90);

    const kb = this.input.keyboard;
    if (!kb) throw new Error("Keyboard plugin missing");
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      shift: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    };

    this.hunterDue = this.time.now + HUNTER_TICK_MS;
    this.pullDecisions(true, true);
    this.emitHud();
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;

    const controls = this.readControls();
    this.player.update(this.time.now, controls);
    this.hunter.update(delta / 1000, this.player.x, this.player.y, this.player.vy);

    if (this.player.sprite.y > GAME_HEIGHT + 50) {
      this.player.hurt(this.time.now, 0);
      if (this.player.hp <= 0) {
        this.finish();
        return;
      }
      const safe = this.world.lastSafeX();
      this.player.spawn(Math.max(safe.x, this.cameras.main.scrollX + 80), safe.y);
    }

    this.world.cull(this.cameras.main.scrollX);
    this.maybeRequest();
    this.emitHud();
  }

  private readControls(): ControlState {
    const c = this.hooks.controls;
    return {
      left: c.left || this.keys.left.isDown || this.keys.a.isDown,
      right: c.right || this.keys.right.isDown || this.keys.d.isDown,
      jump: c.jump || this.keys.up.isDown || this.keys.w.isDown || this.keys.space.isDown,
      dash: c.dash || this.keys.shift.isDown,
    };
  }

  private score(): number {
    return Math.floor(this.player.maxX / 8) + this.orbsCollected * ORB_SCORE;
  }

  private compactState(): CompactGameState {
    return {
      player: {
        x: Math.round(this.player.x),
        y: Math.round(this.player.y),
        vx: Math.round(this.player.vx),
        vy: Math.round(this.player.vy),
        hp: this.player.hp,
        dash: this.player.dashReady,
      },
      hunter: {
        x: Math.round(this.hunter.x),
        aggression: Number(this.hunter.aggression.toFixed(2)),
      },
      ahead: this.world.aheadEncoding(this.player.x),
      score: this.score(),
    };
  }

  private maybeRequest(): void {
    const needTerrain = this.world.remainingScreens(this.cameras.main.scrollX) < BUFFER_SCREENS;
    const needHunter = this.time.now >= this.hunterDue;

    if (needTerrain && !this.terrainBusy) {
      void this.pullDecisions(true, needHunter || !this.hunterBusy);
      return;
    }
    if (needHunter && !this.hunterBusy && !this.terrainBusy) {
      void this.pullDecisions(false, true);
    }
  }

  private async pullDecisions(terrain: boolean, hunter: boolean): Promise<void> {
    if (terrain) this.terrainBusy = true;
    if (hunter) this.hunterBusy = true;

    const result = await this.hooks.jev.decide({
      state: this.compactState(),
      ask: {
        terrainSegments: terrain ? TERRAIN_BATCH : 0,
        hunter,
      },
    });

    if (!this.sys.isActive() || this.ended) return;

    if (terrain && result.terrain.length) {
      this.world.append(result.terrain, result.source);
    }
    if (hunter && result.hunterMove) {
      this.applyHunter(result.hunterMove);
    }

    if (terrain) this.terrainBusy = false;
    if (hunter) this.hunterBusy = false;
    this.emitHud();
  }

  private applyHunter(move: HunterMove): void {
    this.hunter.apply(move, this.player.x, this.player.y, this.player.vy, this.score());
    this.hunterDue = this.time.now + HUNTER_TICK_MS;
  }

  private hitHazard(fromHunter = false): void {
    if (this.ended) return;
    const knocked = this.player.hurt(this.time.now, fromHunter ? -240 : -120);
    if (!knocked) return;
    this.cameras.main.flash(80, 255, 43, 214, false);
    if (fromHunter) this.hunter.sprite.x -= 130;
    if (this.player.hp <= 0) this.finish();
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.player.sprite.setVelocity(0, 0);
    this.hooks.onGameOver({
      score: this.score(),
      distance: Math.floor(this.player.maxX / TILE),
      callCount: this.hooks.jev.callCount,
    });
  }

  private emitHud(): void {
    this.hooks.onHud({
      score: this.score(),
      hp: this.player.hp,
      maxHp: MAX_HP,
      latencyMs: this.hooks.jev.lastLatencyMs,
      callCount: this.hooks.jev.callCount,
      source: this.hooks.jev.lastSource,
      warning: this.hooks.jev.warning,
      hunterMove: this.hunter.move,
    });
  }

  private paintBackdrop(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(0x050510, 0x050510, 0x0b1024, 0x140818, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.setScrollFactor(0);

    for (let i = 0; i < 48; i += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(0, GAME_WIDTH * 3),
        Phaser.Math.Between(20, GAME_HEIGHT - 40),
        Phaser.Math.FloatBetween(0.6, 1.8),
        i % 3 === 0 ? 0xff2bd6 : 0x00f0ff,
        0.45,
      );
      star.setScrollFactor(0.15 + (i % 4) * 0.05);
    }

    const fog = this.add.rectangle(0, GAME_HEIGHT - 70, GAME_WIDTH, 90, 0xff2bd6, 0.05).setOrigin(0, 0);
    fog.setScrollFactor(0);
  }

  private makeTextures(): void {
    const runner = this.add.graphics();
    runner.fillStyle(0x00f0ff, 1);
    runner.fillRoundedRect(2, 2, 24, 34, 7);
    runner.fillStyle(0x050510, 1);
    runner.fillRect(8, 10, 5, 5);
    runner.fillRect(16, 10, 5, 5);
    runner.generateTexture("runner", 28, 38);
    runner.destroy();

    const hunter = this.add.graphics();
    hunter.fillStyle(0xff2bd6, 1);
    hunter.fillTriangle(16, 2, 30, 30, 2, 30);
    hunter.fillStyle(0x050510, 1);
    hunter.fillTriangle(16, 10, 22, 24, 10, 24);
    hunter.generateTexture("hunter", 32, 32);
    hunter.destroy();
  }
}
