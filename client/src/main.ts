import "./style.css";
import { audio } from "./audio/AudioBus.ts";
import { createGame } from "./game/createGame.ts";
import { juice } from "./game/fx/Juice.ts";
import { PlayScene, type HudSnapshot, type RunResult } from "./game/scenes/PlayScene.ts";
import type { ControlState } from "./game/entities/Player.ts";
import { JevService } from "./jev/client.ts";
import { bindUi } from "./ui.ts";

const controls: ControlState = { left: false, right: false, jump: false, dash: false };
const jev = new JevService();
const ui = bindUi(controls);

const hooks = {
  jev,
  controls,
  onHud: (snap: HudSnapshot) => ui.renderHud(snap),
  onGameOver: (result: RunResult) => ui.showGameOver(result),
};

const rootEl = document.getElementById("game-root");
if (!rootEl) throw new Error("#game-root missing");
const root = rootEl;

let game = createGame(root);
let paused = false;
let starting = false;

function remakeGame(): void {
  const scene = game.scene.getScene(PlayScene.KEY);
  if (scene) {
    try {
      juice.restoreTime(scene);
    } catch {
      /* shutting down */
    }
  }
  game.destroy(true);
  root.replaceChildren();
  game = createGame(root);
}

function clearControls(): void {
  controls.left = false;
  controls.right = false;
  controls.jump = false;
  controls.dash = false;
}

async function armAudio(): Promise<void> {
  try {
    await audio.unlock();
  } catch {
    /* autoplay policies */
  }
}

function startRun(): void {
  if (starting) return;
  starting = true;
  void armAudio();
  audio.confirm();
  paused = false;
  clearControls();
  ui.showPlay();
  remakeGame();
  game.scene.start(PlayScene.KEY, hooks);
  window.setTimeout(() => {
    starting = false;
  }, 250);
}

function toTitle(): void {
  audio.back();
  paused = false;
  clearControls();
  if (game.scene.isActive(PlayScene.KEY) || game.scene.isPaused(PlayScene.KEY)) {
    const scene = game.scene.getScene(PlayScene.KEY);
    if (scene) juice.restoreTime(scene);
    game.scene.stop(PlayScene.KEY);
  }
  ui.showPause(false);
  ui.showTitle(lastStatus.text, lastStatus.kind);
}

function setPaused(next: boolean): void {
  if (!game.scene.isActive(PlayScene.KEY) && !game.scene.isPaused(PlayScene.KEY)) return;
  if (ui.overlayOn("overlay-title") || ui.overlayOn("overlay-gameover")) return;
  paused = next;
  const scene = game.scene.getScene(PlayScene.KEY);
  if (next) {
    if (scene) juice.restoreTime(scene);
    game.scene.pause(PlayScene.KEY);
    ui.showPause(true);
    audio.hold();
  } else {
    game.scene.resume(PlayScene.KEY);
    ui.showPause(false);
    audio.confirm();
  }
}

const lastStatus = { text: "Checking Jev proxy…", kind: "ok" as "ok" | "warn" };

ui.onPlay(startRun);
ui.onRetry(startRun);
ui.onTitle(toTitle);
ui.onResume(() => setPaused(false));
ui.onPauseTitle(toTitle);

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape" || e.code === "KeyP") {
    if (game.scene.isActive(PlayScene.KEY) || game.scene.isPaused(PlayScene.KEY)) {
      e.preventDefault();
      setPaused(!paused);
    }
  }
  if (e.code === "KeyM") {
    audio.toggleMute();
    audio.tick();
  }
});

void jev.health().then((health) => {
  if (!health) {
    lastStatus.text = "Proxy offline — local terrain.";
    lastStatus.kind = "warn";
  } else if (!health.jevConfigured) {
    lastStatus.text = "No key — local terrain. Jev stays on the server.";
    lastStatus.kind = "warn";
  } else {
    lastStatus.text = `Jev ready · ${health.model}`;
    lastStatus.kind = "ok";
  }
  if (ui.overlayOn("overlay-title")) {
    ui.showTitle(lastStatus.text, lastStatus.kind);
  }
});

ui.showTitle(lastStatus.text, lastStatus.kind);
