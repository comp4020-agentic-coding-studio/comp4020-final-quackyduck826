// Pure simulation: no DOM, fetch or canvas. State is a plain object.
export const WORLD = 2000;
export const START_SIZE = 10;
const FOOD_GROWTH = 1;
const EAT_MARGIN = 1.1;
const FOOD_COUNT = 40;
const BASE_SPEED = 160;
// Past this score the player can only eat other players (bots don't count).
export const EAT_LOCK_SCORE = 3000;
const BIG_BOTS = 5;
const SAFE_DISTANCE = 500;
const TURN_RATE = 8; // radians/sec an entity can turn to face its heading
const SHRINK_SIZE = 40; // past this size the player shrinks over time
const SHRINK_RATE = 1; // size lost per second while above SHRINK_SIZE
const KELP_EAT_SIZE = 65; // past this size a fish has outgrown eating kelp
const DASH_BOOST = 2.2; // speed multiplier while dashing
const DASH_DURATION = 0.18; // seconds the dash burst lasts
const DASH_PENALTY = 0.55; // speed multiplier during the post-dash slowdown
const DASH_PENALTY_DURATION = 2.5; // seconds of slowdown that pays for the dash

let nextId = 1;
const rand = (n) => Math.random() * n;

export function makeEntity(colour, size = START_SIZE) {
  return {
    id: nextId++, x: rand(WORLD), y: rand(WORLD), vx: 0, vy: 0, size, colour,
    angle: rand(Math.PI * 2), tailWag: rand(Math.PI * 2), dashTimer: 0, dashPenaltyTimer: 0,
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

export function createState(playerColour, botColours, botCount = 14) {
  const player = makeEntity(playerColour);
  player.isPlayer = true;
  const state = { player, bots: [], food: [], elapsed: 0, score: 0, maxSize: START_SIZE, alive: true, respawns: [], palette: botColours };
  for (let i = 0; i < botCount; i++) state.bots.push(makeEntity(botColours[i % botColours.length], START_SIZE + rand(15)));
  // Large bots from the start, spawned well away from the player.
  for (let i = 0; i < BIG_BOTS; i++) {
    const big = makeEntity(botColours[i % botColours.length], 60 + rand(50));
    while (Math.hypot(big.x - player.x, big.y - player.y) < SAFE_DISTANCE) [big.x, big.y] = [rand(WORLD), rand(WORLD)];
    big.big = true;
    state.bots.push(big);
  }
  while (state.food.length < FOOD_COUNT) state.food.push(spawnFood(botColours));
  return state;
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
// path instantly. Without `dt` (the player) the heading is applied as-is, for
// instant, arcade-responsive control.
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
  const bot = makeEntity(colour, big ? 60 + rand(50) : START_SIZE);
  if (big) {
    bot.big = true;
    while (Math.hypot(bot.x - state.player.x, bot.y - state.player.y) < SAFE_DISTANCE) [bot.x, bot.y] = [rand(WORLD), rand(WORLD)];
  }
  state.bots.push(bot);
}

export const eatingLocked = (state) => state.score >= EAT_LOCK_SCORE;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// True when `prey` is in front of `attacker`'s own facing direction, i.e.
// `attacker` is biting with its head half, not bumping prey with its tail.
function bitingWithHead(attacker, prey) {
  const facing = Math.cos(attacker.angle) * (prey.x - attacker.x) + Math.sin(attacker.angle) * (prey.y - attacker.y);
  return facing > 0;
}

export function resolveEating(state) {
  const all = [state.player, ...state.bots];
  const dead = new Set();
  // Pickups
  const locked = eatingLocked(state);
  for (const e of all) {
    if (locked && e.isPlayer) continue;
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
      // Locked player may only eat other players; bots aren't players.
      if (locked && a.isPlayer && !d.isPlayer) continue;
      if (a.size > d.size * EAT_MARGIN && dist(a, d) < a.size - d.size * 0.3 && bitingWithHead(a, d)) {
        a.size += d.size * 0.4;
        dead.add(d);
        if (d === state.player) state.eatenBy = { name: a.name, colour: a.colour };
      }
    }
  }
  if (dead.has(state.player)) state.alive = false;
  for (const b of state.bots.filter((b) => dead.has(b))) state.respawns.push({ at: state.elapsed + 3, colour: b.colour, big: b.big });
  state.bots = state.bots.filter((b) => !dead.has(b));
  while (state.food.length < FOOD_COUNT) state.food.push(spawnFood(state.palette));
}

export function step(state, dt) {
  state.elapsed += dt;
  for (const e of [state.player, ...state.bots]) {
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
  }
  state.maxSize = Math.max(state.maxSize, state.player.size);
  if (state.player.size > SHRINK_SIZE) {
    state.player.size = Math.max(SHRINK_SIZE, state.player.size - SHRINK_RATE * dt);
  }
  // Score tracks the peak size reached, so shrinking back down doesn't cost it.
  state.score = state.maxSize;
  const due = state.respawns.filter((r) => r.at <= state.elapsed);
  state.respawns = state.respawns.filter((r) => r.at > state.elapsed);
  for (const r of due) respawnBot(state, r);
}
