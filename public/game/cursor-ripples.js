// Shared "cursor wake" ripple-trail effect: as the pointer moves, small
// ripple stamps (each a cluster of concentric circles) are dropped at
// intervals along its path and left to expand/fade, forming a trailing wake
// behind the cursor rather than one ripple growing in place at a fixed
// point. Used by both render.js (in-game, pointer given in world
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

const DEFAULT_LIFETIME = 1.7; // seconds for one wake stamp to expand and fade out
const DEFAULT_MAX_RADIUS = 46;
// Min pointer travel before a new stamp is dropped, so it reads as a sparse
// trail, not every-frame noise. Randomised per-stamp (within this range)
// rather than one fixed threshold, so the stamps land at uneven, organic
// spacing along the trail instead of a perfectly even row of dots.
const DEFAULT_SPAWN_DISTANCE_MIN = 50;
const DEFAULT_SPAWN_DISTANCE_MAX = 110;
const DEFAULT_MAX_OPACITY = 0.22;
// Each stamp is a real water-ripple cluster of concentric circles (2-4,
// randomised per stamp) sharing one centre/colour/age rather than a single
// ring, spaced a fixed fraction of maxRadius apart so they expand outward
// together at a constant gap. MIN/MAX bound how many concentric circles a
// stamp can have; RING_GAP_FRACTION sets that spacing.
const MIN_RINGS_PER_STAMP = 2;
const MAX_RINGS_PER_STAMP = 4;
const RING_GAP_FRACTION = 0.22;

// Returns a small stateful tracker. Call `update(x, y, dt)` once per frame
// with the current pointer position — in whatever coordinate space the
// caller draws in (world coordinates for render.js, screen coordinates for
// puddle-bg.js; this module has no opinion on that) — to age existing rings
// and drop a new stamp once the pointer has moved far enough since the last
// one. Pass `null`/`undefined` x/y when the pointer position isn't known yet
// (e.g. before the first pointermove) to just age/fade whatever trail
// already exists without dropping a new stamp at a bogus position. Then call
// `draw(ctx)` to render whatever stamps are currently alive.
export function createCursorWake({
  lifetime = DEFAULT_LIFETIME,
  maxRadius = DEFAULT_MAX_RADIUS,
  spawnDistanceMin = DEFAULT_SPAWN_DISTANCE_MIN,
  spawnDistanceMax = DEFAULT_SPAWN_DISTANCE_MAX,
  maxOpacity = DEFAULT_MAX_OPACITY,
  colours = WAKE_COLOURS,
} = {}) {
  let stamps = [];
  let lastX = null;
  let lastY = null;
  // Rolled once up front and re-rolled after each stamp (not read fresh every
  // frame) so the threshold for the *next* stamp stays fixed while the
  // pointer travels toward it, rather than jittering frame to frame.
  let nextSpawnDistance = spawnDistanceMin + Math.random() * (spawnDistanceMax - spawnDistanceMin);

  function update(x, y, dt) {
    stamps.forEach((s) => (s.age += dt));
    stamps = stamps.filter((s) => s.age < lifetime);
    if (x == null || y == null) {
      lastX = lastY = null;
      return;
    }
    const moved = lastX == null ? Infinity : Math.hypot(x - lastX, y - lastY);
    if (moved >= nextSpawnDistance) {
      const ringCount = MIN_RINGS_PER_STAMP + Math.floor(Math.random() * (MAX_RINGS_PER_STAMP - MIN_RINGS_PER_STAMP + 1));
      stamps.push({ x, y, age: 0, ringCount, colour: colours[Math.floor(Math.random() * colours.length)] });
      lastX = x;
      lastY = y;
      nextSpawnDistance = spawnDistanceMin + Math.random() * (spawnDistanceMax - spawnDistanceMin);
    }
  }

  function draw(ctx) {
    for (const s of stamps) {
      const t = s.age / lifetime;
      const opacity = (1 - t) * maxOpacity;
      ctx.strokeStyle = `rgba(${s.colour}, ${opacity})`;
      ctx.lineWidth = 2;
      // Concentric circles, each trailing the outermost by a fixed fraction of
      // maxRadius, so the whole cluster reads as one expanding ripple rather
      // than independently growing circles drifting apart.
      for (let i = 0; i < s.ringCount; i++) {
        const radius = maxRadius * t - i * maxRadius * RING_GAP_FRACTION;
        if (radius <= 0) continue;
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  return { update, draw };
}
