# Reef: crit 8 proof-of-life

## Context

This is the first week of the COMP4020 final project (`comp4020-final-quackyduck826`), due as crit 8 "It's alive!" on **Wed 2026-10-07, 07:00 Canberra**. The repo currently holds only the course's placeholder (busybox serving a static page + README). Crit 8's bar is proof-of-life only: a deployed app where a stranger can do the core thing and find their trace still there later, plus a first `README.md` defining "good." The brief explicitly says the real-time multiplayer layer can wait for crit 9 — so this week is scoped to single-player, not full multiplayer.

The chosen concept, decided over several rounds of narrowing: **Reef**, an .io-style game. A fish grows by eating pickups and smaller fish; bigger fish are a threat. Since there are no other real players yet, **bot fish** populate the arena so it doesn't feel empty — real players replace/join them at crit 9. A **persistent leaderboard** (best name/score, survives restarts and redeploys via the Fly volume at `/data`) is this week's "trace." A **start screen** before joining lets the player pick a username and colour and shows their own personal best (score/time/size) from previous runs.

## Stack choice

**Server**: plain Node `http` module, TypeScript, run natively by Node (`node src/server/index.ts`) — no framework, no bundler, no build step. `tsconfig.json` is already configured for this (`allowImportingTsExtensions: true`, with a comment explicitly about Node running `.ts` directly), and Node 24.21.0 (already pinned via mise) supports this without flags. Avoid non-erasable TS syntax (no `enum`, no parameter-properties).

**Client**: plain JS ES modules, no TypeScript, no bundler — served as static files, loaded via `<script type="module">`. Deliberately not typed/bundled: disproportionate tooling for a handful of small game files.

**Persistence**: one flat JSON file at `/data/leaderboard.json` for the shared/global leaderboard — "smallest schema that can carry the requirement," per the brief's own wording. No SQLite, no DB engine. The player's own personal-best stats (score/time/size) live client-side in `localStorage`, not on the server — there's no accounts system this week, so "who is this player" is answered entirely by the browser remembering them, consistent with "whatever it decides counts as a person" being left open for now.

**No WebSockets this week.** Bots and the player are simulated entirely client-side in a `requestAnimationFrame` loop. There's no shared multi-user state yet to justify server authority over the game itself — only the global leaderboard is server-side, because it's the one piece of state that must persist and be shared.

Zero new runtime or dev dependencies for the whole scope.

## Server design

Single `http.createServer` in `src/server/index.ts`, dispatched by method+path:

| Method | Path | Behaviour |
|---|---|---|
| GET | `/` | Serves `public/index.html` (start screen + game shell, one page) |
| GET | `/<static>` | Serves files under `public/` by extension, path-traversal guarded, 404 otherwise |
| GET | `/readme/` | Renders `README.md` via a small hand-rolled Markdown→HTML converter |
| GET | `/readme/<asset>` | Passthrough to `docs/` for any images the README references |
| GET | `/api/leaderboard` | Returns top-10 entries as JSON |
| POST | `/api/leaderboard` | Accepts `{name, score, colour}`, validates, persists, returns updated top-10 |

`src/server/leaderboard.ts` handles load/validate/persist: atomic write (`.tmp` + rename) so a killed process can't corrupt the file, an in-process promise chain to serialize concurrent writes, top-10 trim by score descending. `name` trimmed/sanitized/capped (~16 chars, falls back to `"anon"`); `score` must be a finite non-negative integer or the request 400s; `colour` must be one of a fixed server-side palette (whitelist, not free-form hex/CSS — keeps validation trivial and keeps the leaderboard visually coherent with the game's palette) or the request 400s. `DATA_DIR` env var defaults to `/data` (matches `fly.toml`'s mount); created with `fs.mkdirSync(..., {recursive: true})` on startup so a fresh volume needs no seeding.

Leaderboard schema:
```json
{
  "entries": [
    { "name": "REEF", "score": 134, "colour": "coral", "achievedAt": "2026-10-04T10:15:00.000Z" }
  ]
}
```

## Client/game design

All under `public/game/`, plain JS, pure-function simulation core so it's portable once the server needs to become authoritative next week (a concrete hedge against rework, without building networking now):

- `profile.js` — the client-side "who is this player" module: reads/writes a single `localStorage` record `{ username, colour, personalBest: { score, size, timeSurvivedSeconds } }`. Used by both the start screen and the game-over flow; this is the one place personal-best state lives.
- `sim.js` — pure functions over a plain state object (`player`, `bots[]`, `food[]`, each entity `{id,x,y,vx,vy,size,colour}`): `step`, `resolveEating`, `spawnFood`, `respawnBot`. No DOM/fetch/canvas references.
- `bots.js` — simple priority AI: flee a bigger nearby entity > seek nearest edible food/entity > wander.
- `input.js` — pointer/touch position (WASD/arrow fallback) → desired heading.
- `render.js` — draws state to a 2D canvas, camera centered on player, entities tinted by their `colour`.
- `leaderboard.js` — `fetch` wrapper for the two API routes.
- `start.js` — renders the start screen: username text input, colour swatch picker (the same fixed palette the server whitelists), the player's personal-best panel from `profile.js` (blank/placeholder state if they're new), the current global top-10, and a Play button.
- `main.js` — orchestrates a small state machine (`start → playing → gameover → start`): on `start`, shows `start.js`'s screen; on Play, seeds `sim.js` state with the chosen name/colour and begins the `requestAnimationFrame` loop (`input → sim.step → resolveEating → render`); on death, computes final score/size/time, updates `profile.js`'s personal best if improved, shows the game-over overlay, POSTs to the global leaderboard, and returns to `start` (now showing the updated personal best).

