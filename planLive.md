# Reef/pond.io: crit 9 real-time multiplayer

## Context

Crit 8 shipped a single-player proof-of-life: the whole sim (`public/game/sim.js`, `bots.js`) runs client-side in a `requestAnimationFrame` loop, bots stand in for other players, and the only server-side state is the JSON leaderboard. The brief explicitly deferred real-time multiplayer to this week. See `PROCESS.md`'s crit 9 decision note for the one-line rationale.

## Architecture: server-authoritative over WebSockets

The server runs one shared sim tick for all connected players (plus bots), using the existing pure `sim.js`/`bots.js` logic almost unchanged. Clients send input, the server is the only thing that mutates game state, and broadcasts a snapshot to every connected client each tick. This fits the course's own infra: one Fly machine, one process, no horizontal scaling — so "one authority" is free, not a bottleneck to engineer around.

**Transport**: the `ws` package (first runtime dependency this project takes). Node's plain `http` module doesn't do WebSocket upgrades/framing itself, and hand-rolling that protocol (masking, fragmented frames, ping/pong) is exactly the kind of code that's easy to get subtly wrong without it showing up until a real client hits it. `ws` attaches to the existing `http.Server` via its `noServer`/`server` option, so `/api/leaderboard` and static serving are untouched.

## Server design

New module `src/server/room.ts`: owns the shared game state (one global room for now — no matchmaking/multiple rooms this week) and the tick loop.

- State shape is the current client `state` object from `sim.js`, moved server-side: `{ bots, food, respawns, palette }` plus a `Map<ws, PlayerEntity>` for connected players (no single `player` field anymore — many players share the world).
- Tick loop: `setInterval` (or a self-correcting `setTimeout` chain to avoid drift) at a fixed rate — **20Hz** (50ms) chosen as the floor for the game feeling responsive without taxing the 256MB/shared-cpu-1x machine; revisit if bot AI or eating resolution gets expensive with many entities.
- Per tick: apply each connected player's latest received heading/dash via `steer`/`triggerDash`, `updateBots`, `step`, `resolveEating` (all reused from `sim.js`/`bots.js` verbatim — they already take a plain state object), then broadcast.
- **Join**: on WebSocket connect, create a new player entity (`makeEntity`), add to the room, send that client a `welcome` message (their own id, world size, current palette) followed by normal snapshots. A joining player doesn't reset anyone else's state — this is the main behavioural change from the single-player version, where `createState` rebuilds the whole world every run.
- **Leave**: on `close`/`error`, remove the player's entity from the room immediately (no respawn-as-bot; they just vanish, same as being eaten without the death flash).
- **Rate-limiting / validation**: an inbound `input` message only ever carries a heading + dash flag, never a position or size — the server computes everything downstream of that, so a malicious client can't teleport or self-grow. Drop any message that isn't a well-formed `{heading:[number,number], dash:boolean}` rather than erroring the connection.

### Wire protocol (JSON text frames, matches the existing JSON-everywhere style)

Client → server:
```json
{ "type": "input", "heading": [0.7, -0.7], "dash": false }
{ "type": "join", "name": "REEF", "colour": "coral" }
```
`join` is sent once right after connecting (the socket opens when the player clicks Play, carrying the name/colour already chosen on the start screen — no separate handshake step).

Server → client:
```json
{ "type": "welcome", "id": 42, "world": 2000, "palette": ["coral","amber",...] }
{ "type": "snapshot", "t": 1234.5, "you": {...}, "players": [...], "bots": [...], "food": [...], "events": [{"type":"eaten","victim":12,"by":42}] }
{ "type": "death", "eatenBy": {"name":"...", "colour":"..."} }
```
`snapshot.events` carries one-off happenings (eaten, respawned) so the client can trigger effects/sounds without diffing state itself. `you` is duplicated out of `players` so the client doesn't need to search the array to find its own camera target.

