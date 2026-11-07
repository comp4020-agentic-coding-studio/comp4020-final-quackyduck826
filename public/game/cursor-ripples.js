// Shared "cursor wake" ripple-trail effect: as the pointer moves, small rings
// are stamped at intervals along its path and left to expand/fade, forming a
// trailing wake behind the cursor rather than one ripple growing in place at
// a fixed point. Used by both render.js (in-game, pointer given in world
// space so the wake pans with the camera) and puddle-bg.js (start-menu
// background, pointer given in plain screen space) — the two differ only in
// what coordinate space they feed in, so the spawn/age/fade logic lives here
// once instead of being duplicated.
//
// This is a purely local rendering effect: it's driven by the local pointer
// and only ever touches the canvas passed to `draw`, never `net.js` or any
// server state, so nothing here is visible to (or sent to) other players.
//
// Colours lean on the same neon accents the rest of this session's redesign
// uses (render.js's NEON_PALETTE: cyan/pink/amber/lime), at a low opacity so
// the trail reads as a quiet wake rather than competing with fish/food for
// attention — the same "kept subtle" spirit the old ambient ripples had.
export const WAKE_COLOURS = ["82, 241, 255", "255, 79, 216", "255, 179, 71", "182, 255, 60"];

const DEFAULT_LIFETIME = 1.1; // seconds for one wake ring to expand and fade out
const DEFAULT_MAX_RADIUS = 46;
const DEFAULT_SPAWN_DISTANCE = 18; // min pointer travel before a new ring is stamped, so it reads as a trail, not every-frame noise
const DEFAULT_MAX_OPACITY = 0.22;

// Returns a small stateful tracker. Call `update(x, y, dt)` once per frame
// with the current pointer position — in whatever coordinate space the
// caller draws in (world coordinates for render.js, screen coordinates for
// puddle-bg.js; this module has no opinion on that) — to age existing rings
// and stamp a new one once the pointer has moved far enough since the last
// stamp. Pass `null`/`undefined` x/y when the pointer position isn't known
// yet (e.g. before the first pointermove) to just age/fade whatever trail
// already exists without stamping a new ring at a bogus position. Then call
// `draw(ctx)` to render whatever rings are currently alive.
export function createCursorWake({
  lifetime = DEFAULT_LIFETIME,
  maxRadius = DEFAULT_MAX_RADIUS,
  spawnDistance = DEFAULT_SPAWN_DISTANCE,
  maxOpacity = DEFAULT_MAX_OPACITY,
  colours = WAKE_COLOURS,
} = {}) {
  let rings = [];
  let lastX = null;
  let lastY = null;

  function update(x, y, dt) {
    rings.forEach((r) => (r.age += dt));
    rings = rings.filter((r) => r.age < lifetime);
    if (x == null || y == null) {
      lastX = lastY = null;
      return;
    }
    const moved = lastX == null ? Infinity : Math.hypot(x - lastX, y - lastY);
    if (moved >= spawnDistance) {
      rings.push({ x, y, age: 0, colour: colours[Math.floor(Math.random() * colours.length)] });
      lastX = x;
      lastY = y;
    }
  }

  function draw(ctx) {
    for (const r of rings) {
      const t = r.age / lifetime;
      const radius = maxRadius * t;
      const opacity = (1 - t) * maxOpacity;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r.colour}, ${opacity})`;
      ctx.lineWidth = 2;
      ctx.arc(r.x, r.y, Math.max(0, radius), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return { update, draw };
}
