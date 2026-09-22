# Neon Chase / 霓虹追影

Endless side-scrolling runner. You run, jump, and dash. **TypeSafe Jev** (System One) does not write text or draw art — it only returns structured Choice / Score / Noul answers that compose the next street and pick a set-piece.

无尽横版跑酷。玩家奔跑、跳跃、冲刺。**TypeSafe Jev**（System One）不生成文案或美术，只从固定选项里返回结构化 Choice / Score / Noul，用来铺前方地形并触发可见事件。

This build is a **calmer runner**: hunters / 追兵 are disabled in gameplay (`HUNTERS_ENABLED = false` in `client/src/config.ts`). Pressure comes from scrolling terrain and occasional obstacles. Spike density is throttled to about **1/3 or less** of the previous rules (`SPIKE_SURFACE_KEEP`, `SPIKE_NUB_KEEP`).

Walkable platforms (solids, ledges, gauntlet steps, fake-out colliders) last **~1 second** at auto-run. Formula in `shared/pads.ts` and `client/src/config.ts`:

`WALKABLE_PAD_PX = AUTO_RUN × WALKABLE_PAD_SECONDS` → `230 × 1.0 = 230px`  
`WALKABLE_PAD_TILES = ceil(230 / TILE)` → `ceil(230 / 40) = 6` tiles (240px ≈ **1.04s**). Jev width choices are `6 | 8 | 10`. Spike slabs are not stretched. Open `?pads=1` to paint tile/dwell labels while playtesting.

Pit / gap cadence lives in `shared/pits.ts` and is applied when the street is built (`TerrainWorld`):

- **2s safe runway** after AGAIN / Enter (no pits), plus ~1.6s spawn i-frames against spikes.
- **First lethal pit** is the next pad lip after that runway (~480px / ~12 tiles) — not delayed to ~32m by treating world origin as a previous pit.
- **Early** (~2–12s): sparse 2-tile pits (~every 5s). **Mid** (~12–28s) / **late**: denser (targets ~3.2s / ~2.0s). Only 2-tile holes tick the spacing clock.
- Authored 1-tile hops can still appear; a 1-tile hole is coyote-walkable, so injected death pits stay **2 tiles (80px)**.
- **Jump:** `JUMP_V = -580`, coyote **140ms** (`shared/jump.ts`) so a normal jump from the last ~80px of a pad — or a late coyote — clears 80px. Pad-center still misses.
- Gaps stay `0 | 1 | 2`. Spike keep-rates (`SPIKE_SURFACE_KEEP`, `SPIKE_NUB_KEEP`) are unchanged.
- `npm test` asserts first-pit distance, early→late densify, and jump clearance. Open `?pits=1` or `window.__neonChase.pits()` for a live dump.

