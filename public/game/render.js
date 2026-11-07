import { COLOURS } from "./profile.js";
import { WORLD } from "./sim.js";
import { createCursorWake } from "./cursor-ripples.js";

// The seafloor canvas is bigger than the playable WORLD square: this margin
// is shoreline, a neon reef bank the camera can see past the clamp boundary
// without the water itself extending there. Needs to be generous — the
// camera centres on the player, so with a fish clamped right at the world
// edge the margin must cover at least half the viewport's width/height or
// the view runs past the cached image into the plain canvas background
// before the reef does, visibly "ending" the border. 1400 comfortably covers
// browser windows up to ~2800px wide/tall (full HD and most large-monitor
// windows); #canvas's own CSS background is matched to the margin's own ink
// fill (see buildSeafloor) so even a wider viewport than that degrades into
// more of the same dark void instead of a visible seam into the water tone.
const BORDER_MARGIN = 1400;

// Same four accent colours as the home page's --cyan/--pink/--amber/--lime
// custom properties (duplicated as literals here since this module runs with
// no DOM/CSSOM access of its own) — every glowing shape below is drawn from
// this palette rather than the old earthy rock/kelp tones, so the in-game
// scene reads as the same app as the start screen.
const NEON_PALETTE = ["#52f1ff", "#ff4fd8", "#ffb347", "#b6ff3c"];

// A narrow faceted shard — a crystal spike rather than a rounded boulder —
// drawn pointing in local "up" (-y) before rotation. `angle` rotates that tip
// to face whichever way the caller needs (outward from the water for border
// reefs, arbitrary for interior accent clusters). Glassy translucent fill
// plus a glowing stroke instead of a flat earthy colour, so it reads as
// crystal/energy rather than rock.
function crystalShard(ctx, cx, cy, height, width, colour, angle = 0) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.shadowColor = colour;
  ctx.shadowBlur = height * 0.35;
  ctx.beginPath();
  ctx.moveTo(0, -height);
  ctx.lineTo(width * 0.5, -height * 0.32);
  ctx.lineTo(width * 0.32, height * 0.12);
  ctx.lineTo(-width * 0.32, height * 0.12);
  ctx.lineTo(-width * 0.5, -height * 0.32);
  ctx.closePath();
  ctx.fillStyle = colour + "2e"; // ~18% alpha glassy fill
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, width * 0.07);
  ctx.stroke();
  // Centre facet line, a brighter vein down the middle of the shard.
  ctx.beginPath();
  ctx.moveTo(0, -height * 0.9);
  ctx.lineTo(0, height * 0.1);
  ctx.strokeStyle = colour + "99";
  ctx.lineWidth = Math.max(1, width * 0.035);
  ctx.stroke();
  ctx.restore();
}

// A small glowing hexagon outline — a "tech node" accent used at the centre
// of each interior reef cluster, echoing the hat menu's hex-ish geometry and
// the grid floor's straight-edged look rather than anything organic.
function hexNode(ctx, cx, cy, r, colour) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = colour;
  ctx.shadowBlur = r * 0.8;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Rotates the shard template's default "up" (-y) tip to point along the unit
// direction (outX, outY) once drawn — shared by both the straight edges and
// the corner clusters below so "away from the water" always maps to the same
// formula instead of four hand-picked angle constants.
function outwardAngle(outX, outY) {
  return Math.atan2(outX, -outY);
}

// Scatters crystal shards along one edge of the WORLD square, tips pointing
// outward into the margin/bank. `axis` is which way the edge runs ("x" for
// top/bottom, "y" for left/right); `fixed` is where the boundary line sits on
// the other axis; `out` is the unit vector pointing away from the water.
// Density/size vary per edge so the four sides don't read as one repeating
// tile, same spirit as the old rocky border.
//
// After rotation, a shard's `width` is its extent along the edge direction
// (crystalShard's local x-axis, which `outwardAngle` always rotates onto the
// edge's own running direction, whichever axis that is) — so stepping along
// by less than the just-drawn shard's own width guarantees its footprint
// overlaps the next one, leaving no bare gap of open margin between them
// regardless of how `density` scales the spacing.
const EDGE_OVERLAP = 0.55;
function drawReefEdge(ctx, axis, fixed, start, length, density, [minH, maxH], reach, colour, out) {
  const angle = outwardAngle(out.x, out.y);
  let along = start - reach * 0.3;
  const end = start + length + reach * 0.3;
  while (along < end) {
    const h = minH + Math.random() * (maxH - minH);
    const w = h * (0.45 + Math.random() * 0.25);
    const across = fixed + (Math.random() * 2 - 1) * reach * 0.5 + out.x * reach * 0.15 + out.y * reach * 0.15;
    const x = axis === "x" ? along : across;
    const y = axis === "x" ? across : along;
    crystalShard(ctx, x, y, h, w, colour, angle + (Math.random() - 0.5) * 0.3);
    along += (w * EDGE_OVERLAP) / density;
  }
}

