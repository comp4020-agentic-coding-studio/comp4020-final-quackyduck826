// Pure simulation: no DOM, fetch, canvas or network references, so the exact
// same functions run the shared authoritative world on the server and (with a
// bot-only, player-less world) painted the single-player version this used to
// be. State is a plain object; players now live in a `players` array rather
// than a single `player` field, since several real connections can share one
// world.
import { randomFishName } from "./fish-names.js";

export const WORLD = 2000;
export const START_SIZE = 10;
const FOOD_GROWTH = 1;
const EAT_MARGIN = 1.1;
const FOOD_COUNT = 70;
const BASE_SPEED = 160;
// Past this score an entity can only eat other players (bots don't count).
export const EAT_LOCK_SCORE = 3000;
const BIG_BOTS = 3;
const BIG_BOT_MIN = 40;
const BIG_BOT_RANGE = 30; // big bots spawn at BIG_BOT_MIN..BIG_BOT_MIN+BIG_BOT_RANGE
const SAFE_DISTANCE = 500;
const TURN_RATE = 8; // radians/sec an entity can turn to face its heading
const SHRINK_SIZE = 40; // past this size an entity shrinks over time
const SHRINK_RATE = 1 / 3; // size lost per second while above SHRINK_SIZE
const KELP_EAT_SIZE = 60; // past this size a fish has outgrown eating kelp
const DASH_BOOST = 2.2; // speed multiplier while dashing
export const DASH_DURATION = 0.3; // seconds the dash burst lasts
const DASH_PENALTY = 0.55; // speed multiplier during the post-dash slowdown
export const DASH_PENALTY_DURATION = 2.5; // seconds of slowdown that pays for the dash

let nextId = 1;
const rand = (n) => Math.random() * n;

// `name` defaults to a random fish pun; the caller overwrites it with a
// player's own username right after creating their entity.
export function makeEntity(colour, size = START_SIZE) {
  return {
    id: nextId++, x: rand(WORLD), y: rand(WORLD), vx: 0, vy: 0, size, colour,
    angle: rand(Math.PI * 2), tailWag: rand(Math.PI * 2), dashTimer: 0, dashPenaltyTimer: 0,
    name: randomFishName(),
  };
}

// No-op while already dashing or still paying off the last one.
export function triggerDash(e) {
  if (e.dashTimer > 0 || e.dashPenaltyTimer > 0) return;
  e.dashTimer = DASH_DURATION;
}

export function spawnFood(colourPool) {
  return { id: nextId++, x: rand(WORLD), y: rand(WORLD), size: 3, colour: colourPool[Math.floor(rand(colourPool.length))] };
}

// A world with no players yet: bots and food only. `addPlayer` below adds
// players as they join and `removePlayer` as they leave or die, independent
// of the world's own lifetime — joining or leaving never resets it.
export function createWorld(botColours, botCount = 14) {
  const state = { players: [], bots: [], food: [], respawns: [], events: [], elapsed: 0, palette: botColours };
  for (let i = 0; i < botCount; i++) state.bots.push(makeEntity(botColours[i % botColours.length], START_SIZE + rand(15)));
  for (let i = 0; i < BIG_BOTS; i++) {
    const big = makeEntity(botColours[i % botColours.length], BIG_BOT_MIN + rand(BIG_BOT_RANGE));
    big.big = true;
    state.bots.push(big);
  }
  while (state.food.length < FOOD_COUNT) state.food.push(spawnFood(botColours));
  return state;
}

// Adds a new player entity to an existing world, spawned away from other
// players and big bots so joining doesn't drop someone into an immediate
// bite. Returns the new entity; caller sets its name.
export function addPlayer(state, colour) {
  const player = makeEntity(colour);
  player.isPlayer = true;
  player.score = 0;
  player.maxSize = START_SIZE;
  player.joinedAt = state.elapsed;
  const threats = () => [...state.players, ...state.bots.filter((b) => b.big)];
  let tries = 0;
  while (tries++ < 20 && threats().some((t) => Math.hypot(t.x - player.x, t.y - player.y) < SAFE_DISTANCE)) {
    [player.x, player.y] = [rand(WORLD), rand(WORLD)];
  }
  state.players.push(player);
  return player;
}

export function removePlayer(state, player) {
  state.players = state.players.filter((p) => p !== player);
}

const speedFor = (e) => {
  const base = BASE_SPEED / (1 + e.size / 60);
  if (e.dashTimer > 0) return base * DASH_BOOST;
  if (e.dashPenaltyTimer > 0) return base * DASH_PENALTY;
  return base;
};

