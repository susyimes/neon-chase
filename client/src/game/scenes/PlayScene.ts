import Phaser from "phaser";
import type {
  CompactGameState,
  DirectorPlan,
  EventBeat,
  HunterTactics,
  JuiceCue,
  MotifKind,
} from "@shared/types.ts";
import {
  AUTO_RUN,
  BUFFER_SCREENS,
  COMBO_BONUS,
  COMBO_WINDOW_MS,
  DEBUG_PAD_LABELS,
  GAME_HEIGHT,
  GRAVITY,
  HUNTERS_ENABLED,
  HUNTER_TICK_MS,
  MAX_HP,
  NEAR_MISS_PX,
  ORB_SCORE,
  TERRAIN_BATCH,
  TILE,
} from "../../config.ts";
import { audio } from "../../audio/AudioBus.ts";
import { CYAN, GOLD, MAGENTA } from "../../palette.ts";
import { DISABLED_HUNTER_STATE } from "@shared/defaults.ts";
import type { ControlState } from "../entities/Player.ts";
import { Hunter } from "../entities/Hunter.ts";
import { Player } from "../entities/Player.ts";
import { juice } from "../fx/Juice.ts";
import { makeGameTextures } from "../fx/textures.ts";
import { Backdrop } from "../world/Backdrop.ts";
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
  motif: MotifKind;
  event: EventBeat;
  juiceCue: JuiceCue;
  difficulty: number;
  combo: number;
}

export interface RunResult {
  score: number;
  distance: number;
  callCount: number;
  combo: number;
}

export class PlayScene extends Phaser.Scene {
  static readonly KEY = "play";

  private hooks!: PlayHooks;
  private world!: TerrainWorld;
  private player!: Player;
  private hunter: Hunter | null = null;
  private backdrop!: Backdrop;
  private playerGlow!: Phaser.GameObjects.Image;
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
  private orbBonus = 0;
  private combo = 0;
  private peakCombo = 0;
  private lastOrbAt = 0;
  private hurts = 0;
  private motif: MotifKind = "neon_alley";
  private lastEvent: EventBeat = "none";
  private juiceCue: JuiceCue = "pulse";
  private difficulty = 3;
  private nearMissCool = 0;
  private trailingDash = false;
  private finishing = false;
  private runToken = 0;

  constructor() {
    super(PlayScene.KEY);
  }

  init(data: PlayHooks): void {
    this.hooks = data;
  }

  create(): void {
    this.runToken += 1;
    this.ended = false;
    this.finishing = false;
    this.hunter = null;
    this.hunterBusy = false;
    this.terrainBusy = false;
    this.nearMissCool = 0;
    this.trailingDash = false;
    this.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.orbsCollected = 0;
    this.orbBonus = 0;
    this.combo = 0;
    this.peakCombo = 0;
    this.lastOrbAt = 0;
    this.hurts = 0;
    this.motif = "neon_alley";
    this.lastEvent = "none";
    this.juiceCue = "pulse";
    this.difficulty = 3;
    this.hooks.jev.callCount = 0;
    this.hooks.jev.warning = null;
    this.hooks.jev.lastSource = "none";

    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, 0, Number.MAX_SAFE_INTEGER, GAME_HEIGHT + 80);
    this.cameras.main.resetFX();
    this.cameras.main.setBackgroundColor(0x050510);
    this.cameras.main.fadeIn(280, 5, 5, 16);

    makeGameTextures(this);
    juice.attach(this);
    this.backdrop = new Backdrop(this);
    this.backdrop.setMotif(this.motif);

    this.world = new TerrainWorld(this);
    this.world.append(safeSpecs(8), "fallback");
    if (DEBUG_PAD_LABELS) {
      // Authored as the old 2–3 tile stubs so playtest proves the 1s clamp.
      this.world.append(
        [
          { surface: "ledge", width: 2, gap: 1, height: 6 },
          { surface: "ledge", width: 2, gap: 1, height: 7 },
          { surface: "ledge", width: 3, gap: 1, height: 5 },
          { surface: "solid", width: 2, gap: 2, height: 5 },
        ],
        "fallback",
      );
    }

    const spawn = this.world.safeSpawn() ?? this.world.lastSafeX();
    const playerSprite = this.physics.add.sprite(spawn.x, spawn.y, "runner");
    this.player = new Player(playerSprite);
    this.player.beginRun(spawn.x, spawn.y);
    this.playerGlow = this.add.image(spawn.x, spawn.y, "runner-glow");
    this.playerGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.playerGlow.setDepth(4);
    this.playerGlow.setAlpha(0.55);

    if (HUNTERS_ENABLED) {
      const hunterSprite = this.physics.add.sprite(spawn.x - 280, spawn.y - 20, "hunter");
      this.hunter = new Hunter(hunterSprite);
      const hunterGlow = this.add.image(hunterSprite.x, hunterSprite.y, "hunter-glow");
      this.hunter.attachGlow(hunterGlow);
      this.hunter.apply("chase", this.player.x, this.player.y, 0);
    } else {
      this.hunter = null;
    }

