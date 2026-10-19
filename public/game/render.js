import { COLOURS } from "./profile.js";
import { WORLD } from "./sim.js";

// The seafloor canvas is bigger than the playable WORLD square: this margin
// is shoreline, a rocky bank the camera can see past the clamp boundary
// without the water itself extending there. Needs to be generous — on a wide
// viewport, the camera at a world corner can see well past a thin margin,
// into the plain canvas background beyond the cached image.
const BORDER_MARGIN = 480;
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

// A small cluster rather than one rock, so the corner reads as a joined-up
// pile instead of a single blob with the two edges' scatters trailing off
// into bare margin on either side of it. `outX`/`outY` point away from the
// water, so the cluster spreads into the margin along both adjoining edges.
function drawCorner(ctx, cx, cy, outX, outY) {
  rockBlob(ctx, cx, cy, 90 + Math.random() * 70, ROCK_PALETTE[0]);
  rockBlob(ctx, cx + outX * 90, cy + outY * 40, 65 + Math.random() * 50, ROCK_PALETTE[1]);
  rockBlob(ctx, cx + outX * 40, cy + outY * 90, 65 + Math.random() * 50, ROCK_PALETTE[2]);
}

// Each edge gets its own density/size/reach so the border is deliberately
// asymmetric, like a real pond's banks: one side a steep pile of boulders,
// another a gentler scatter of pebbles.
function drawRockyBorder(ctx, margin, world) {
  drawEdge(ctx, "x", margin, margin, world, 1.0, [30, 70], 60); // top: close, modest
  drawEdge(ctx, "x", margin + world, margin, world, 1.25, [45, 110], 100); // bottom: heavier
  drawEdge(ctx, "y", margin, margin, world, 0.75, [36, 195], 115); // left: sparse, a few big outliers
  drawEdge(ctx, "y", margin + world, margin, world, 1.5, [63, 175], 150); // right: the dense, chunky bank
  drawCorner(ctx, margin, margin, -1, -1);
  drawCorner(ctx, margin + world, margin, 1, -1);
  drawCorner(ctx, margin, margin + world, -1, 1);
  drawCorner(ctx, margin + world, margin + world, 1, 1);
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
    maxRadius: 70 + Math.random() * 170,
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
    const radius = r.maxRadius * t;
    const opacity = (1 - t) * 0.22;
    // Two close rings read as one bolder band rather than a thin line.
    [0, 6].forEach((offset) => {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${r.colour}, ${opacity})`;
      ctx.lineWidth = 2.5;
      ctx.arc(r.x, r.y, Math.max(0, radius - offset), 0, Math.PI * 2);
      ctx.stroke();
    });
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

// Bite pop effects: a quick expanding ring plus a few flung fragments at the
// eaten entity's last position, so a kill reads as an event instead of an
// entity just silently vanishing between snapshots. Kept as module state like
// `ripples` above, fed by `triggerBite` from outside (main.js, off the
// server's per-tick event list) rather than owned by the sim state itself,
// since this is pure presentation with no bearing on the simulation.
const BITE_LIFETIME = 0.4;
let bites = [];

export function triggerBite(x, y, colour) {
  const fragments = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
    return { angle, speed: 60 + Math.random() * 60 };
  });
  bites.push({ x, y, age: 0, colour, fragments });
}

function drawBites(ctx, dt) {
  bites = bites.filter((b) => b.age < BITE_LIFETIME);
  for (const b of bites) {
    b.age += dt;
    const t = b.age / BITE_LIFETIME;
    const fade = 1 - t;
    ctx.strokeStyle = `rgba(255, 255, 255, ${fade * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 10 + t * 40, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLOURS[b.colour] ?? "#fff";
    for (const f of b.fragments) {
      const r = f.speed * b.age;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(b.x + Math.cos(f.angle) * r, b.y + Math.sin(f.angle) * r, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// Every hat below is drawn in the same local (unrotated-relative-to-the-fish)
// space as the fins/eyes in drawFish, so each turns with the fish and stays
// planted on the head rather than needing its own position tracking. All take
// (ctx, headR, noseCenterX) and are centred so they sit within the head's own
// silhouette, reading as worn rather than stuck on.

// Crown: gold three-peak crown — the original, pre-existing hat.
function drawCrown(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.15;
  const halfW = headR * 0.8;
  const baseX = cx - headR * 0.1;
  const peakX = cx + headR * 0.55;
  const midPeakX = cx + headR * 0.75;
  const dipX = cx + headR * 0.15;

  ctx.beginPath();
  ctx.moveTo(baseX, -halfW);
  ctx.lineTo(peakX, -halfW * 0.6);
  ctx.lineTo(dipX, -halfW * 0.25);
  ctx.lineTo(midPeakX, 0);
  ctx.lineTo(dipX, halfW * 0.25);
  ctx.lineTo(peakX, halfW * 0.6);
  ctx.lineTo(baseX, halfW);
  ctx.closePath();
  ctx.fillStyle = "#ffd76b";
  ctx.fill();
  ctx.strokeStyle = "#8a5a00";
  ctx.lineWidth = Math.max(1, headR * 0.05);
  ctx.stroke();
}

// Survivalist: khaki wide round brim (a flattened ellipse) with a low olive
// dome on top.
function drawSurvivalistHat(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.1;
  ctx.beginPath();
  ctx.ellipse(cx, 0, headR * 0.95, headR * 0.55, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#8a7a4a";
  ctx.fill();
  ctx.strokeStyle = "#5f5330";
  ctx.lineWidth = Math.max(1, headR * 0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, 0, headR * 0.55, headR * 0.4, 0, Math.PI, 0);
  ctx.fillStyle = "#6b7f3f";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, 0, headR * 0.55, headR * 0.4, 0, 0, Math.PI, true);
  ctx.strokeStyle = "#4a5a2b";
  ctx.lineWidth = Math.max(1, headR * 0.06);
  ctx.stroke();
}

// Glutton: white chef's toque — a few overlapping rounded humps on a thin
// white band.
function drawChefHat(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  ctx.fillStyle = "#f2f2f2";
  ctx.strokeStyle = "#c8c8c8";
  ctx.lineWidth = Math.max(1, headR * 0.03);
  ctx.beginPath();
  ctx.rect(cx - headR * 0.6, -headR * 0.25, headR * 1.2, headR * 0.3);
  ctx.fill();
  ctx.stroke();
  [-0.4, 0, 0.4].forEach((off) => {
    ctx.beginPath();
    ctx.arc(cx + headR * off, -headR * 0.35, headR * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
}

// Herbivore: a ring of small leaf shapes around a headband arc, with a
// couple of small flower-dot accents.
function drawLeafCrown(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.1;
  const leaves = 6;
  for (let i = 0; i < leaves; i++) {
    const a = -Math.PI * 0.75 + (i / (leaves - 1)) * Math.PI * 1.5;
    const lx = cx + Math.cos(a) * headR * 0.85;
    const ly = Math.sin(a) * headR * 0.85;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, headR * 0.12, headR * 0.26, 0, 0, Math.PI * 2);
    ctx.fillStyle = "#4caf50";
    ctx.fill();
    ctx.restore();
  }
  [-0.35, 0.35].forEach((off) => {
    ctx.beginPath();
    ctx.arc(cx + headR * off, -headR * 0.75, headR * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = off < 0 ? "#f472b6" : "#ffd76b";
    ctx.fill();
  });
}

// Dash Master: a small orange cap with speed-chevron strokes trailing off
// the back (toward the tail), suggesting motion.
function drawDashCap(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.1;
  ctx.beginPath();
  ctx.ellipse(cx, -headR * 0.1, headR * 0.6, headR * 0.45, 0, Math.PI, 0);
  ctx.fillStyle = "#ff7a33";
  ctx.fill();
  ctx.strokeStyle = "#b3451c";
  ctx.lineWidth = Math.max(1, headR * 0.04);
  ctx.stroke();
  ctx.strokeStyle = "#ffb347";
  ctx.lineWidth = Math.max(1, headR * 0.08);
  ctx.lineCap = "round";
  [-0.3, 0, 0.3].forEach((off) => {
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.7, off * headR);
    ctx.lineTo(cx - headR * 1.1, off * headR * 1.4);
    ctx.stroke();
  });
}

// Player Hunter: a dark tricorn silhouette (one upturned peak) with a small
// red feather accent.
function drawTricorn(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.9, headR * 0.3);
  ctx.quadraticCurveTo(cx - headR * 0.3, -headR * 0.9, cx + headR * 0.3, -headR * 0.5);
  ctx.quadraticCurveTo(cx + headR * 0.9, -headR * 0.2, cx + headR * 0.8, headR * 0.35);
  ctx.quadraticCurveTo(cx, headR * 0.1, cx - headR * 0.9, headR * 0.3);
  ctx.closePath();
  ctx.fillStyle = "#1c2430";
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = Math.max(1, headR * 0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + headR * 0.1, -headR * 0.6);
  ctx.quadraticCurveTo(cx + headR * 0.5, -headR * 1.1, cx + headR * 0.3, -headR * 1.3);
  ctx.strokeStyle = "#c0392b";
  ctx.lineWidth = Math.max(1, headR * 0.1);
  ctx.lineCap = "round";
  ctx.stroke();
}

// Giant Slayer: a simplified viking helmet — a grey/silver dome with two
// curved horns sweeping outward from the sides.
function drawVikingHelmet(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.1;
  ctx.beginPath();
  ctx.arc(cx, 0, headR * 0.7, Math.PI, 0);
  ctx.fillStyle = "#9aa0a6";
  ctx.fill();
  ctx.strokeStyle = "#5a5f66";
  ctx.lineWidth = Math.max(1, headR * 0.05);
  ctx.stroke();
  ctx.lineCap = "round";
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx, -side * headR * 0.1);
    ctx.quadraticCurveTo(cx - headR * 0.9, -side * headR * 0.5, cx - headR * 0.75, -side * headR * 0.9);
    ctx.strokeStyle = "#e8e4d8";
    ctx.lineWidth = Math.max(1, headR * 0.12);
    ctx.stroke();
  });
}

// Veteran: a weathered brown fedora — narrower brim than the Survivalist
// hat's, darker colour, with a tiny worn-patch mark reading as well-used.
function drawFedora(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.1;
  ctx.beginPath();
  ctx.ellipse(cx, 0, headR * 0.75, headR * 0.35, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#6b4a2b";
  ctx.fill();
  ctx.strokeStyle = "#45301b";
  ctx.lineWidth = Math.max(1, headR * 0.04);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, -headR * 0.05, headR * 0.45, headR * 0.45, 0, Math.PI, 0);
  ctx.fillStyle = "#523823";
  ctx.fill();
  // A tiny worn-patch mark (an X-stitch) on the crown.
  ctx.strokeStyle = "#d8c9a0";
  ctx.lineWidth = Math.max(1, headR * 0.03);
  const px = cx + headR * 0.15;
  ctx.beginPath();
  ctx.moveTo(px - headR * 0.06, -headR * 0.28);
  ctx.lineTo(px + headR * 0.06, -headR * 0.16);
  ctx.moveTo(px + headR * 0.06, -headR * 0.28);
  ctx.lineTo(px - headR * 0.06, -headR * 0.16);
  ctx.stroke();
}

// Leaderboard Entrant: a small bronze medal disc above the head with a thin
// rim and a tiny star mark.
function drawMedal(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.1;
  const cy = -headR * 0.9;
  const r = headR * 0.35;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#cd7f32";
  ctx.fill();
  ctx.strokeStyle = "#8a5522";
  ctx.lineWidth = Math.max(1, headR * 0.04);
  ctx.stroke();
  drawStar(ctx, cx, cy, r * 0.55, "#eecb9a");
}

// Leaderboard Leader: a small gold trophy-cup silhouette (bowl + two handle
// loops + a stem/base) — deliberately a different shape family from Crown.
function drawTrophy(ctx, headR, noseCenterX) {
  const cx = noseCenterX - headR * 0.1;
  const topY = -headR * 1.3;
  const bowlW = headR * 0.5;
  const bowlH = headR * 0.45;
  ctx.fillStyle = "#ffd76b";
  ctx.strokeStyle = "#a8841f";
  ctx.lineWidth = Math.max(1, headR * 0.04);

  ctx.beginPath();
  ctx.moveTo(cx - bowlW, topY);
  ctx.quadraticCurveTo(cx - bowlW, topY + bowlH, cx, topY + bowlH);
  ctx.quadraticCurveTo(cx + bowlW, topY + bowlH, cx + bowlW, topY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(cx + side * bowlW * 1.3, topY + bowlH * 0.3, bowlW * 0.35, bowlH * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.beginPath();
  ctx.rect(cx - headR * 0.08, topY + bowlH, headR * 0.16, headR * 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(cx - headR * 0.25, topY + bowlH + headR * 0.3, headR * 0.5, headR * 0.12);
  ctx.fill();
  ctx.stroke();
}

function drawStar(ctx, cx, cy, r, colour) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const outerA = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    const innerA = outerA + Math.PI / 5;
    const ox = cx + Math.cos(outerA) * r;
    const oy = cy + Math.sin(outerA) * r;
    const ix = cx + Math.cos(innerA) * r * 0.45;
    const iy = cy + Math.sin(innerA) * r * 0.45;
    if (i === 0) ctx.moveTo(ox, oy);
    else ctx.lineTo(ox, oy);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

const HAT_RENDERERS = {
  crown: drawCrown,
  survivalist: drawSurvivalistHat,
  glutton: drawChefHat,
  herbivore: drawLeafCrown,
  dashMaster: drawDashCap,
  playerHunter: drawTricorn,
  giantSlayer: drawVikingHelmet,
  veteran: drawFedora,
  leaderboardEntrant: drawMedal,
  leaderboardLeader: drawTrophy,
};

// Every hat renderer above draws at "full size", sized and positioned purely
// in terms of headR/noseCenterX as if it were the only thing on the head.
// Shrunk and shifted back here, in one place, rather than in each of the ten
// functions: HAT_SCALE makes every hat a bit smaller, and HAT_BACK_SHIFT
// (in true headR units, applied before the scale so it isn't itself shrunk)
// moves the whole hat toward the tail so its forward edge clears the eyes
// (centred at noseCenterX + headR*0.3) instead of sitting on top of them.
const HAT_SCALE = 0.75;
const HAT_BACK_SHIFT = 0.4;

export function drawHat(ctx, hatId, headR, noseCenterX) {
  const renderer = HAT_RENDERERS[hatId];
  if (!renderer) return;
  ctx.save();
  ctx.translate(noseCenterX - headR * HAT_BACK_SHIFT, 0);
  ctx.scale(HAT_SCALE, HAT_SCALE);
  renderer(ctx, headR, 0);
  ctx.restore();
}

// Renders one hat, centred and at icon scale, into a small standalone
// canvas — used for the greyed-out preview on each tile in the hats menu
// (start.js), not for anything drawn in-world. `noseCenterX` there is always
// 0: these previews show the hat on its own, not attached to a particular
// fish's head/body geometry.
export function drawHatIcon(canvas, hatId) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h * 0.6);
  drawHat(ctx, hatId, Math.min(w, h) * 0.4, 0);
  ctx.restore();
}

// Teardrop body (round head, pointed tail-base) viewed from directly above,
// with a two-joint tail fin that wags from `tailWag`, faster when swimming faster.
// `outline` is "you" (thick white, the camera target), "player" (thin gold
// ring, a real rival), or falsy (a bot, no ring).
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
  if (outline === "you") {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else if (outline === "player") {
    ctx.strokeStyle = "#ffd76b";
    ctx.lineWidth = 2;
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

  if (e.hat) drawHat(ctx, e.hat, headR, noseCenterX);

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
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#000";
  const labelY = e.y - e.size - fontSize * 0.4 - 4;
  ctx.strokeText(label, e.x, labelY);
  ctx.fillStyle = outline === "you" || outline === "player" ? "#ffd76b" : "#e8f6fa";
  ctx.fillText(label, e.x, labelY);
}

// `you` is the camera target, drawn with a thick white outline; `others` is
// every other real player currently in the world, drawn with a thinner gold
// ring and gold name label so a real rival reads differently from a bot.
export function render(ctx, state, you, others, dt = 1 / 60) {
  // CSS-pixel size, not the (possibly device-pixel-scaled) backing-store
  // width/height: the context already carries a dpr scale transform set once
  // in main.js's resize(), so measurements here must stay in the same CSS-pixel
  // space that transform maps into device pixels, or the camera centering
  // would double-apply the scale.
  const { clientWidth: w, clientHeight: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2 - you.x, h / 2 - you.y);
  if (!seafloor) buildSeafloor();
  ctx.drawImage(seafloor, -BORDER_MARGIN, -BORDER_MARGIN);
  drawRipples(ctx, dt);
  state.food.forEach((f) => drawFood(ctx, f));
  state.bots.forEach((b) => drawFish(ctx, b, false));
  others.forEach((o) => drawFish(ctx, o, "player"));
  drawBites(ctx, dt);
  drawFish(ctx, you, "you");
  ctx.restore();
}