// Heading is a unit vector (or zero); applies to the entity velocity.
// With `dt`, velocity is capped to TURN_RATE rad/s like the facing angle is in
// `step()`, so a desired heading that swings wildly frame to frame (e.g. a
// fleeing bot at close range, where the relative-position vector is hyper-
// sensitive to tiny moves) turns the entity smoothly instead of snapping its
// path instantly. Without `dt` (a player's own input) the heading is applied
// as-is, for instant, arcade-responsive control.
export function steer(e, hx, hy, dt) {
  const s = speedFor(e);
  if (dt == null) {
    e.vx = hx * s;
    e.vy = hy * s;
    return;
  }
  const desired = Math.atan2(hy, hx);
  let diff = (desired - e.angle) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  e.angle += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
  e.angle = (((e.angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  e.vx = Math.cos(e.angle) * s;
  e.vy = Math.sin(e.angle) * s;
}

const clamp = (v) => Math.min(WORLD, Math.max(0, v));

export function respawnBot(state, { colour, big }) {
  const bot = makeEntity(colour, big ? BIG_BOT_MIN + rand(BIG_BOT_RANGE) : START_SIZE);
  if (big) {
    bot.big = true;
    let tries = 0;
    while (tries++ < 20 && state.players.some((p) => Math.hypot(bot.x - p.x, bot.y - p.y) < SAFE_DISTANCE)) {
      [bot.x, bot.y] = [rand(WORLD), rand(WORLD)];
    }
  }
  state.bots.push(bot);
}

export const eatingLocked = (entity) => entity.isPlayer && entity.score >= EAT_LOCK_SCORE;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// True when `prey` is in front of `attacker`'s own facing direction, i.e.
// `attacker` is biting with its head half, not bumping prey with its tail.
function bitingWithHead(attacker, prey) {
  const facing = Math.cos(attacker.angle) * (prey.x - attacker.x) + Math.sin(attacker.angle) * (prey.y - attacker.y);
  return facing > 0;
}

// Mutates `state` in place: entities grow/die, dead players and bots are
// removed, bot deaths are queued to respawn, food is topped back up. Every
// eat-another-entity kill (bot or player, either side) is recorded in
// `state.events` with the bite's position, so a caller (the room tick loop,
// then the client) can play a bite effect there; `victimIsPlayer` additionally
// lets the room tell a real death apart from one who's still connected but
// just hasn't been snapshotted since dying.
export function resolveEating(state) {
  const all = [...state.players, ...state.bots];
  const dead = new Set();
  // Pickups
  for (const e of all) {
    if (eatingLocked(e)) continue;
    if (e.size > KELP_EAT_SIZE) continue;
    state.food = state.food.filter((f) => {
      if (dist(e, f) < e.size) {
        e.size += FOOD_GROWTH;
        return false;
      }
      return true;
    });
  }
  // Entities
  for (const a of all) {
    if (dead.has(a)) continue;
    for (const d of all) {
      if (a === d || dead.has(d)) continue;
      // A locked attacker may only eat other players; bots aren't players.
      if (eatingLocked(a) && !d.isPlayer) continue;
      if (a.size > d.size * EAT_MARGIN && dist(a, d) < a.size - d.size * 0.3 && bitingWithHead(a, d)) {
        a.size += d.size * 0.4;
        dead.add(d);
        state.events.push({ type: "eaten", x: d.x, y: d.y, victim: d.id, victimIsPlayer: !!d.isPlayer, by: { name: a.name, colour: a.colour } });
      }
    }
  }
  state.players = state.players.filter((p) => !dead.has(p));
  for (const b of state.bots.filter((b) => dead.has(b))) state.respawns.push({ at: state.elapsed + 3, colour: b.colour, big: b.big });
  state.bots = state.bots.filter((b) => !dead.has(b));
  while (state.food.length < FOOD_COUNT) state.food.push(spawnFood(state.palette));
}

export function step(state, dt) {
  state.elapsed += dt;
  for (const e of [...state.players, ...state.bots]) {
    e.x = clamp(e.x + e.vx * dt);
    e.y = clamp(e.y + e.vy * dt);
    const speed = Math.hypot(e.vx, e.vy);
    if (speed > 1) {
      const target = Math.atan2(e.vy, e.vx);
      let diff = (target - e.angle) % (Math.PI * 2);
      if (diff > Math.PI) diff -= Math.PI * 2;
      if (diff < -Math.PI) diff += Math.PI * 2;
      e.angle += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));
      e.angle = (((e.angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    }
    e.tailWag += dt * (3 + speed * 0.03);
    if (e.dashTimer > 0) {
      e.dashTimer -= dt;
      if (e.dashTimer <= 0) {
        e.dashTimer = 0;
        e.dashPenaltyTimer = DASH_PENALTY_DURATION;
      }
    } else if (e.dashPenaltyTimer > 0) {
      e.dashPenaltyTimer = Math.max(0, e.dashPenaltyTimer - dt);
    }
    if (e.size > SHRINK_SIZE) e.size = Math.max(SHRINK_SIZE, e.size - SHRINK_RATE * dt);
  }
  for (const p of state.players) {
    p.maxSize = Math.max(p.maxSize, p.size);
    // Score tracks the peak size reached, so shrinking back down doesn't cost it.
    p.score = p.maxSize;
  }
  const due = state.respawns.filter((r) => r.at <= state.elapsed);
  state.respawns = state.respawns.filter((r) => r.at > state.elapsed);
  for (const r of due) respawnBot(state, r);
}
