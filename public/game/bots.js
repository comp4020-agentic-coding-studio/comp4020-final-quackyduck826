import { steer, WORLD } from "./sim.js";

const SIGHT = 350;
// A rival candidate must be this much closer before a bot drops its current
// chase target, so near-tied distances don't flip the heading every frame.
const SWITCH_MARGIN = 1.2;
// Time constant (seconds) for easing the flee heading toward its new raw
// value each frame, on top of averaging across threats: averaging fixes
// *which* direction counts as away, this fixes how fast that direction is
// let to change, damping the residual flicker left over as threats themselves
// keep moving frame to frame.
const FLEE_SMOOTHING = 0.4;
// A bot this close to the world edge gets a push back toward open water mixed
// into its heading, at full strength right at the wall and fading to nothing
// by WALL_MARGIN away. Without this a flee vector pointing into a wall stalls
// the bot's position (step()'s clamp) while its heading keeps chasing that
// unreachable target as the threat moves, which reads as spinning in place.
const WALL_MARGIN = 220;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// 0 away from every edge, ramping to 1 right at the wall, each axis independent.
function wallPush(e) {
  const push = (p) => (p < WALL_MARGIN ? (WALL_MARGIN - p) / WALL_MARGIN : p > WORLD - WALL_MARGIN ? -(p - (WORLD - WALL_MARGIN)) / WALL_MARGIN : 0);
  return { x: push(e.x), y: push(e.y) };
}

function closestMatching(b, all, predicate) {
  let entity = null;
  let best = Infinity;
  for (const o of all) {
    if (o === b) continue;
    const d = dist(b, o);
    if (d > SIGHT) continue;
    if (predicate(o) && d < best) {
      entity = o;
      best = d;
    }
  }
  return { entity, dist: best };
}

// Sticks with whatever entity `b` is already chasing (tracked by id in `key`)
// unless a fresh candidate beats it by more than SWITCH_MARGIN.
function pickSticky(b, key, all, predicate) {
  const candidate = closestMatching(b, all, predicate);
  const prev = b[key] != null ? all.find((o) => o.id === b[key]) : null;
  if (prev && predicate(prev)) {
    const prevDist = dist(b, prev);
    if (prevDist <= SIGHT && prevDist < candidate.dist * SWITCH_MARGIN) {
      return prev;
    }
  }
  b[key] = candidate.entity ? candidate.entity.id : null;
  return candidate.entity;
}

// Flees the weighted-average direction away from every bigger nearby entity,
// rather than one picked threat: each contributes a unit vector pointing away
// from it, weighted by size / distance^2, so a closer or bigger threat pulls
// the heading harder. Two threats flanking a bot blend into one stable escape
// direction this way, instead of the heading snapping back and forth as
// "nearest" trades places between them frame to frame.
function fleeHeading(b, all) {
  let vx = 0, vy = 0, nearest = null, nearestDist = Infinity;
  for (const o of all) {
    if (o === b) continue;
    if (o.size <= b.size * 1.1) continue;
    const d = dist(b, o);
    if (d > SIGHT) continue;
    if (d < nearestDist) {
      nearest = o;
      nearestDist = d;
    }
    const weight = o.size / Math.max(d * d, 1);
    vx += ((b.x - o.x) / Math.max(d, 1)) * weight;
    vy += ((b.y - o.y) / Math.max(d, 1)) * weight;
  }
  if (!nearest) return null;
  // Threats roughly cancel out (e.g. flanked symmetrically): break the tie on
  // the single nearest one instead of normalising near-zero noise into an
  // arbitrary direction.
  if (Math.hypot(vx, vy) < 1e-3) return { x: b.x - nearest.x, y: b.y - nearest.y };
  return { x: vx, y: vy };
}

// Priority: flee nearby bigger entities (blended) > chase nearest edible > wander.
export function updateBots(state, dt) {
  const all = [...state.players, ...state.bots];
  for (const b of state.bots) {
    const flee = fleeHeading(b, all);
    let target = null;
    if (flee) {
      b.targetId = null;
    } else {
      target = pickSticky(b, "targetId", all, (o) => b.size > o.size * 1.1);
    }
    if (!flee && !target) {
      for (const f of state.food) {
        const d = dist(b, f);
        if (d < SIGHT && (!target || d < dist(b, target))) target = f;
      }
    }
    let hx, hy;
    if (flee) [hx, hy] = [flee.x, flee.y];
    else if (target) [hx, hy] = [target.x - b.x, target.y - b.y];
    else {
      b.wander = (b.wander ?? Math.random() * 6.28) + (Math.random() - 0.5) * dt * 2;
      [hx, hy] = [Math.cos(b.wander), Math.sin(b.wander)];
    }
    let len = Math.hypot(hx, hy) || 1;
    [hx, hy] = [hx / len, hy / len];

    if (flee) {
      // Ease toward the raw flee heading rather than snapping to it, so the
      // residual frame-to-frame noise in `fleeHeading`'s weighted sum (threats
      // themselves keep moving) doesn't read as a flicker on top of the
      // already-blended direction. Non-flee headings (chase/wander) don't need
      // this: a chase target is one sticky entity, and wander is deliberately
      // smooth already.
      if (b.fleeHx == null) {
        [b.fleeHx, b.fleeHy] = [hx, hy];
      } else {
        const t = Math.min(1, dt / FLEE_SMOOTHING);
        b.fleeHx += (hx - b.fleeHx) * t;
        b.fleeHy += (hy - b.fleeHy) * t;
      }
      len = Math.hypot(b.fleeHx, b.fleeHy) || 1;
      [hx, hy] = [b.fleeHx / len, b.fleeHy / len];
    } else {
      b.fleeHx = null;
      b.fleeHy = null;
    }

    // Blended in after smoothing, not before: it has to win outright near a
    // wall regardless of whatever the (possibly still-easing) flee heading
    // wants, or a strong flee pull keeps the resulting direction aimed at the
    // wall anyway and the spin returns.
    const wall = wallPush(b);
    if (wall.x || wall.y) {
      hx += wall.x * 2;
      hy += wall.y * 2;
      len = Math.hypot(hx, hy) || 1;
      [hx, hy] = [hx / len, hy / len];
    }

    steer(b, hx, hy, dt);
  }
}