// A small joined-up cluster of shards plus a hex node, radiating outward from
// the world's corner, so corners read as a reinforced reef knot rather than
// two edges just trailing off into bare margin beside each other.
function drawReefCorner(ctx, cx, cy, outX, outY, colour) {
  const angle = outwardAngle(outX, outY);
  hexNode(ctx, cx + outX * 55, cy + outY * 55, 20 + Math.random() * 10, colour);
  for (let i = 0; i < 5; i++) {
    const spread = (Math.random() - 0.5) * 1.1;
    const x = cx + outX * (25 + Math.random() * 60) + (Math.random() - 0.5) * 40;
    const y = cy + outY * (25 + Math.random() * 60) + (Math.random() - 0.5) * 40;
    const h = 80 + Math.random() * 100;
    const w = h * 0.5;
    crystalShard(ctx, x, y, h, w, colour, angle + spread);
  }
}

// One accent colour per side (matching the four home-page accents) so the
// border itself carries the same cyan/pink/amber/lime spread as the start
// screen's swatches instead of a single uniform rock tone.
function drawNeonBorder(ctx, margin, world) {
  drawReefEdge(ctx, "x", margin, margin, world, 1.0, [55, 125], 70, NEON_PALETTE[0], { x: 0, y: -1 }); // top: cyan
  drawReefEdge(ctx, "x", margin + world, margin, world, 1.2, [70, 160], 95, NEON_PALETTE[1], { x: 0, y: 1 }); // bottom: pink, heavier
  drawReefEdge(ctx, "y", margin, margin, world, 0.8, [60, 210], 110, NEON_PALETTE[2], { x: -1, y: 0 }); // left: amber, sparse w/ outliers
  drawReefEdge(ctx, "y", margin + world, margin, world, 1.35, [75, 185], 130, NEON_PALETTE[3], { x: 1, y: 0 }); // right: lime, dense
  drawReefCorner(ctx, margin, margin, -1, -1, NEON_PALETTE[0]);
  drawReefCorner(ctx, margin + world, margin, 1, -1, NEON_PALETTE[1]);
  drawReefCorner(ctx, margin, margin + world, -1, 1, NEON_PALETTE[2]);
  drawReefCorner(ctx, margin + world, margin + world, 1, 1, NEON_PALETTE[3]);
}

// A thin glowing "force-field" line traced exactly on the WORLD boundary, a
// canvas echo of the glowing box-shadow borders on .play-card/.panel — reads
// as a clean edge-of-world line that the reef clusters above then grow out of,
// rather than the boundary being implied purely by where the rocks stop.
function drawBoundaryGlow(ctx, margin, world) {
  ctx.save();
  ctx.shadowColor = "rgba(82, 241, 255, .8)";
  ctx.shadowBlur = 30;
  ctx.strokeStyle = "rgba(82, 241, 255, .45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(margin, margin, world, world);
  ctx.restore();
}

// Faint square grid across the playable water, a canvas rendition of the
// start screen's `.grid-floor` CSS perspective grid (flattened to top-down
// since the camera here isn't angled) plus a soft centred glow echoing
// `.glow` — texture for the seafloor that still reads as "dark ink + neon
// lines" rather than a flat empty fill.
function drawGridFloor(ctx, margin, world) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, margin, world, world);
  ctx.clip();
  ctx.strokeStyle = "rgba(82, 241, 255, .09)";
  ctx.lineWidth = 2;
  const step = 90;
  for (let x = margin; x <= margin + world; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, margin);
    ctx.lineTo(x, margin + world);
    ctx.stroke();
  }
  for (let y = margin; y <= margin + world; y += step) {
    ctx.beginPath();
    ctx.moveTo(margin, y);
    ctx.lineTo(margin + world, y);
    ctx.stroke();
  }
  const cx = margin + world / 2;
  const cy = margin + world / 2;
  const glow = ctx.createRadialGradient(cx, cy, world * 0.04, cx, cy, world * 0.65);
  glow.addColorStop(0, "rgba(82, 241, 255, .07)");
  glow.addColorStop(1, "rgba(6, 34, 47, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(margin, margin, world, world);
  ctx.restore();
}

