# Neon Chase / 霓虹追影

Endless side-scrolling runner. You run, jump, and dash. **TypeSafe Jev** (System One) does not write text or draw art — it only returns structured Choice / Score / Noul answers that compose the next street, pick a set-piece, and steer the hunter.

无尽横版跑酷。玩家奔跑、跳跃、冲刺。**TypeSafe Jev**（System One）不生成文案或美术，只从固定选项里返回结构化 Choice / Score / Noul，用来铺前方地形、触发可见事件并驱动追猎 AI。

Polish pass follows 花间莉萝 [「为什么你的独立游戏充满廉价感？」](https://www.bilibili.com/video/BV1q843z1EgF) (BV1q843z1EgF): constrained cyan/magenta grade, shared L-corner chrome on title/HUD/game-over, cool fog vs warm neon, parallax city, quiet Jev whisper, distinct confirm/back/tick/hold SFX, faded overlay transitions, contextual particles, land/hurt squash, and one geometric-neon direction — not more features.

## Play / 怎么玩

- **Goal:** survive, collect cyan orbs, score from distance + orbs + chain bonus.
- **Hazards:** gaps, magenta spikes, the hunter, decoy lips when Jev asks for a fake-out.
- **HP:** 3. Spikes / hunter / falling off cost 1 HP (brief i-frames). 0 HP → game over.
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

Without a key, or if Jev errors / exceeds **800ms**, the game keeps running on **safe flat ground**, a hunter that simply chases, **no set-piece**, and a hush juice cue. The HUD shows a non-blocking warning.

没有 Key、接口报错或超过 **800ms** 时，游戏不会卡死：用地形兜底（平坦安全地面）和“追赶”猎人，不触发事件，HUD 会显示一条不打断操作的警告。

## What Jev does / Jev 做什么

The browser **never** sees `TYPESAFE_API_KEY`. It posts compact game state to the local proxy:

`POST /api/jev/decide` → server → `POST https://api.typesafe.ai/v1/systemone`

Pinned model: **`jev-1.13.0`**.

All questions in one `systemone` call run **in parallel**. Terrain prefetch (2 segments) piggy-backs the hunter questions when a tick is due. A hunter-only tick sends only the hunter block.

### Compact state

```json
{
  "player": { "x": 0, "y": 0, "vx": 0, "vy": 0, "hp": 3, "dash": true },
  "hunter": { "x": 0, "aggression": 0.5, "dist": 160 },
  "ahead": ["solid:5", "gap:2"],
  "score": 0,
  "hurts": 0,
  "lastEvent": "none",
  "motif": "neon_alley"
}
```

`dist` is player X minus hunter X. `hurts` is a death-pressure proxy (times hit this run). Instructions on each question are **state-conditioned** from these fields.

### Question → gameplay map

Every answer is consumed. Fallback fills each field deterministically when the key is missing, the call times out, or a value is unknown.

| Question id | Type | Criteria | Gameplay |
| --- | --- | --- | --- |
| `s?_next_surface` | Choice | `solid` \| `ledge` \| `spike` | Platform kind |
| `s?_width` | Choice | `2` \| `3` \| `5` | Width in tiles |
| `s?_gap` | Choice | `0` \| `1` \| `2` | Empty tiles after the slab |
| `s?_height` | Choice | `4`–`9` | Row from the bottom |
| `rhythm` | Choice | `easy` \| `build` \| `punish` | Orb count / how greedy the slice feels |
| `motif` | Choice | `neon_alley` \| `rooftop` \| `underpass` | Palette, skyline tint, platform edge language |
| `hazard_density` | Choice | `low` \| `mid` \| `high` | Extra spike nubs on otherwise-safe slabs |
| `orb_style` | Choice | `trail` \| `cluster` \| `high_risk` | Orb layout (line / triangle / over gaps) |
| `fakeout` | Choice | `yes` \| `no` | Decoy lip: glow wider than the collider |
| `flow` | Score (9 levels → **2–10**) | recovery … peak heat | Hunter pressure + HUD “flow” |
| `event_beat` | Choice | `none` \| `ambush_spike_run` \| `orb_fountain` \| `narrow_gauntlet` \| `calm_breather` | Visible set-piece prepended to the slice |
| `juice_cue` | Choice | `pulse` \| `drop` \| `rise` \| `sting` \| `hush` | SFX + VFX accent for this beat |
| `hunter_stance` | Choice | `pressure` \| `bait` \| `cut_off` \| `retreat` | Maps to chase / bait / jump / hold plus new spacing |
| `hunter_feint` | Noul | true/false statements | If `noul > 0.55`, hunter fakes the opposite way first |
| `hunter_aggression` | Score (5 levels) | hover … relentless | Scales chase speed (0.2–1.0) |
| `hunter_vertical` | Choice | `above` \| `level` \| `below` | Preferred height vs the runner |

**Event beats (must change the next screen if not `none`):**

- `ambush_spike_run` — two spike slabs slam in + sting juice
- `orb_fountain` — arc of extra orbs
- `narrow_gauntlet` — three stub ledges with hops
- `calm_breather` — long safe slab (hunter instructions prefer retreat)
- `none` — compose only the segment answers

Score `flow` uses an ordered 9-level `criteria` array (System One indices 0–8). The proxy maps `round(score) + 2` onto difficulty **2–10**.

### Response

```json
{
  "ok": true,
  "source": "jev",
  "latencyMs": 412,
  "model": "jev-1.13.0",
  "terrain": [{ "surface": "ledge", "width": 3, "gap": 1, "height": 7 }],
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
- When the terrain buffer drops below ~2 screens, the client prefetches 2 segments (and piggy-backs hunter questions when a tick is due).
- Hunter AI ticks about every **400ms**. Between ticks the sprite interpolates toward the last target; a feint offsets the first ~160ms.
- HUD: score, HP, combo chain, last Jev latency, source, motif, hunter stance, flow. Event banners appear when a set-piece is live. Call count is on the game-over panel.

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

Get an API key from the [TypeSafe console](https://console.typesafe.ai/settings/keys) after you have Jev access.