### Reused vs. new in `sim.js`/`bots.js`

Reused as-is: `makeEntity`, `steer`, `step`, `resolveEating`, `spawnFood`, `respawnBot`, `updateBots`. These are already pure functions over a plain state object with no DOM/fetch references, which is exactly why the original plan called this out as "a concrete hedge against rework, without building networking now" — this week is that payoff.

Changed: `createState` currently builds one `player` + N `bots`; the room needs a variant that starts with just bots/food and lets players join/leave the `players` collection dynamically. `EAT_LOCK_SCORE`'s "only players can be eaten" rule now matters for real: with several real players in one room it's the actual endgame mechanic, not a single-player curiosity.

## Client design

`public/game/main.js`'s game loop changes from "simulate locally, render locally" to "render whatever the server last sent, send input every frame."

- New `public/game/net.js`: opens the WebSocket on Play, exposes `sendInput(heading, dash)` (throttled to once per animation frame, not per `sim` tick — server decides its own tick rate) and `onSnapshot(cb)`.
- `main.js`'s `frame()` loop simplifies: read local input → `sendInput` → render using the **last received snapshot** (not a locally-stepped state). No more client-side `step`/`resolveEating`/`updateBots` calls during play.
- **Interpolation**: snapshots arrive at 20Hz but the screen renders at 60Hz+; naive "snap to latest snapshot" looks stuttery. Render a small delay behind the snapshot stream (~100ms) and linearly interpolate entity positions between the two bracketing snapshots. This is the one genuinely new piece of client logic this week — everything else is deletion or thin plumbing.
- Reconnect: on socket close mid-game, show a "connection lost" state distinct from death (don't silently treat a dropped connection as being eaten).
- Camera/rendering (`render.js`) is unaffected — it already just draws whatever state object it's handed.

## What stays single-player / unchanged

- Start screen, profile/localStorage personal-best, global leaderboard HTTP API: all per-browser concerns, untouched.
- `/readme/`, static serving, Dockerfile, fly.toml: unaffected by adding a `ws` upgrade handler onto the existing `http.Server`.

## File-by-file changes

**New (server)**: `src/server/room.ts` (shared state + tick loop + broadcast), wiring into `src/server/index.ts` to attach `ws`'s `WebSocketServer` to the existing `createServer` instance and route `/ws` upgrades to it.

**New (client)**: `public/game/net.js` (socket lifecycle, send/receive, interpolation buffer).

**Changed**: `sim.js` (`createState` split so a room can start bot/food-only and add players later), `main.js` (game loop driven by snapshots instead of local `step`), `package.json`/`pnpm-lock.yaml` (add `ws` + its types).

**Spec**: `spec/multiplayer.test.ts` — connect two WebSocket clients against the running app, confirm each sees the other join (a `players` array with 2 entries), confirm one disconnecting removes it from the other's next snapshot.

## Explicit non-goals this week

No matchmaking or multiple rooms (one shared world, matches the single Fly machine). No server-side anti-cheat beyond "clients only ever send heading/dash, never position/size." No lag compensation/client-side prediction beyond the render-side interpolation buffer — inputs are applied on the tick they arrive, full-stop. No reconnection-with-state-preservation (a dropped socket is a fresh join, not a resume).

## Verification

1. Local: run the server, open two browser tabs, confirm each tab's fish appears in the other's world and both can eat each other.
2. Throttle one tab's network (devtools) to confirm interpolation keeps movement smooth despite irregular snapshot arrival.
3. Close one tab mid-session, confirm the other tab sees that fish disappear within one tick.
4. `pnpm check` (typecheck + `spec/multiplayer.test.ts` + existing specs) green locally and in Docker, matching the crit 8 parity routine.
5. Deploy to Fly, play across two devices/networks to confirm real latency doesn't break interpolation, confirm the leaderboard and personal-best flows (unrelated to this week's work) still function end to end.
