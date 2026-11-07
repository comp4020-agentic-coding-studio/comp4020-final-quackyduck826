// A quiet animated backdrop for the start screen: plain 2D canvas, no assets,
// matching the drawing style used by render.js for the in-game scene. The
// ambient ripple rings this used to spawn at random points have been replaced
// by a cursor-wake trail (see cursor-ripples.js) tracking the mouse over the
// whole viewport — same effect render.js now uses in-game, just fed screen
// coordinates directly since this canvas isn't a world-camera view.
import { createCursorWake } from "./cursor-ripples.js";

// Oversized versions of the in-game food sprig (see render.js's drawFood):
// the same three-curved-blades-round-a-base shape, scaled way up and rooted
// along the bottom edge, with a slow sway so the backdrop doesn't feel static.
// Coloured like the in-level kelp patches (render.js's buildSeafloor), not
// the opaque food sprigs, so it reads as the same translucent weed.
const SEAWEED_COUNT = 5;

function kelpGreen() {
  return `rgba(${20 + Math.random() * 20}, ${70 + Math.random() * 30}, ${55 + Math.random() * 20}, .5)`;
}

function spawnSeaweed(w, h) {
  return {
    x: Math.random() * w,
    y: h + 10 + Math.random() * 20,
    size: 240 + Math.random() * 220,
    colour: kelpGreen(),
    seed: Math.random() * 100,
  };
}

function drawSeaweed(ctx, s, t) {
  ctx.strokeStyle = s.colour;
  ctx.lineWidth = Math.max(8, s.size * 0.045);
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const sway = Math.sin(t * 0.5 + s.seed + i) * 0.22;
    const angle = -Math.PI / 2 + (i - 1) * 0.4 + sway;
    const bend = angle + 0.3;
    const midX = s.x + Math.cos(bend) * s.size * 0.5;
    const midY = s.y + Math.sin(bend) * s.size * 0.5;
    const endX = s.x + Math.cos(angle) * s.size;
    const endY = s.y + Math.sin(angle) * s.size;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();
  }
}

// Starts the animation on the #puddle-bg canvas and returns a stop function.
// Safe to call even if the canvas isn't in the document yet (returns a no-op).
export function startPuddleBackground(canvasId = "puddle-bg") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return () => {};
  const ctx = canvas.getContext("2d");
  let running = true;
  let seaweeds = [];

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
    // Re-rooted on resize since their position depends on the canvas size.
    seaweeds = Array.from({ length: SEAWEED_COUNT }, () => spawnSeaweed(canvas.width, canvas.height));
  }
  resize();
  addEventListener("resize", resize);

  // Screen-space pointer (plain clientX/Y relative to the canvas, which
  // covers the whole viewport per its CSS rule) tracked the same way
  // fish-preview.js's onMove does, fed straight into the shared cursor-wake
  // tracker each frame — no world/camera conversion needed here since this
  // background isn't a world-camera view.
  const wake = createCursorWake();
  let pointer = null;
  function onMove(ev) {
    const r = canvas.getBoundingClientRect();
    pointer = { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }
  addEventListener("pointermove", onMove);

  let last = performance.now();
  let elapsed = 0;
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const { width: w, height: h } = canvas;

    ctx.fillStyle = "#06222f";
    ctx.fillRect(0, 0, w, h);

    seaweeds.forEach((s) => drawSeaweed(ctx, s, elapsed));

    wake.update(pointer?.x, pointer?.y, dt);
    wake.draw(ctx);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => {
    running = false;
    removeEventListener("resize", resize);
    removeEventListener("pointermove", onMove);
  };
}