    this.physics.add.collider(this.player.sprite, this.world.platforms);
    this.physics.add.overlap(this.player.sprite, this.world.spikes, () => this.hitHazard());
    this.physics.add.overlap(this.player.sprite, this.world.orbs, (_p, orb) => {
      this.collectOrb(orb as Phaser.GameObjects.GameObject);
    });
    if (this.hunter) {
      this.physics.add.overlap(this.player.sprite, this.hunter.sprite, () => this.hitHazard(true));
    }

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
    this.pullDecisions(true, HUNTERS_ENABLED);
    this.emitHud();
    this.exposeDebugApi();
  }

  private exposeDebugApi(): void {
    const scene = this;
    const api: { die: () => void; snapshot?: () => unknown } = {
      die: () => scene.handlePit(),
    };
    if (DEBUG_PAD_LABELS) {
      api.snapshot = () => {
        const vx = scene.player.vx || AUTO_RUN;
        return {
          player: {
            x: Math.round(scene.player.x),
            vx: Math.round(vx),
            hp: scene.player.hp,
            score: scene.score(),
          },
          pads: scene.world.segments
            .filter((seg) => seg.walkable && seg.spec.surface !== "spike")
            .map((seg) => {
              const padPx = seg.spec.width * TILE;
              return {
                surface: seg.spec.surface,
                tiles: seg.spec.width,
                padPx,
                gap: seg.spec.gap,
                startX: Math.round(seg.startX),
                dwellAtAutoRun: Number((padPx / AUTO_RUN).toFixed(3)),
                dwellAtPlayerVx: Number((padPx / Math.max(60, vx)).toFixed(3)),
              };
            }),
        };
      };
    }
    (window as Window & { __neonChase?: unknown }).__neonChase = api;
  }

  update(_time: number, delta: number): void {
    if (this.ended || this.finishing) return;

    const controls = this.readControls();
    const frame = this.player.update(this.time.now, controls);
    this.hunter?.update(delta / 1000, this.player.x, this.player.y, this.player.vy);
    this.backdrop.scroll(this.cameras.main.scrollX);
    this.playerGlow.setPosition(this.player.x, this.player.y + 2);
    this.playerGlow.setFlipX(this.player.sprite.flipX);
    this.playerGlow.setAlpha(this.player.invulnerable ? 0.2 : 0.5 + Math.sin(this.time.now / 140) * 0.15);
    this.playerGlow.setScale(this.player.sprite.scaleX * 1.15, this.player.sprite.scaleY * 1.15);

    if (frame.jumped) audio.jump();
    if (frame.dashed) {
      audio.dash();
      juice.burst(this.player.x, this.player.y, CYAN, 12, 200);
      juice.dashTrail(true, this.player.sprite, CYAN);
      this.trailingDash = true;
    }
    if (frame.landed && frame.landingVy > 140) {
      audio.land();
    }
    if (this.trailingDash && !frame.dashing && !frame.dashed) {
      juice.dashTrail(false);
      this.trailingDash = false;
    }

    if (this.hunter) {
      const dist = this.hunter.distanceTo(this.player.x, this.player.y);
      if (dist < NEAR_MISS_PX && dist > 30 && !this.player.invulnerable && this.time.now > this.nearMissCool) {
        this.nearMissCool = this.time.now + 420;
        juice.shake(this, 70, 0.0032);
        audio.nearMiss();
      }
    }

    if (this.player.sprite.y > GAME_HEIGHT + 50) {
      this.handlePit();
      return;
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
    return Math.floor(this.player.maxX / 8) + this.orbsCollected * ORB_SCORE + this.orbBonus;
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
      hunter: this.hunter
        ? {
            x: Math.round(this.hunter.x),
            aggression: Number(this.hunter.aggression.toFixed(2)),
            dist: Math.round(this.player.x - this.hunter.x),
          }
        : { ...DISABLED_HUNTER_STATE },
      ahead: this.world.aheadEncoding(this.player.x),
      score: this.score(),
      hurts: this.hurts,
      lastEvent: this.lastEvent,
      motif: this.motif,
    };
  }

  private maybeRequest(): void {
    const needTerrain = this.world.remainingScreens(this.cameras.main.scrollX) < BUFFER_SCREENS;
    const needHunter = HUNTERS_ENABLED && this.time.now >= this.hunterDue;

    if (needTerrain && !this.terrainBusy) {
      void this.pullDecisions(true, needHunter || (HUNTERS_ENABLED && !this.hunterBusy));
      return;
    }
    if (needHunter && !this.hunterBusy && !this.terrainBusy) {
      void this.pullDecisions(false, true);
    }
  }

  private async pullDecisions(terrain: boolean, hunter: boolean): Promise<void> {
    const token = this.runToken;
    if (terrain) this.terrainBusy = true;
    if (hunter) this.hunterBusy = true;

    const result = await this.hooks.jev.decide({
      state: this.compactState(),
      ask: {
        terrainSegments: terrain ? TERRAIN_BATCH : 0,
        hunter,
      },
    });

    if (!this.sys.isActive() || this.runToken !== token || this.ended) return;

    if (terrain && result.director) this.applyDirector(result.director);

    if (terrain && result.terrain.length) {
      this.world.append(result.terrain, result.source, result.director);
    }
    if (HUNTERS_ENABLED && this.hunter && hunter && result.director?.hunter) {
      this.applyHunter(result.director.hunter);
    } else if (HUNTERS_ENABLED && this.hunter && hunter && result.hunterMove) {
      this.hunter.apply(result.hunterMove, this.player.x, this.player.y, this.player.vy, this.score());
      this.hunterDue = this.time.now + HUNTER_TICK_MS;
    }

    if (terrain) this.terrainBusy = false;
    if (hunter) this.hunterBusy = false;
    this.emitHud();
  }

  private applyDirector(plan: DirectorPlan): void {
    this.difficulty = plan.difficulty;
    this.juiceCue = plan.juiceCue;
    this.motif = plan.composition.motif;
    this.lastEvent = plan.event;
    this.backdrop.setMotif(this.motif);
    juice.playCue(this, plan.juiceCue, this.player.x + 80, this.player.y);
    audio.cue(plan.juiceCue);
  }

  private applyHunter(tactics: HunterTactics): void {
    if (!this.hunter) return;
    this.hunter.applyTactics(
      tactics,
      this.player.x,
      this.player.y,
      this.player.vy,
      this.score(),
      this.difficulty,
    );
    this.hunterDue = this.time.now + HUNTER_TICK_MS;
  }

  private handlePit(): void {
    if (this.ended || this.finishing) return;
    // Falling off the world is lethal. Mid-run respawn was the death loop:
    // i-frames + spawn-in-gap refreshed forever and never reached Game Over.
    this.hurts += 1;
    this.finish();
  }

  private collectOrb(obj: Phaser.GameObjects.GameObject): void {
    if (!obj.active || this.ended || this.finishing) return;
    const img = obj as Phaser.GameObjects.Image;
    const x = img.x;
    const y = img.y;
    obj.destroy();

    const now = this.time.now;
    this.combo = now - this.lastOrbAt < COMBO_WINDOW_MS ? this.combo + 1 : 1;
    this.lastOrbAt = now;
    this.peakCombo = Math.max(this.peakCombo, this.combo);
    this.orbsCollected += 1;
    const bonus = (this.combo - 1) * COMBO_BONUS;
    this.orbBonus += bonus;
    const gained = ORB_SCORE + bonus;

    juice.hitStop(this, 36, 0.28);
    juice.burst(x, y, this.juiceCue === "rise" ? GOLD : CYAN, 16 + this.combo, 210);
    juice.scorePop(this, x, y - 8, this.combo > 1 ? `x${this.combo} +${gained}` : `+${gained}`, this.combo > 2 ? GOLD : CYAN);
    audio.orb(this.combo);
  }

  private hitHazard(fromHunter = false): void {
    if (this.ended || this.finishing) return;
    const knocked = this.player.hurt(this.time.now, fromHunter ? -240 : -120);
    if (!knocked) return;
    this.hurts += 1;
    this.combo = 0;
    juice.hitStop(this, 70, 0.14);
    juice.shake(this, 140, 0.009);
    juice.burst(this.player.x, this.player.y, MAGENTA, 18, 240);
    this.cameras.main.flash(90, 255, 43, 214, false);
    audio.hit();
    if (fromHunter && this.hunter) this.hunter.sprite.x -= 130;
    if (this.player.hp <= 0) this.finish();
  }

  private finish(): void {
    if (this.ended || this.finishing) return;
    this.finishing = true;
    this.ended = true;
    const token = this.runToken;
    juice.dashTrail(false);
    juice.hitStop(this, 140, 0.1);
    juice.shake(this, 260, 0.016);
    juice.burst(this.player.x, this.player.y, MAGENTA, 28, 280);
    juice.burst(this.player.x, this.player.y, CYAN, 16, 200);
    this.cameras.main.flash(160, 255, 43, 214, false);
    audio.death();
    this.player.sprite.setVelocity(0, 0);
    const body = this.player.sprite.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.time.delayedCall(90, () => {
      if (this.runToken !== token || !this.sys.isActive()) return;
      this.cameras.main.fadeOut(320, 5, 5, 16);
    });
    this.emitHud();
    this.time.delayedCall(420, () => {
      if (this.runToken !== token || !this.sys.isActive()) return;
      juice.restoreTime(this);
      this.hooks.onGameOver({
        score: this.score(),
        distance: Math.floor(this.player.maxX / TILE),
        callCount: this.hooks.jev.callCount,
        combo: this.peakCombo,
      });
    });
  }

  private onShutdown(): void {
    juice.dashTrail(false);
    juice.restoreTime(this);
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
      hunterMove: this.hunter?.stance ?? "",
      motif: this.motif,
      event: this.lastEvent,
      juiceCue: this.juiceCue,
      difficulty: this.difficulty,
      combo: this.time.now - this.lastOrbAt < COMBO_WINDOW_MS ? this.combo : 0,
    });
  }
}
