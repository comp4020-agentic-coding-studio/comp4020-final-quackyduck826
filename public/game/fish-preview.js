import { drawFish } from "./render.js";

// Fixed body size for the preview — the "you" entity shape drawFish expects,
// but there's no real game state here, just a colour and a hat to show off.
const PREVIEW_SIZE = 60;
// How far (radians/sec) the heading eases toward the pointer each frame; a
// constant rotation speed, not proportional to the angle gap, so the turn
// reads the same unhurried speed whether the mouse is a little or a lot off
// to one side, rather than a slow creep for pointer, fast whip for far ones.
const TURN_RATE = 2.2;

// Starts the fish-preview canvas spinning to follow the mouse. Like
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
  let angle = 0;
  // Defaults to facing right until the pointer first moves over the canvas,
  // rather than snapping to face the very first mouse position recorded
  // anywhere on the page.
  let pointerAngle = 0;

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
    if (Math.hypot(dx, dy) > 4) pointerAngle = Math.atan2(dy, dx);
  }
  addEventListener("pointermove", onMove);

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    let diff = (pointerAngle - angle) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    angle += Math.max(-TURN_RATE * dt, Math.min(TURN_RATE * dt, diff));

    const { clientWidth: w, clientHeight: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    const { colour, hat } = getLook();
    drawFish(
      ctx,
      { x: w / 2, y: h / 2, angle, tailWag: now / 300, size: PREVIEW_SIZE, colour, hat },
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