Stats tracked per run: **size** (current/max size reached), **time** (seconds survived, simple elapsed-time counter), **score** (accumulates over the run as a function of size over time — e.g. integrate size × dt — so it rewards both growing big and staying alive, rather than duplicating size as a second label for the same number). Only `score` (plus name/colour) goes to the global leaderboard; all three are kept in the local personal-best panel.

Eating rules: pickups grow size by a fixed increment; eating another entity requires `attacker.size > defender.size * 1.1` (safety margin against same-size collisions), grows attacker by a fraction of defender's size, removes defender; bigger entities move slightly slower. Bots that die respawn after a short delay at minimum size so the world stays populated.

## File-by-file changes

**Delete**: `placeholder/` (directory and both HTML files).

**Rewrite**:
- `Dockerfile` — single-stage `FROM node:24-alpine`, copy `src/server`, `public`, `README.md`, `docs` (if present), `ENV PORT=8080`, `CMD ["node", "src/server/index.ts"]`. No install step (zero runtime deps).
- `tsconfig.json` — widen `include` to add `"src/server"` (client JS stays untyped, outside `include`).
- `package.json` — add `"start": "node src/server/index.ts"` and `"dev": "node --watch src/server/index.ts"`. No dependency changes.

**Create (server)**: `src/server/index.ts` (entry/routing), `src/server/static.ts` (safe static serving), `src/server/readme.ts` (`/readme/` + asset passthrough), `src/server/markdown.ts` (hand-rolled heading/paragraph/list/link/emphasis/code renderer — must preserve heading text so `spec/invariants.test.ts` passes), `src/server/leaderboard.ts` (now including the colour whitelist), `src/server/env.ts`.

**Create (client)**: `public/index.html` (holds both start-screen and in-game markup, toggled by `main.js`), `public/style.css`, `public/game/{main,sim,bots,input,render,leaderboard,start,profile}.js`.

**Create (student's own spec, following `invariants.test.ts`'s live-HTTP pattern)**:
- `spec/leaderboard.test.ts` — round-trips a submitted score; orders entries by score descending; rejects a malformed submission — missing fields, non-numeric score, and an invalid/non-whitelisted colour — asserting 400 and that the leaderboard is unchanged.
- `spec/game-shell.test.ts` — `/` serves a page containing the start-screen markup (e.g. a username input and colour picker) and a `<script type="module">`, and that script 200s with a JS content-type (proves the real game is deployed, not the placeholder).

**Student-authored, not to be fabricated wholesale** (draft structure/starting points only; the judgment is the student's):
- `README.md` — this week's definition of "good" for Reef, what's deliberately deferred (quoting the brief's own permission), how to verify the trace persists.
- `PROCESS.md` — replace the `TEMPLATE:` placeholder with the actual account, citing real commit hashes once they exist.
- `CLAUDE.md` — agent rules (e.g. don't touch `spec/invariants.test.ts`, client stays dependency-free, server stays native-TS).
- `reflections/crit-8.md` — personal reflection on the two standing prompts; should only be outlined, not written wholesale.

## Explicit non-goals this week

No WebSockets/real-time sync (crit 9). No accounts/auth beyond a localStorage-remembered name/colour. No DB engine beyond the flat JSON file. No server-authoritative game tick. No bundler or UI framework for the client. No free-form colour picker (fixed palette only, for validation simplicity and visual coherence).

## Verification

1. Local: `DATA_DIR=./.data PORT=8080 node src/server/index.ts`, visit `localhost:8080`, confirm the start screen shows a blank personal-best panel on first visit, lets you pick a name/colour, and that a second visit (same browser) shows the personal best from the first run. In another terminal, `APP_URL=http://localhost:8080 pnpm check`.
2. Docker parity with CI: `docker build -t app .`, `docker run -d --init -p 8080:8080 -e PORT=8080 --tmpfs /data app`, re-run `pnpm check` against it.
3. **Persistence across a restart** (CI's tmpfs can't prove this): run with a real bind mount (`-v "$(pwd)/.data:/data"`), submit a score via the UI, `docker stop && docker start` (not `rm`), confirm `GET /api/leaderboard` still has it.
4. Deploy: `flyctl deploy --remote-only --ha=false -a comp4020-final-quackyduck826`.
5. Verify live: `/` is 200, `/readme/` has all headings in order (re-run `spec/invariants.test.ts` with `APP_URL` pointed at the Fly URL), play the game as a stranger, submit a score, let the machine auto-stop (idle), hit the URL again to force a cold start, confirm the global leaderboard entry and (same browser) the personal-best panel both survived — the actual proof-of-life check.
6. Flip repo public at/near the Wednesday 07:00 cutoff so CI's `check`/`deploy` jobs start running on `main`.
7. `pnpm check:evidence` passes: `CLAUDE.md` non-empty, `reflections/crit-8.md` present, `PROCESS.md`'s `TEMPLATE:` comment gone, cited commit hashes resolve.