Polish pass follows 花间莉萝 [「为什么你的独立游戏充满廉价感？」](https://www.bilibili.com/video/BV1q843z1EgF) (BV1q843z1EgF): constrained cyan/magenta grade, shared L-corner chrome on title/HUD/game-over, cool fog vs warm neon, parallax city, quiet Jev whisper, distinct confirm/back/tick/hold SFX, faded overlay transitions, contextual particles, land/hurt squash, and one geometric-neon direction — not more features.

## Play / 怎么玩

- **Goal:** survive, collect cyan orbs, score from distance + orbs + chain bonus.
- **Hazards:** readable pits/gaps (sparse early, denser mid/late), occasional magenta spikes, decoy lips when Jev asks for a fake-out. No pursuing hunters.
- **HP:** 3. Spikes cost 1 HP (brief i-frames). Falling off the world ends the run. **AGAIN** / Enter starts a fresh run from the opening street.
- **Juice:** hit-stop, camera shake, neon particles, land squash, dash trails, combo pops.
- **Audio:** procedural Web Audio pad + one-shots. Mute persists in `localStorage` (`M` or the LIVE/MUTE chip). Music ducks when you get hit.

| Input | Action |
| --- | --- |
| `A` `D` or arrows | run (there is also a steady auto-run) |
| `W` / `↑` / `Space` | jump (coyote + input buffer) |
| `Shift` | dash (short input buffer) |
| `Enter` | start from the title screen |
| `Esc` / `P` | pause |
| `M` | mute |

On a touch device, on-screen buttons appear.

## Run locally / 本地运行

Needs Node 20+.

```bash
npm install
```

Copy the env template and (optionally) add a TypeSafe key. The key stays on the **server** only.

```bash
cp .env.example .env.local
# edit .env.local and set TYPESAFE_API_KEY=...
```

`.env.example` ships with an empty key. Do not commit `.env` or `.env.local`.

```bash
npm run dev
```

- Client (Vite + Phaser 3): [http://127.0.0.1:43123](http://127.0.0.1:43123)
- Server (Hono Jev proxy): [http://127.0.0.1:43124](http://127.0.0.1:43124)

Or start them separately:

```bash
npm run dev:server
npm run dev:client
```

Without a key, or if Jev errors / exceeds **800ms**, the game keeps running on **local paced streets** (same pit cadence as the client), **no set-piece**, and a hush juice cue. The HUD shows a non-blocking warning.

没有 Key、接口报错或超过 **800ms** 时，游戏不会卡死：用本地节奏地面兜底（仍有可控落差），不触发事件，HUD 会显示一条不打断操作的警告。

## What Jev does / Jev 做什么

The browser **never** sees `TYPESAFE_API_KEY`. It posts compact game state to the local proxy:

`POST /api/jev/decide` → server → `POST https://api.typesafe.ai/v1/systemone`

Pinned model: **`jev-1.13.0`**.

All questions in one `systemone` call run **in parallel**. The client prefetches 2 terrain segments and does **not** ask Jev for hunter decisions while `HUNTERS_ENABLED` is false. Hunter question ids below stay in the proxy for the unused path.

### Compact state

```json
{
  "player": { "x": 0, "y": 0, "vx": 0, "vy": 0, "hp": 3, "dash": true },
  "hunter": { "x": 0, "aggression": 0.5, "dist": 160 },
  "ahead": ["solid:6", "gap:2"],
  "score": 0,
  "hurts": 0,
  "lastEvent": "none",
  "motif": "neon_alley"
}
```

`hunter` is still sent so the proxy schema stays valid; with hunters off the client stubs `dist` as far away. `hurts` is a death-pressure proxy (times hit this run). Instructions on each question are **state-conditioned** from these fields.

### Question → gameplay map

Every answer is consumed. Fallback fills each field deterministically when the key is missing, the call times out, or a value is unknown.

| Question id | Type | Criteria | Gameplay |
| --- | --- | --- | --- |
| `s?_next_surface` | Choice | `solid` \| `ledge` \| `spike` | Platform kind |
| `s?_width` | Choice | `6` \| `8` \| `10` | Width in tiles (≥1s pad; legacy 2/3/5 remapped) |
| `s?_gap` | Choice | `0` \| `1` \| `2` | Empty tiles after the slab |
| `s?_height` | Choice | `4`–`9` | Row from the bottom |
| `rhythm` | Choice | `easy` \| `build` \| `punish` | Orb count / how greedy the slice feels |
| `motif` | Choice | `neon_alley` \| `rooftop` \| `underpass` | Palette, skyline tint, platform edge language |
| `hazard_density` | Choice | `low` \| `mid` \| `high` | Extra spike nubs on otherwise-safe slabs |
| `orb_style` | Choice | `trail` \| `cluster` \| `high_risk` | Orb layout (line / triangle / over gaps) |
| `fakeout` | Choice | `yes` \| `no` | Decoy lip: glow wider than an honest ~1s collider |
| `flow` | Score (9 levels → **2–10**) | recovery … peak heat | HUD “flow” |
| `event_beat` | Choice | `none` \| `ambush_spike_run` \| `orb_fountain` \| `narrow_gauntlet` \| `calm_breather` | Visible set-piece prepended to the slice |
| `juice_cue` | Choice | `pulse` \| `drop` \| `rise` \| `sting` \| `hush` | SFX + VFX accent for this beat |
| `hunter_stance` | Choice | `pressure` \| `bait` \| `cut_off` \| `retreat` | Unused in gameplay while hunters are off |
| `hunter_feint` | Noul | true/false statements | Unused in gameplay while hunters are off |
| `hunter_aggression` | Score (5 levels) | hover … relentless | Unused in gameplay while hunters are off |
| `hunter_vertical` | Choice | `above` \| `level` \| `below` | Unused in gameplay while hunters are off |

**Event beats (must change the next screen if not `none`):**

- `ambush_spike_run` — one short spike slab + sting juice (was two slabs)
- `orb_fountain` — arc of extra orbs
- `narrow_gauntlet` — three ~1s ledges with hops
- `calm_breather` — long safe slab
- `none` — compose only the segment answers

Score `flow` uses an ordered 9-level `criteria` array (System One indices 0–8). The proxy maps `round(score) + 2` onto difficulty **2–10**.

### Response

```json
{
  "ok": true,
  "source": "jev",
  "latencyMs": 412,
  "model": "jev-1.13.0",
  "terrain": [{ "surface": "ledge", "width": 8, "gap": 1, "height": 7 }],
  "hunterMove": "bait",
  "director": {
    "composition": {
      "rhythm": "build",
      "motif": "rooftop",
      "hazardDensity": "mid",
      "orbStyle": "cluster",
      "fakeout": false
    },
    "difficulty": 7,
    "event": "none",
    "juiceCue": "pulse",
    "hunter": {
      "stance": "bait",
      "move": "bait",
      "feint": false,
      "aggression": 0.62,
      "vertical": "above"
    }
  }
}
```

`hunterMove` is derived from `hunter_stance` so existing HUD copy still has a single verb.

### Game loop

- Physics and render stay at ~60fps in Phaser. Jev is **never** awaited on the update loop.
- When the terrain buffer drops below ~2 screens, the client prefetches 2 segments. Hunter ticks stay off unless `HUNTERS_ENABLED` is flipped back on.
- HUD: score, HP, combo chain, last Jev latency, source, motif, flow. Event banners appear when a set-piece is live. Call count is on the game-over panel.

## Layout

```
client/   Phaser 3 + Vite + TypeScript
server/   Hono + TypeScript proxy
shared/   Compact state + decide request/response types
```

Audio is generated in `client/src/audio/AudioBus.ts` (no binary assets).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | server + client together |
| `npm run dev:client` | Vite only (proxies `/api` → `:43124`) |
| `npm run dev:server` | Jev proxy only |
| `npm run build` | production client build |
| `npm test` | pit cadence + 2-tile jump assertions |

Get an API key from the [TypeSafe console](https://console.typesafe.ai/settings/keys) after you have Jev access.