// Interior scenery: clusters of small crystal shards around a glowing hex
// node, scattered across the water — the neon-styled replacement for the old
// kelp blade patches. Colour is per-cluster (cycling the palette) so the
// floor carries a mix of accents rather than a single plant tone.
function drawReefAccents(ctx, margin, world) {
  const clusters = 10;
  for (let s = 0; s < clusters; s++) {
    const cx = margin + Math.random() * world;
    const cy = margin + Math.random() * world;
    const colour = NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)];
    const shards = 4 + Math.floor(Math.random() * 5);
    for (let i = 0; i < shards; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 15 + Math.random() * 55;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const h = 26 + Math.random() * 46;
      const w = h * 0.5;
      crystalShard(ctx, sx, sy, h, w, colour, angle + Math.PI / 2);
    }
    hexNode(ctx, cx, cy, 12 + Math.random() * 10, colour);
  }
}

// The seafloor is a cached world-sized image (ink-dark margin, a faint neon
// grid across the water, scattered crystal reef clusters, and a glowing
// force-field border), built once and blitted whole each frame rather than
// redrawn, so it reads as one scene instead of scattered shapes.
let seafloor = null;
function buildSeafloor() {
  const size = WORLD + BORDER_MARGIN * 2;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const bg = c.getContext("2d");
  // Margin (the bank beyond the playable square) in the same dark ink as the
  // rest of the app — the border reef drawn over it is what marks the edge,
  // not an earthy colour change.
  bg.fillStyle = "#04141c";
  bg.fillRect(0, 0, size, size);
  bg.fillStyle = "#0a3548";
  bg.fillRect(BORDER_MARGIN, BORDER_MARGIN, WORLD, WORLD);
  bg.lineCap = "round";
  drawGridFloor(bg, BORDER_MARGIN, WORLD);
  drawReefAccents(bg, BORDER_MARGIN, WORLD);
  drawBoundaryGlow(bg, BORDER_MARGIN, WORLD);
  drawNeonBorder(bg, BORDER_MARGIN, WORLD);
  seafloor = c;
}

// Cursor wake: unlike the old ambient ripples (random points across the
// whole pond, visible to everyone via the shared seafloor), this trail only
// ever reads the local player's own pointer and is drawn fresh each frame —
// pure client-side presentation, never sent to or derived from the server,
// so only the local player ever sees their own wake. Kept subtle (see
// cursor-ripples.js's defaults) so it never competes with fish/food for
// attention. Module-level singleton like the old `ripples` array was, since
// there's only ever one local player's cursor to track per page.
const cursorWake = createCursorWake();

// A small glowing spark/gem instead of a plant sprig: a faceted diamond core
// in one of the four home-page accent colours, a soft glow halo around it,
// and a few short radiating sparkle lines through the facets — reads as a
// pickup of energy rather than vegetation, and the glow makes it legible as
// a small bright dot even at the tiny sizes it's drawn at in-game. `f.id`
// (same trick the old sprig used) picks the colour and spins the facet/
// sparkle angles so items don't all look identical, without needing any
// per-item state beyond what `f` already carries.
const drawFood = (ctx, f) => {
  const colour = NEON_PALETTE[f.id % NEON_PALETTE.length];
  const rot = ((f.id * 37) % 360) * (Math.PI / 180);
  const r = f.size * 0.9;

  // Soft outer glow halo, cheap at this size (a single radial-gradient fill)
  // rather than a real shadowBlur per item — keeps ~70 on-screen food items
  // affordable per frame.
  const halo = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r * 2.2);
  halo.addColorStop(0, colour + "66");
  halo.addColorStop(1, colour + "00");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(f.x, f.y, r * 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Faceted diamond core: four points, alternating long/short radius so it
  // reads as a cut gem rather than a plain rotated square.
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  // Bright core and a crossing sparkle, both white so the very centre reads
  // as hot/bright against the coloured facets around it.
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, .8)";
  ctx.lineWidth = Math.max(0.6, r * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, 0);
  ctx.lineTo(r * 0.9, 0);
  ctx.moveTo(0, -r * 0.9);
  ctx.lineTo(0, r * 0.9);
  ctx.stroke();
  ctx.restore();
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
//
// Redesigned to match the neon synth/arcade palette the home screen and the
// (separately redone) in-game map/food now use: glassy translucent panels
// with a glowing coloured stroke, in the same cyan/pink/amber/lime accents as
// --cyan/--pink/--amber/--lime in style.css, rather than the old flat earthy
// hat-shop colours. Three small shared helpers below do the fill+glow+stroke
// and spike/gem shapes every hat is built from, so the ten renderers stay
// short and visually consistent with each other.

