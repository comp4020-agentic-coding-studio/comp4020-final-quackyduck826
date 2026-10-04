import { steer } from "./sim.js";

const SIGHT = 350;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Priority: flee a bigger nearby entity > chase nearest edible > wander.
export function updateBots(state, dt) {
  const all = [state.player, ...state.bots];
  for (const b of state.bots) {
    let target = null;
    let flee = null;
    for (const o of all) {
      if (o === b) continue;
      const d = dist(b, o);
      if (d > SIGHT) continue;
      if (o.size > b.size * 1.1 && (!flee || d < dist(b, flee))) flee = o;
      else if (b.size > o.size * 1.1 && (!target || d < dist(b, target))) target = o;
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
