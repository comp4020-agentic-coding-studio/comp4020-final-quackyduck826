import { COLOURS } from "./profile.js";
import { WORLD } from "./sim.js";

// The seafloor canvas is bigger than the playable WORLD square: this margin
// is shoreline, a rocky bank the camera can see past the clamp boundary
// without the water itself extending there.
const BORDER_MARGIN = 260;
const ROCK_PALETTE = ["#4a463f", "#5c5750", "#3a362f", "#6b6258", "#423e37"];

// An irregular closed polygon around (cx, cy) instead of a circle, so rocks
// read as rocks and not pebbled dots.
function rockBlob(ctx, cx, cy, radius, colour) {
  const points = 9 + Math.floor(Math.random() * 5);
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const r = radius * (0.6 + Math.random() * 0.55);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, .35)";
  ctx.lineWidth = Math.max(1, radius * 0.06);
  ctx.stroke();
}

// Scatters rocks along one edge of the WORLD square. `axis` is which way the
// edge runs ("x" for top/bottom, "y" for left/right); `fixed` is where the
// shoreline sits on the other axis; `reach` lets rocks stray inward (into the
// water) or outward (into the margin) from that line. Density and size range
// are passed per edge so the four sides don't read as one repeating tile.
function drawEdge(ctx, axis, fixed, start, length, density, [minSize, maxSize], reach) {
  let along = start - reach;
  const end = start + length + reach;
  while (along < end) {
    const size = minSize + Math.random() * (maxSize - minSize);
    const across = fixed + (Math.random() * 2 - 1) * reach;
    const x = axis === "x" ? along : across;
    const y = axis === "x" ? across : along;
    rockBlob(ctx, x, y, size, ROCK_PALETTE[Math.floor(Math.random() * ROCK_PALETTE.length)]);
    along += (size * 0.9) / density;
  }
}

// Each edge gets its own density/size/reach so the border is deliberately
// asymmetric, like a real pond's banks: one side a steep pile of boulders,
// another a gentler scatter of pebbles.
function drawRockyBorder(ctx, margin, world) {
  drawEdge(ctx, "x", margin, margin, world, 1.0, [22, 50], 34); // top: close, modest
  drawEdge(ctx, "x", margin + world, margin, world, 1.25, [32, 78], 55); // bottom: heavier
  drawEdge(ctx, "y", margin, margin, world, 0.75, [26, 140], 65); // left: sparse, a few big outliers
  drawEdge(ctx, "y", margin + world, margin, world, 1.5, [45, 125], 85); // right: the dense, chunky bank
  for (const [cx, cy] of [
    [margin, margin], [margin + world, margin], [margin, margin + world], [margin + world, margin + world],
  ]) {
    rockBlob(ctx, cx, cy, 55 + Math.random() * 45, ROCK_PALETTE[0]);
  }
}

// The seafloor is a cached world-sized image (rocky bank, water fill, and a
// handful of large kelp patches), built once and blitted whole each frame
// rather than redrawn, so it reads as one scene instead of scattered shapes.
let seafloor = null;
function buildSeafloor() {
  const size = WORLD + BORDER_MARGIN * 2;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const bg = c.getContext("2d");
  bg.fillStyle = "#2b2521";
  bg.fillRect(0, 0, size, size);
  bg.fillStyle = "#0a3548";
  bg.fillRect(BORDER_MARGIN, BORDER_MARGIN, WORLD, WORLD);
  bg.lineCap = "round";
  const sections = 10;
  for (let s = 0; s < sections; s++) {
    const cx = BORDER_MARGIN + Math.random() * WORLD;
    const cy = BORDER_MARGIN + Math.random() * WORLD;
    const blades = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < blades; i++) {
      const angle = Math.random() * Math.PI * 2;
      const len = 120 + Math.random() * 140;
      const bend = angle + (Math.random() - 0.5) * 0.8;
      const midX = cx + Math.cos(bend) * len * 0.5;
      const midY = cy + Math.sin(bend) * len * 0.5;
      const endX = cx + Math.cos(angle) * len;
      const endY = cy + Math.sin(angle) * len;
      bg.strokeStyle = `rgba(${20 + Math.random() * 20}, ${70 + Math.random() * 30}, ${55 + Math.random() * 20}, .5)`;
      bg.lineWidth = 8 + Math.random() * 10;
      bg.beginPath();
      bg.moveTo(cx, cy);
      bg.quadraticCurveTo(midX, midY, endX, endY);
      bg.stroke();
    }
  }
  drawRockyBorder(bg, BORDER_MARGIN, WORLD);
  seafloor = c;
}

// Gentle rings expanding outward from randomised points across the pond,
// fading as they grow, respawning elsewhere once done. Drawn in world space
// (inside the same camera transform as everything else) so they pan with
// the scene; kept subtle so they never compete with fish/food for attention.
const RIPPLE_COUNT = 10;
const RIPPLE_LIFETIME = 5;
const RIPPLE_COLOURS = ["255, 255, 255", "143, 216, 238"];
let ripples = null;

function spawnRipple() {
  return {
    x: Math.random() * WORLD,
    y: Math.random() * WORLD,
    age: 0,
    delay: Math.random() * 3,
    maxRadius: 40 + Math.random() * 90,
    colour: RIPPLE_COLOURS[Math.floor(Math.random() * RIPPLE_COLOURS.length)],
  };
}

