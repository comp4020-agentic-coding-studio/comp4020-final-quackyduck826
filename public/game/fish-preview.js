import { drawFish } from "./render.js";

// The fish's drawn radius (nose/tail/fin tip, worst case over the tail-wag
// cycle) is ~2.83x its `size` — see render.js's drawFish. The preview picks
// `size` so that radius fits inside the canvas's own half-extent (with a
// margin), so the fish can face any direction at all without clipping on a
// square canvas, rather than using a fixed size tuned for one orientation.
const FISH_MAX_RADIUS_FACTOR = 2.83;
const FIT_MARGIN = 0.92;

// Starts the fish-preview canvas snapping to face the mouse. Like
// puddle-bg.js's startPuddleBackground, safe to call before the canvas is in
// the document (returns a no-op) and returns a stop function. `getLook` is
// called once per frame for the current { colour, hat } to show — read live
// rather than passed once, so the preview updates immediately as the start
// screen's own colour/hat selection changes, without this module needing to
// know anything about start.js's form state.
export function startFishPreview(canvasId, getLook) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return () => {};
  const ctx = canvas.getContext("2d");
  let running = true;
  // Defaults to facing right until the pointer first moves over the canvas,
  // rather than snapping to face the very first mouse position recorded
  // anywhere on the page. Unlike in-game steering, the preview has no slow
  // turn to ease: it locks straight onto the pointer so the fish's facing
  // always matches the cursor immediately.
  let angle = 0;

  function resize() {
    const dpr = devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: h } = canvas;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener("resize", resize);

  function onMove(ev) {
    const r = canvas.getBoundingClientRect();
    const dx = ev.clientX - (r.left + r.width / 2);
    const dy = ev.clientY - (r.top + r.height / 2);
    // Below a small dead zone, keep the last heading rather than letting the
    // angle jitter around the fish's own centre point.
    if (Math.hypot(dx, dy) > 4) angle = Math.atan2(dy, dx);
  }
  addEventListener("pointermove", onMove);

  function frame(now) {
    if (!running) return;

    const { clientWidth: w, clientHeight: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    const { colour, hat } = getLook();
    const size = (Math.min(w, h) / 2) * (FIT_MARGIN / FISH_MAX_RADIUS_FACTOR);
    drawFish(
      ctx,
      { x: w / 2, y: h / 2, angle, tailWag: now / 300, size, colour, hat },
      false,
      false,
    );
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => {
    running = false;
    removeEventListener("resize", resize);
    removeEventListener("pointermove", onMove);
  };
}