// Fills the path drawn by `pathFn` with a translucent, glowing version of
// `colour`, then strokes it in the full colour — the glassy-crystal fill +
// glow-stroke combo the map/food redesign uses, kept as a one-off local
// helper here (rather than reusing that module's own crystalShard/hexNode)
// so hat code stays independent of the map code.
function glowFill(ctx, colour, blur, lineWidth, pathFn, fillAlpha = "33") {
  ctx.beginPath();
  pathFn();
  ctx.shadowColor = colour;
  ctx.shadowBlur = blur;
  ctx.fillStyle = colour + fillAlpha;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colour;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// A narrow glowing spike/shard for crown points, horns, feathers and similar
// pointed accents — points toward local "up" (-y) before `angle` rotates it.
function hatSpike(ctx, x, y, h, w, colour, angle = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.shadowColor = colour;
  ctx.shadowBlur = h * 0.4;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w * 0.5, h * 0.18);
  ctx.lineTo(-w * 0.5, h * 0.18);
  ctx.closePath();
  ctx.fillStyle = colour + "40";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = colour;
  ctx.lineWidth = Math.max(1, w * 0.12);
  ctx.stroke();
  ctx.restore();
}

// A small faceted glowing gem (echoes drawFood's diamond core) used as a
// crown/medal/trophy centrepiece — a bright jewel rather than a flat dot.
function hatGem(ctx, cx, cy, r, colour) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = colour;
  ctx.shadowBlur = r * 1.1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Crown: a glowing crystal diadem — a low cyan circlet band hugging the head
// with a tall cyan centre shard flanked by two shorter amber shards, and a
// pink gem set into the band. Reads as "royalty" via height/symmetry rather
// than a gold colour.
function drawCrown(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#52f1ff", headR * 0.3, Math.max(1, headR * 0.06), () => {
    ctx.ellipse(cx, headR * 0.05, headR * 0.95, headR * 0.3, 0, Math.PI * 1.08, Math.PI * 1.92);
  }, "26");
  hatSpike(ctx, cx + headR * 0.05, -headR * 0.08, headR * 0.85, headR * 0.4, "#52f1ff");
  hatSpike(ctx, cx - headR * 0.55, headR * 0.08, headR * 0.5, headR * 0.3, "#ffb347", -0.3);
  hatSpike(ctx, cx + headR * 0.55, headR * 0.08, headR * 0.5, headR * 0.3, "#ffb347", 0.3);
  hatGem(ctx, cx + headR * 0.05, headR * 0.1, headR * 0.15, "#ff4fd8");
}

// Survivalist: a wide-brimmed explorer/pith helmet — a glowing lime brim
// disc with a lower amber dome on top and a thin crossing strap, reading as
// rugged expedition gear rather than a plain round hat.
function drawSurvivalistHat(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#b6ff3c", headR * 0.3, Math.max(1, headR * 0.05), () => {
    ctx.ellipse(cx, 0, headR * 1.0, headR * 0.5, 0, 0, Math.PI * 2);
  }, "1f");
  glowFill(ctx, "#ffb347", headR * 0.25, Math.max(1, headR * 0.05), () => {
    ctx.arc(cx, -headR * 0.02, headR * 0.58, Math.PI, 0);
  }, "30");
  ctx.strokeStyle = "#b6ff3c";
  ctx.lineWidth = Math.max(1, headR * 0.05);
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.58, -headR * 0.02);
  ctx.lineTo(cx + headR * 0.58, -headR * 0.02);
  ctx.stroke();
  hatGem(ctx, cx, -headR * 0.32, headR * 0.1, "#b6ff3c");
}

