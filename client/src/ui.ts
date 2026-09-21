import type { ControlState } from "./game/entities/Player.ts";
import type { HudSnapshot, RunResult } from "./game/scenes/PlayScene.ts";

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

export function bindUi(controls: ControlState): {
  showTitle: (status: string, kind?: "ok" | "warn") => void;
  showPlay: () => void;
  showGameOver: (result: RunResult) => void;
  renderHud: (snap: HudSnapshot) => void;
  onPlay: (fn: () => void) => void;
  onRetry: (fn: () => void) => void;
  onTitle: (fn: () => void) => void;
} {
  const title = $("overlay-title");
  const gameover = $("overlay-gameover");
  const hud = $("hud");
  const touch = $("touch");
  const status = $("title-status");
  const warning = $("hud-warning");

  const showTitle = (text: string, kind: "ok" | "warn" = "ok"): void => {
    title.hidden = false;
    gameover.hidden = true;
    hud.hidden = true;
    status.textContent = text;
    status.className = `status ${kind}`;
  };

  const showPlay = (): void => {
    title.hidden = true;
    gameover.hidden = true;
    hud.hidden = false;
  };

  const showGameOver = (result: RunResult): void => {
    gameover.hidden = false;
    hud.hidden = true;
    $("go-score").textContent = String(result.score);
    $("go-distance").textContent = `${result.distance}m`;
    $("go-calls").textContent = String(result.callCount);
  };

  const renderHud = (snap: HudSnapshot): void => {
    $("hud-score").textContent = String(snap.score);
    $("hud-hp").textContent = "●".repeat(Math.max(0, snap.hp)).padEnd(snap.maxHp, "○");
    const src = snap.source === "none" ? "…" : snap.source;
    $("hud-jev").textContent = `${snap.latencyMs || "—"}ms · ${snap.callCount} · ${src} · ${snap.hunterMove}`;
    if (snap.warning) {
      warning.hidden = false;
      warning.textContent = snap.warning;
    } else {
      warning.hidden = true;
    }
  };

  $("btn-play").addEventListener("click", () => undefined);
  const onPlay = (fn: () => void): void => {
    $("btn-play").addEventListener("click", fn);
    window.addEventListener("keydown", (e) => {
      if (e.code === "Enter" && !title.hidden) fn();
    });
  };
  const onRetry = (fn: () => void): void => {
    $("btn-retry").addEventListener("click", fn);
  };
  const onTitle = (fn: () => void): void => {
    $("btn-title").addEventListener("click", fn);
  };

  const setTouch = (key: keyof ControlState, down: boolean): void => {
    controls[key] = down;
  };

  for (const btn of touch.querySelectorAll<HTMLButtonElement>("[data-touch]")) {
    const key = btn.dataset.touch as keyof ControlState;
    const down = (e: Event): void => {
      e.preventDefault();
      setTouch(key, true);
    };
    const up = (e: Event): void => {
      e.preventDefault();
      setTouch(key, false);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  if (window.matchMedia("(pointer: coarse)").matches) {
    touch.hidden = false;
  }

  return { showTitle, showPlay, showGameOver, renderHud, onPlay, onRetry, onTitle };
}
