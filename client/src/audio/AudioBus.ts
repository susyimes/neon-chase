import { MUTE_STORAGE_KEY } from "../config.ts";
import type { JuiceCue } from "@shared/types.ts";

/**
 * Procedural Web Audio bus. No asset files — a dark pad/bass loop plus
 * short synth one-shots. Mute persists in localStorage.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private muted = false;
  private started = false;
  private duckTimer = 0;
  private voices: AudioNode[] = [];
  onChange: ((muted: boolean) => void) | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    } catch {
      this.muted = false;
    }
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(next: boolean): void {
    this.muted = next;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
    this.applyMute();
    this.onChange?.(next);
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.gain.value = 0.2;
      this.sfx.gain.value = 0.5;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.applyMute();
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.started) {
      this.startPad();
      this.started = true;
    }
  }

  duck(ms = 420, to = 0.3): void {
    if (!this.ctx || !this.music || this.muted) return;
    const now = this.ctx.currentTime;
    this.music.gain.cancelScheduledValues(now);
    this.music.gain.setTargetAtTime(0.2 * to, now, 0.04);
    window.clearTimeout(this.duckTimer);
    this.duckTimer = window.setTimeout(() => {
      if (!this.ctx || !this.music) return;
      this.music.gain.setTargetAtTime(0.2, this.ctx.currentTime, 0.14);
    }, ms);
  }

  click(): void {
    this.blip(1400, 0.04, "sine", 0.18);
  }

  /** Primary confirm — Play / Again. Distinct from back/tick. */
  confirm(): void {
    this.blip(520, 0.06, "square", 0.16);
    this.blip(780, 0.08, "sine", 0.2, 0.05);
  }

  /** Leave / Title. */
  back(): void {
    this.sweep(420, 180, 0.1, "triangle", 0.16);
  }

  /** Mute chip. */
  tick(): void {
    this.blip(1900, 0.03, "sine", 0.12);
  }

  /** Pause in. */
  hold(): void {
    this.blip(240, 0.08, "triangle", 0.14);
    this.duck(500, 0.55);
  }

  ui(kind: "confirm" | "back" | "tick" | "hold" | "click"): void {
    if (kind === "confirm") this.confirm();
    else if (kind === "back") this.back();
    else if (kind === "tick") this.tick();
    else if (kind === "hold") this.hold();
    else this.click();
  }

  jump(): void {
    this.sweep(190, 430, 0.09, "square", 0.16);
  }

  dash(): void {
    this.noise(0.12, 0.22, 900);
    this.sweep(120, 720, 0.14, "sawtooth", 0.12);
  }

  orb(combo: number): void {
    const base = 620 + Math.min(combo, 6) * 70;
    this.blip(base, 0.09, "sine", 0.28);
    this.blip(base * 1.5, 0.07, "triangle", 0.16, 0.03);
  }

  hit(): void {
    this.blip(70, 0.18, "sine", 0.4);
    this.noise(0.16, 0.28, 400);
    this.duck(480, 0.32);
  }

  death(): void {
    this.sweep(320, 55, 0.55, "sawtooth", 0.28);
    this.noise(0.3, 0.22, 200);
    this.duck(900, 0.15);
  }

  nearMiss(): void {
    this.noise(0.1, 0.12, 1400);
    this.sweep(500, 180, 0.1, "triangle", 0.1);
  }

  land(): void {
    this.blip(90, 0.05, "sine", 0.12);
  }

  cue(kind: JuiceCue): void {
    switch (kind) {
      case "pulse":
        this.blip(330, 0.12, "triangle", 0.18);
        this.blip(495, 0.1, "sine", 0.1, 0.04);
        break;
      case "drop":
        this.sweep(180, 70, 0.22, "sawtooth", 0.2);
        this.duck(360, 0.4);
        break;
      case "rise":
        this.sweep(280, 720, 0.28, "triangle", 0.16);
        this.blip(880, 0.08, "sine", 0.14, 0.12);
        break;
      case "sting":
        this.blip(880, 0.05, "square", 0.2);
        this.noise(0.08, 0.18, 2000);
        break;
      case "hush":
        this.duck(700, 0.45);
        break;
    }
  }

  private applyMute(): void {
    if (!this.master || !this.ctx) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  private startPad(): void {
    const ctx = this.ctx;
    const music = this.music;
    if (!ctx || !music) return;

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 55;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.28;
    sub.connect(subGain).connect(music);
    sub.start();

    const bass = ctx.createOscillator();
    bass.type = "sawtooth";
    bass.frequency.value = 110;
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = 420;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.09;
    bass.connect(bassFilter).connect(bassGain).connect(music);
    bass.start();

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(bassFilter.frequency);
    lfo.start();

    const pulse = ctx.createOscillator();
    pulse.type = "square";
    pulse.frequency.value = 2;
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 0.035;
    const pulseBias = ctx.createConstantSource();
    pulseBias.offset.value = 0.055;
    pulse.connect(pulseDepth);
    pulseDepth.connect(bassGain.gain);
    pulseBias.connect(bassGain.gain);
    pulse.start();
    pulseBias.start();

    for (const freq of [220, 329.63, 440]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.035;
      const trem = ctx.createOscillator();
      trem.frequency.value = 0.07 + freq / 8000;
      const tremG = ctx.createGain();
      tremG.gain.value = 0.02;
      trem.connect(tremG).connect(g.gain);
      osc.connect(g).connect(music);
      osc.start();
      trem.start();
      this.voices.push(osc, trem);
    }

    this.voices.push(sub, bass, lfo, pulse, pulseBias);
  }

  private blip(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private sweep(
    from: number,
    to: number,
    dur: number,
    type: OscillatorType,
    gain: number,
  ): void {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, gain: number, cutoff: number): void {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx || this.muted) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(sfx);
    src.start();
  }
}

export const audio = new AudioBus();