// Glutton: a glowing white/cyan geometric toque — a thin band topped by a
// cluster of round glowing puffs, like a chef's hat crown, instead of
// pointed shards.
function drawChefHat(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#52f1ff", headR * 0.2, Math.max(1, headR * 0.05), () => {
    ctx.rect(cx - headR * 0.65, -headR * 0.14, headR * 1.3, headR * 0.26);
  }, "22");
  [
    [-0.42, -headR * 0.28, headR * 0.3],
    [0, -headR * 0.42, headR * 0.38],
    [0.42, -headR * 0.28, headR * 0.3],
  ].forEach(([xOff, y, r]) => {
    glowFill(ctx, "#e8fbff", headR * 0.25, Math.max(1, headR * 0.05), () => {
      ctx.arc(cx + xOff * headR, y, r, 0, Math.PI * 2);
    }, "33");
  });
}

// Herbivore: a laurel-style circlet of thin lime crystal leaf-shards arcing
// around the head, with a small flower-gem accent at the front centre. Full
// wreath density (lots of overlapping leaves) rather than a few spaced-out
// shards, so it reads as a lush crown rather than a sparse ring of spikes.
// Deterministic 0..1 pseudo-random from an integer seed (no Math.random,
// since this hat redraws every frame — a real random would make the leaves
// jitter in place instead of holding a stable messy arrangement).
function leafRand(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function drawLeafCrown(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  // Two overlapping rings of leaves (offset in both angle and radius), each
  // going the full 360° rather than stopping short partway round, so the
  // leaves actually close into a ring instead of leaving a gap at the back
  // of the head. Each leaf's angle, radius, size and tilt get a small
  // per-leaf jitter so the wreath reads as loosely scattered foliage rather
  // than a mechanically even ring of identical shards.
  const ringLeaves = 24;
  [0.78, 0.92].forEach((radiusFactor, ring) => {
    for (let i = 0; i < ringLeaves; i++) {
      const seed = ring * 100 + i;
      const a =
        (i / ringLeaves) * Math.PI * 2 +
        (ring === 1 ? Math.PI / ringLeaves : 0) +
        (leafRand(seed) - 0.5) * ((Math.PI * 2) / ringLeaves) * 0.8;
      const r = headR * radiusFactor * (0.9 + leafRand(seed + 0.5) * 0.2);
      const lx = cx + Math.cos(a) * r;
      const ly = Math.sin(a) * r;
      const h = headR * 0.3 * (0.75 + leafRand(seed + 0.7) * 0.5);
      const w = headR * 0.14 * (0.75 + leafRand(seed + 0.3) * 0.5);
      const tilt = (leafRand(seed + 0.9) - 0.5) * 0.6;
      hatSpike(ctx, lx, ly, h, w, "#b6ff3c", a + Math.PI / 2 + tilt);
    }
  });
  hatGem(ctx, cx + headR * 0.05, headR * 0.08, headR * 0.14, "#ff4fd8");
}

// Dash Master: an amber crystal baseball cap — an angled dome plus a sharp
// shard-like brim jutting forward, a lightning-bolt gem on the front panel,
// and glowing speed-chevrons trailing off the back.
function drawDashCap(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#ffb347", headR * 0.3, Math.max(1, headR * 0.05), () => {
    ctx.arc(cx, -headR * 0.05, headR * 0.62, Math.PI, 0);
  }, "2e");
  glowFill(ctx, "#ffb347", headR * 0.2, Math.max(1, headR * 0.05), () => {
    ctx.moveTo(cx + headR * 0.3, -headR * 0.02);
    ctx.lineTo(cx + headR * 0.95, headR * 0.1);
    ctx.lineTo(cx + headR * 0.55, headR * 0.18);
    ctx.closePath();
  }, "33");
  hatGem(ctx, cx - headR * 0.05, -headR * 0.28, headR * 0.1, "#52f1ff");
  ctx.strokeStyle = "#52f1ff";
  ctx.lineWidth = Math.max(1, headR * 0.07);
  ctx.lineCap = "round";
  ctx.shadowColor = "#52f1ff";
  ctx.shadowBlur = headR * 0.2;
  [-0.25, 0.05, 0.35].forEach((off) => {
    ctx.beginPath();
    ctx.moveTo(cx - headR * 0.6, off * headR);
    ctx.lineTo(cx - headR * 1.05, off * headR * 1.3);
    ctx.stroke();
  });
  ctx.shadowBlur = 0;
}

