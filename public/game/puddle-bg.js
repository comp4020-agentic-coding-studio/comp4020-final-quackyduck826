// A quiet animated backdrop for the start screen: a handful of concentric
// ripple rings expand outward from randomised points and fade as they grow,
// each respawning elsewhere once it's done. Plain 2D canvas, no assets,
// matching the drawing style used by render.js for the in-game scene.
const RING_COLOURS = ["143, 216, 238", "59, 122, 143", "255, 179, 71"];
const RIPPLE_COUNT = 6;
const LIFETIME = 4.5; // seconds for a ripple to fully expand and fade out

function spawnRipple(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    age: 0,
    delay: Math.random() * 3,
    maxRadius: 90 + Math.random() * 220,
    colour: RING_COLOURS[Math.floor(Math.random() * RING_COLOURS.length)],
  };
}

function drawRipple(ctx, r) {
  const t = r.age / LIFETIME;
  const radius = r.maxRadius * t;
  const opacity = (1 - t) * 0.3;
  // Two close rings per ripple read as a soft water ring rather than a
  // single thin line, without needing a gradient fill.
  [0, 10].forEach((offset) => {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r.colour}, ${opacity})`;
    ctx.lineWidth = 1.5;
    ctx.arc(r.x, r.y, Math.max(0, radius - offset), 0, Math.PI * 2);
    ctx.stroke();
  });
}

// Starts the animation on the #puddle-bg canvas and returns a stop function.
// Safe to call even if the canvas isn't in the document yet (returns a no-op).
export function startPuddleBackground(canvasId = "puddle-bg") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return () => {};
  const ctx = canvas.getContext("2d");
  let running = true;

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  resize();
  addEventListener("resize", resize);

  const ripples = Array.from({ length: RIPPLE_COUNT }, () => spawnRipple(canvas.width, canvas.height));

  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const { width: w, height: h } = canvas;

    ctx.fillStyle = "#06222f";
    ctx.fillRect(0, 0, w, h);

    ripples.forEach((r) => {
      if (r.delay > 0) {
        r.delay -= dt;
        return;
      }
      r.age += dt;
      if (r.age > LIFETIME) {
        Object.assign(r, spawnRipple(w, h), { delay: Math.random() * 2 });
        return;
      }
      drawRipple(ctx, r);
    });

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return () => {
    running = false;
    removeEventListener("resize", resize);
  };
}