function drawRipples(ctx, dt) {
  if (!ripples) ripples = Array.from({ length: RIPPLE_COUNT }, spawnRipple);
  for (const r of ripples) {
    if (r.delay > 0) {
      r.delay -= dt;
      continue;
    }
    r.age += dt;
    if (r.age > RIPPLE_LIFETIME) {
      Object.assign(r, spawnRipple(), { delay: Math.random() * 2 });
      continue;
    }
    const t = r.age / RIPPLE_LIFETIME;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${r.colour}, ${(1 - t) * 0.12})`;
    ctx.lineWidth = 1.5;
    ctx.arc(r.x, r.y, r.maxRadius * t, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Tiny seaweed sprig instead of a plain dot: a few curved blades round a base,
// in plant tones rather than the fish palette. Angles come from the food's own
// id so each sprig looks the same from frame to frame without extra state.
const PLANT_COLOURS = ["#2ec4b6", "#4caf50", "#3b9c6b", "#1f7a5c"];
const drawFood = (ctx, f) => {
  const shade = PLANT_COLOURS[f.id % PLANT_COLOURS.length];
  const bladeLen = f.size * 1.8;
  ctx.strokeStyle = shade;
  ctx.lineWidth = Math.max(1, f.size * 0.4);
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const angle = ((f.id * 53 + i * 120) * Math.PI) / 180;
    const bend = angle + 0.4;
    const midX = f.x + Math.cos(bend) * bladeLen * 0.5;
    const midY = f.y + Math.sin(bend) * bladeLen * 0.5;
    const endX = f.x + Math.cos(angle) * bladeLen;
    const endY = f.y + Math.sin(angle) * bladeLen;
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.quadraticCurveTo(midX, midY, endX, endY);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = shade;
  ctx.arc(f.x, f.y, f.size * 0.35, 0, Math.PI * 2);
  ctx.fill();
};

// Teardrop body (round head, pointed tail-base) viewed from directly above,
// with a two-joint tail fin that wags from `tailWag`, faster when swimming faster.
function drawFish(ctx, e, outline) {
  const fill = COLOURS[e.colour] ?? "#fff";
  const headR = e.size;
  const bodyLen = e.size * 3.4;
  const noseCenterX = bodyLen / 2 - headR;
  const tailX = -bodyLen / 2;

  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);

  // Tail, drawn first so the body overlaps its joint. The two segments
  // overlap and share a small wag-phase lag so they read as one flexing
  // piece rather than separate flapping parts.
  ctx.save();
  ctx.translate(tailX, 0);
  ctx.rotate(Math.sin(e.tailWag) * 0.45);
  ctx.fillStyle = fill;
  const seg1 = e.size * 0.6;
  const overlap1 = e.size * 0.5;
  ctx.beginPath();
  ctx.moveTo(overlap1, -e.size * 0.2);
  ctx.lineTo(-seg1, -e.size * 0.12);
  ctx.lineTo(-seg1, e.size * 0.12);
  ctx.lineTo(overlap1, e.size * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.translate(-seg1 * 0.75, 0);
  ctx.rotate(Math.sin(e.tailWag - 0.7) * 0.55);
  const seg2 = e.size * 0.55;
  ctx.beginPath();
  ctx.moveTo(0, -e.size * 0.12);
  ctx.lineTo(-seg2, -e.size * 0.4);
  ctx.lineTo(-seg2 * 0.8, 0);
  ctx.lineTo(-seg2, e.size * 0.4);
  ctx.lineTo(0, e.size * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Body: pointed at the tail-base, rounded (arced) at the head.
  ctx.beginPath();
  ctx.moveTo(tailX, 0);
  ctx.quadraticCurveTo(noseCenterX - bodyLen * 0.25, -headR, noseCenterX, -headR);
  ctx.arc(noseCenterX, 0, headR, -Math.PI / 2, Math.PI / 2);
  ctx.quadraticCurveTo(noseCenterX - bodyLen * 0.25, headR, tailX, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Small triangular side fins, swept back from the body.
  const finX = noseCenterX - headR * 0.3;
  const finBase = headR * 0.8;
  ctx.fillStyle = fill;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(finX + e.size * 0.3, side * finBase);
    ctx.lineTo(finX - e.size * 0.3, side * finBase);
    ctx.lineTo(finX - e.size * 0.15, side * (finBase + e.size * 0.55));
    ctx.closePath();
    ctx.fill();
  });

  // Eyes mark the head end.
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  const eyeX = noseCenterX + headR * 0.3;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(eyeX, side * headR * 0.5, e.size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  // Name label, drawn unrotated (outside the fish's own transform) so it
  // always reads upright regardless of which way the fish is facing.
  const label = e.name ?? e.colour.charAt(0).toUpperCase() + e.colour.slice(1);
  // Scaled by half the fish's size (not fully), so big fish get a bigger
  // name without it dwarfing the body the way a full 1:1 scale would.
  const fontSize = Math.max(10, e.size * 0.5);
  ctx.font = `${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = fontSize * 0.3;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  const labelY = e.y - e.size - fontSize * 0.4 - 4;
  ctx.strokeText(label, e.x, labelY);
  ctx.fillStyle = "#e8f6fa";
  ctx.fillText(label, e.x, labelY);
}

export function render(ctx, state, dt = 1 / 60) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  const p = state.player;
  ctx.save();
  ctx.translate(w / 2 - p.x, h / 2 - p.y);
  if (!seafloor) buildSeafloor();
  ctx.drawImage(seafloor, -BORDER_MARGIN, -BORDER_MARGIN);
  drawRipples(ctx, dt);
  state.food.forEach((f) => drawFood(ctx, f));
  state.bots.forEach((b) => drawFish(ctx, b, false));
  drawFish(ctx, p, true);
  ctx.restore();
}