// Player Hunter: a pink crystal tricorn — three angular faceted panels
// folded into the classic three-cornered silhouette, with a cyan shard
// "feather" swept back off the rear peak.
function drawTricorn(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#ff4fd8", headR * 0.35, Math.max(1, headR * 0.06), () => {
    ctx.moveTo(cx - headR * 0.85, headR * 0.2);
    ctx.lineTo(cx - headR * 0.25, -headR * 0.75);
    ctx.lineTo(cx + headR * 0.3, -headR * 0.35);
    ctx.lineTo(cx + headR * 0.78, headR * 0.3);
    ctx.lineTo(cx + headR * 0.05, headR * 0.05);
    ctx.lineTo(cx - headR * 0.85, headR * 0.2);
  }, "30");
  hatSpike(ctx, cx - headR * 0.25, -headR * 0.75, headR * 0.3, headR * 0.6, "#ff4fd8");
  hatSpike(ctx, cx + headR * 0.3, -headR * 0.35, headR * 0.25, headR * 0.5, "#ff4fd8", 0.2);
  hatSpike(ctx, cx + headR * 0.35, -headR * 0.5, headR * 0.55, headR * 0.16, "#52f1ff", 0.9);
}

// Giant Slayer: a faceted crystal viking helmet — a cyan-silver domed shell
// with two curved amber crystal horns sweeping outward from the sides.
function drawVikingHelmet(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#52f1ff", headR * 0.3, Math.max(1, headR * 0.05), () => {
    ctx.arc(cx, 0, headR * 0.68, Math.PI, 0);
  }, "26");
  glowFill(ctx, "#52f1ff", headR * 0.15, Math.max(1, headR * 0.03), () => {
    ctx.moveTo(cx, -headR * 0.68);
    ctx.lineTo(cx, 0);
  }, "00");
  // Horn roots sit right on the dome's curved edge (its widest point, where
  // the arc meets the flat base) rather than near the centre strap, then
  // sweep outward and up — reading as growing out of the helmet's curve
  // instead of crossing in front of it.
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(cx + side * headR * 0.58, -headR * 0.04);
    ctx.shadowColor = "#ffb347";
    ctx.shadowBlur = headR * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * headR * 0.1, -headR * 0.5, side * headR * 0.55, -headR * 0.8);
    ctx.quadraticCurveTo(side * headR * 0.35, -headR * 0.38, side * headR * 0.08, -headR * 0.1);
    ctx.closePath();
    ctx.fillStyle = "#ffb34740";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffb347";
    ctx.lineWidth = Math.max(1, headR * 0.06);
    ctx.stroke();
    ctx.restore();
  });
}

// Veteran: a glowing amber fedora — a wide brim ring with a lower, slightly
// dimmer crown dome and a crease band, a muted "well-worn" tone next to the
// brighter hats rather than a flashy one.
function drawFedora(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#ffb347", headR * 0.22, Math.max(1, headR * 0.05), () => {
    ctx.ellipse(cx, 0, headR * 0.85, headR * 0.35, 0, 0, Math.PI * 2);
  }, "22");
  glowFill(ctx, "#ffb347", headR * 0.18, Math.max(1, headR * 0.04), () => {
    ctx.ellipse(cx, -headR * 0.05, headR * 0.48, headR * 0.42, 0, Math.PI, 0);
  }, "2e");
  ctx.strokeStyle = "#ffe8c4";
  ctx.lineWidth = Math.max(1, headR * 0.04);
  ctx.beginPath();
  ctx.moveTo(cx + headR * 0.15, -headR * 0.45);
  ctx.lineTo(cx + headR * 0.15, -headR * 0.08);
  ctx.stroke();
}

// Leaderboard Entrant: a glowing amber circlet headband (worn low on the
// head, not floating above it) with a faceted medallion gem hanging at the
// front centre, directly below the string's lowest point.
function drawMedal(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#ffb347", headR * 0.25, Math.max(1, headR * 0.06), () => {
    ctx.ellipse(cx, headR * 0.05, headR * 0.9, headR * 0.3, 0, Math.PI * 1.05, Math.PI * 1.95);
  }, "22");
  hatGem(ctx, cx, headR * 0.35, headR * 0.26, "#ffb347");
  drawStar(ctx, cx, headR * 0.35, headR * 0.12, "#fff4de");
}

