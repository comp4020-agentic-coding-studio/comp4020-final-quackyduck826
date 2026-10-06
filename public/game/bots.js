import { steer } from "./sim.js";

const SIGHT = 350;
// A rival candidate must be this much closer before a bot drops its current
// flee/chase target, so near-tied distances don't flip the heading every frame.
const SWITCH_MARGIN = 1.2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

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

// Sticks with whatever entity `b` is already fleeing/chasing (tracked by id in
// `key`) unless a fresh candidate beats it by more than SWITCH_MARGIN.
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

// Priority: flee a bigger nearby entity > chase nearest edible > wander.
export function updateBots(state, dt) {
  const all = [state.player, ...state.bots];
  for (const b of state.bots) {
    const flee = pickSticky(b, "fleeId", all, (o) => o.size > b.size * 1.1);
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
    if (flee) [hx, hy] = [b.x - flee.x, b.y - flee.y];
    else if (target) [hx, hy] = [target.x - b.x, target.y - b.y];
    else {
      b.wander = (b.wander ?? Math.random() * 6.28) + (Math.random() - 0.5) * dt * 2;
      [hx, hy] = [Math.cos(b.wander), Math.sin(b.wander)];
    }
    const len = Math.hypot(hx, hy) || 1;
    steer(b, hx / len, hy / len);
  }
}