// Leaderboard Leader: a glowing crystal trophy worn as a tall topper — a
// faceted gold cup with two glowing handle loops on a short stem, the
// tallest and most elaborate hat, visually distinct from Crown's spiky
// diadem via its rounded cup silhouette.
function drawTrophy(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  const topY = -headR * 0.95;
  const bowlW = headR * 0.42;
  const bowlH = headR * 0.4;
  glowFill(ctx, "#ffd76b", headR * 0.3, Math.max(1, headR * 0.05), () => {
    ctx.moveTo(cx - bowlW, topY);
    ctx.quadraticCurveTo(cx - bowlW, topY + bowlH, cx, topY + bowlH);
    ctx.quadraticCurveTo(cx + bowlW, topY + bowlH, cx + bowlW, topY);
    ctx.closePath();
  }, "30");
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.shadowColor = "#ffd76b";
    ctx.shadowBlur = headR * 0.2;
    ctx.strokeStyle = "#ffd76b";
    ctx.lineWidth = Math.max(1, headR * 0.05);
    ctx.beginPath();
    ctx.ellipse(cx + side * bowlW * 1.25, topY + bowlH * 0.3, bowlW * 0.3, bowlH * 0.38, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  glowFill(ctx, "#ffd76b", headR * 0.15, Math.max(1, headR * 0.04), () => {
    ctx.rect(cx - headR * 0.07, topY + bowlH, headR * 0.14, headR * 0.3);
  }, "33");
  glowFill(ctx, "#ffd76b", headR * 0.15, Math.max(1, headR * 0.04), () => {
    ctx.rect(cx - headR * 0.24, topY + bowlH + headR * 0.28, headR * 0.48, headR * 0.1);
  }, "33");
  hatGem(ctx, cx, topY + bowlH * 0.45, headR * 0.1, "#ff4fd8");
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

// Each hat's own forward/back nudge (toward the tail, in headR units) used to
// live inside its renderer as `cx = noseCenterX - headR * K`. That ran after
// `extraRotation` below, so a nose-tail nudge got rotated into a sideways one
// whenever a hat was drawn on a (rotated) fish, throwing it off-centre. Moved
// here so it's folded into the same pre-rotation translate as HAT_BACK_SHIFT
// and always stays along the fish's true nose-tail axis.
const HAT_NUDGE = {
  crown: 0.25, survivalist: 0.15, glutton: 0.2, herbivore: 0.2,
  dashMaster: 0.25, playerHunter: 0.3, giantSlayer: 0.15, veteran: 0.15,
  leaderboardEntrant: 0.1, leaderboardLeader: 0.3,
};

export function drawHat(ctx, hatId, headR, noseCenterX, extraRotation = 0) {
  const renderer = HAT_RENDERERS[hatId];
  if (!renderer) return;
  const nudge = HAT_NUDGE[hatId] ?? 0;
  ctx.save();
  ctx.translate(noseCenterX - headR * (HAT_BACK_SHIFT + nudge * HAT_SCALE), 0);
  if (extraRotation) ctx.rotate(extraRotation);
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
// ring, a real rival), or falsy (a bot, no ring). `showLabel` is false for
// the start screen's fish preview (fish-preview.js, drawing one standalone
// fish on its own small canvas, the same way drawHatIcon below draws one
// standalone hat) — a name floating above a fish with nothing else around it
// to give it scale/context doesn't read as a name tag, just clutter.
export function drawFish(ctx, e, outline, showLabel = true) {
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

  if (e.hat) drawHat(ctx, e.hat, headR, noseCenterX, -Math.PI / 2);

  ctx.restore();

  if (!showLabel) return;

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
// `pointerWorld`, if given, is the local player's cursor position already
// converted to world coordinates (main.js does that conversion using the
// same w/2 - you.x camera math below, since it's the one that knows the raw
// screen-space pointer) — used only to drive the local cursor-wake trail, so
// it's optional and simply omitted/null if the caller has no pointer info.
export function render(ctx, state, you, others, dt = 1 / 60, pointerWorld = null) {
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
  cursorWake.update(pointerWorld?.x, pointerWorld?.y, dt);
  cursorWake.draw(ctx);
  state.food.forEach((f) => drawFood(ctx, f));
  state.bots.forEach((b) => drawFish(ctx, b, false));
  others.forEach((o) => drawFish(ctx, o, "player"));
  drawBites(ctx, dt);
  drawFish(ctx, you, "you");
  ctx.restore();
}
