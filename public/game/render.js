import { COLOURS } from "./profile.js";
import { START_SIZE, WORLD } from "./sim.js";
import { createCursorWake } from "./cursor-ripples.js";

// The seafloor canvas is bigger than the playable WORLD square: this margin
// is shoreline, a rock-and-reed bank the camera can see past the clamp
// boundary without the water itself extending there. Needs to be generous —
// the camera centres on the player, so with a fish clamped right at the world
// edge the margin must cover at least half the viewport's width/height or
// the view runs past the cached image into the plain canvas background
// before the bank does, visibly "ending" the border. 1400 comfortably covers
// browser windows up to ~2800px wide/tall (full HD and most large-monitor
// windows); #canvas's own CSS background is matched to the margin's own ink
// fill (see buildSeafloor) so even a wider viewport than that degrades into
// more of the same dark void instead of a visible seam into the water tone.
const BORDER_MARGIN = 1400;

// Pond scenery lives in two palettes: muted stone tones for rocks and a wide
// spread of greens (dark forest to bright lime) for reeds/lily pads/food
// leaves, scattered together along the banks and in loose clumps across the
// open water so the floor reads as a real, lively pond bed rather than a
// single repeating tile.
const ROCK_COLOURS = ["#8a8172", "#6e6457", "#9c9384", "#5a5244", "#7d7262", "#948a7a"];
const PLANT_COLOURS = ["#1f5c33", "#2f6b2e", "#3f7d3a", "#538f3f", "#6aa84f", "#7cb342", "#8bc34a", "#4c8c4a", "#356b44"];

// Lightens (positive percent) or darkens (negative) a "#rrggbb" colour by a
// flat amount per channel — used to derive a rock's shadow/highlight and a
// reed's vein colour from its own fill without a second colour table.
function shade(hex, percent) {
  const n = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// Picks a random plant colour and jitters it a further +/-12% lighter/darker,
// so even two leaves drawn back-to-back from the same palette entry come out
// a visibly different green — called per-leaf (not once per cluster) so
// every reed, lily pad and food leaf carries its own shade.
function randomPlantColour() {
  const base = PLANT_COLOURS[Math.floor(Math.random() * PLANT_COLOURS.length)];
  return shade(base, (Math.random() - 0.5) * 24);
}

// Same jitter as randomPlantColour but keyed off an id via leafRand (the
// deterministic 0..1 hash defined below, shared with the leaf-crown hat), so
// a given food item's green stays fixed across frames instead of flickering
// as it redraws each one.
function seededPlantColour(seed) {
  const base = PLANT_COLOURS[Math.floor(leafRand(seed) * PLANT_COLOURS.length)];
  return shade(base, (leafRand(seed + 0.5) - 0.5) * 24);
}

// A translucent blue wash filled over whatever shape is the context's
// current path — used by the rock/reed/lily-pad drawers to sink interior
// scenery a shade darker and bluer than the identical objects drawn on the
// bank, so the open water's rocks and plants read as submerged rather than
// sitting on dry land the way the border decorations do.
const UNDERWATER_TINT = "rgba(18, 74, 110, 0.6)";
function tintUnderwater(ctx) {
  ctx.fillStyle = UNDERWATER_TINT;
  ctx.fill();
}

// Traces the irregular rounded-blob outline (per-vertex radius jittered
// around a circle, joined with quadratic curves so it stays smooth rather
// than faceted) onto the context's current path, centred on the current
// transform's origin — shared by drawRock's fill/stroke pass and its final
// underwater tint pass, which both need the exact same silhouette.
function tracePebblePath(ctx, r, radii) {
  const points = radii.length;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = radii[i % points];
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    const mx = Math.cos(a - Math.PI / points) * rr * 1.04;
    const my = Math.sin(a - Math.PI / points) * rr * 1.04;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.quadraticCurveTo(mx, my, x, y);
  }
  ctx.closePath();
}

// A single water-smoothed pebble. A darker crescent on one side and a soft
// pale highlight on the other read as a rounded object seen from above
// rather than a flat shape. `underwater` washes the whole pebble in a
// translucent blue (see tintUnderwater) so interior-water rocks read as
// submerged next to the identical, untinted ones drawn on the dry bank.
function drawRock(ctx, cx, cy, r, colour, angle = 0, underwater = false) {
  const radii = Array.from({ length: 8 }, () => r * (0.75 + Math.random() * 0.35));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  tracePebblePath(ctx, r, radii);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = shade(colour, -18);
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();
  // Shadow crescent and highlight patch, both clipped to the rock's own
  // silhouette so neither ever spills past its outline.
  ctx.save();
  tracePebblePath(ctx, r, radii);
  ctx.clip();
  ctx.fillStyle = shade(colour, -22) + "80";
  ctx.beginPath();
  ctx.ellipse(r * 0.35, r * 0.35, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(colour, 22) + "66";
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.3, r * 0.4, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (underwater) {
    tracePebblePath(ctx, r, radii);
    tintUnderwater(ctx);
  }
  ctx.restore();
}

// Traces a reed blade's tapering outline (wide base, soft point, sideways
// bow partway up) onto the current path, local "up" (-y) before any rotation
// — shared by drawReed's own fill/stroke pass and its underwater tint pass.
function traceReedPath(ctx, h, w, bow) {
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, 0);
  ctx.quadraticCurveTo(bow, -h * 0.6, 0, -h);
  ctx.quadraticCurveTo(bow + w * 0.3, -h * 0.55, w * 0.5, 0);
  ctx.closePath();
}

// A single curved reed/plant blade, drawn pointing in local "up" (-y) before
// `angle` rotates it to face wherever the caller needs — callers pass a
// fully random angle for interior/underwater reeds (since top-down, a plant
// can lean any direction) or an outward-biased one for bank reeds. A darker
// midrib line gives it a leaf-like vein instead of a flat silhouette.
// `underwater` washes the blade in translucent blue (see tintUnderwater) so
// submerged reeds read darker/bluer than the identical ones on the dry bank.
function drawReed(ctx, cx, cy, h, w, colour, angle = 0, underwater = false) {
  const bow = (Math.random() - 0.5) * w * 1.4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  traceReedPath(ctx, h, w, bow);
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = shade(colour, -20);
  ctx.lineWidth = Math.max(1, w * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.05);
  ctx.quadraticCurveTo(bow * 0.6, -h * 0.6, 0, -h * 0.95);
  ctx.strokeStyle = shade(colour, -30) + "aa";
  ctx.lineWidth = Math.max(1, w * 0.06);
  ctx.stroke();
  if (underwater) {
    traceReedPath(ctx, h, w, bow);
    tintUnderwater(ctx);
  }
  ctx.restore();
}

// A lily pad: a flat notched disc (the classic top-down lily-leaf wedge cut
// out of a circle) with a few veins fanning out from the notch. `underwater`
// washes it in translucent blue (see tintUnderwater) so pads floating over
// open water read as submerged/shadowed next to the ones on the dry bank.
function drawLilyPad(ctx, cx, cy, r, colour, angle = 0, underwater = false) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, 0.3, Math.PI * 2 - 0.3);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = shade(colour, -20);
  ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.stroke();
  ctx.strokeStyle = shade(colour, -20) + "99";
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = -2; i <= 2; i++) {
    const a = 0.3 + ((Math.PI * 2 - 0.6) * (i + 2)) / 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
    ctx.stroke();
  }
  if (underwater) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, 0.3, Math.PI * 2 - 0.3);
    ctx.closePath();
    tintUnderwater(ctx);
  }
  ctx.restore();
}

// Rotates "up" (-y) to point along the unit direction (outX, outY) — shared
// by the straight border edges and the corner clumps below so "away from
// the water" always maps to the same formula instead of four hand-picked
// angle constants.
function outwardAngle(outX, outY) {
  return Math.atan2(outX, -outY);
}

// A solid band of packed-mud "ground" filling the whole bank strip along one
// edge of the WORLD square, drawn before the individual rocks/reeds so it
// shows through as solid earth wherever those don't happen to overlap —
// without it, a bank built only from scattered blob/blade shapes always has
// visible dark-water-coloured gaps between them. The water-side edge of the
// band wobbles between two states, never receding past the world boundary
// itself: "lumps" (depth well below zero) that reach in and overlap the
// playable grid, and "dents" (depth exactly zero) that fall back to just
// meet the boundary line rather than past it — depth is `-wobbleFraction *
// innerWobble - jitter`, where wobbleFraction and jitter are both >= 0, so
// the whole expression is always <= 0 and the band can never recede into the
// bank and expose a gap of water/grid colour the way a two-sided wobble
// would. The outer edge runs all the way out to BORDER_MARGIN — the full
// depth of the margin canvas, i.e. as far as the camera could ever see past
// the world edge — so no plain ink-margin colour is left showing beyond
// where the rocks/reeds stop, however far out the view extends. `perp`
// collapses the axis-aligned `out` unit vector to a single signed scalar
// (exactly one of out.x/out.y is ±1, the other 0) since every point along
// this band moves the same "away from water" direction. `overshoot` extends
// both ends past the raw start/length so adjacent edges' bands overlap
// through the corners instead of leaving a diagonal gap where two bands
// would otherwise just meet edge-to-edge.
function drawShoreBand(ctx, axis, fixed, start, length, reach, out, colour, overshoot) {
  const perp = out.x + out.y;
  const bandStart = start - overshoot;
  const bandLength = length + overshoot * 2;
  const segments = Math.max(10, Math.round(bandLength / 50));
  const innerWobble = reach * 0.55;
  const outerDepth = BORDER_MARGIN;

  const at = (t, depth) => {
    const across = fixed + perp * depth;
    return axis === "x" ? { x: t, y: across } : { x: across, y: t };
  };

  const innerPts = [];
  for (let i = 0; i <= segments; i++) {
    const t = bandStart + (bandLength * i) / segments;
    const wobbleFraction = Math.sin(i * 1.3 + 7) * 0.5 + 0.5;
    const jitter = Math.random() * innerWobble * 0.25;
    const depth = -wobbleFraction * innerWobble - jitter;
    innerPts.push(at(t, depth));
  }

  ctx.beginPath();
  ctx.moveTo(innerPts[0].x, innerPts[0].y);
  for (let i = 1; i < innerPts.length; i++) {
    const p = innerPts[i];
    const prev = innerPts[i - 1];
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + p.x) / 2, (prev.y + p.y) / 2);
  }
  ctx.lineTo(innerPts[innerPts.length - 1].x, innerPts[innerPts.length - 1].y);
  const outerEnd = at(bandStart + bandLength, outerDepth);
  const outerStart = at(bandStart, outerDepth);
  ctx.lineTo(outerEnd.x, outerEnd.y);
  ctx.lineTo(outerStart.x, outerStart.y);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

// Scatters rocks and reed clumps along one edge of the WORLD square, on top
// of that edge's solid ground band: a bank of stones with plants growing up
// between them. `axis` is which way the edge runs ("x" for top/bottom, "y"
// for left/right); `fixed` is where the boundary line sits on the other
// axis; `out` is the unit vector pointing away from the water. Density/size
// vary per edge so the four sides don't read as one repeating tile.
const EDGE_OVERLAP = 0.75;
function drawReefEdge(ctx, axis, fixed, start, length, density, [minSize, maxSize], reach, out) {
  const angle = outwardAngle(out.x, out.y);
  let along = start - reach * 0.3;
  const end = start + length + reach * 0.3;
  while (along < end) {
    const size = minSize + Math.random() * (maxSize - minSize);
    const across = fixed + (Math.random() * 2 - 1) * reach * 0.5 + out.x * reach * 0.15 + out.y * reach * 0.15;
    const x = axis === "x" ? along : across;
    const y = axis === "x" ? across : along;
    if (Math.random() < 0.55) {
      drawRock(ctx, x, y, size * 0.5, ROCK_COLOURS[Math.floor(Math.random() * ROCK_COLOURS.length)]);
    } else {
      const h = size * (0.9 + Math.random() * 0.4);
      const w = h * (0.3 + Math.random() * 0.15);
      drawReed(ctx, x, y, h, w, randomPlantColour(), angle + (Math.random() - 0.5) * 0.4);
    }
    along += (size * EDGE_OVERLAP) / density;
  }
}

// A reinforced clump of rocks, reeds and lily pads radiating outward from the
// world's corner, so corners read as a denser bank rather than two edges just
// trailing off into bare margin beside each other.
function drawReefCorner(ctx, cx, cy, outX, outY) {
  const angle = outwardAngle(outX, outY);
  for (let i = 0; i < 6; i++) {
    const x = cx + outX * (15 + Math.random() * 65) + (Math.random() - 0.5) * 50;
    const y = cy + outY * (15 + Math.random() * 65) + (Math.random() - 0.5) * 50;
    drawRock(ctx, x, y, 26 + Math.random() * 24, ROCK_COLOURS[Math.floor(Math.random() * ROCK_COLOURS.length)]);
  }
  for (let i = 0; i < 6; i++) {
    const spread = (Math.random() - 0.5) * 1.1;
    const x = cx + outX * (25 + Math.random() * 70) + (Math.random() - 0.5) * 50;
    const y = cy + outY * (25 + Math.random() * 70) + (Math.random() - 0.5) * 50;
    const h = 65 + Math.random() * 75;
    const w = h * 0.4;
    drawReed(ctx, x, y, h, w, randomPlantColour(), angle + spread);
  }
  for (let i = 0; i < 3; i++) {
    const x = cx + outX * (20 + Math.random() * 60) + (Math.random() - 0.5) * 60;
    const y = cy + outY * (20 + Math.random() * 60) + (Math.random() - 0.5) * 60;
    drawLilyPad(ctx, x, y, 24 + Math.random() * 22, randomPlantColour(), Math.random() * Math.PI * 2);
  }
}

// Packed-mud ground tone for the solid shore bands beneath the rocks/reeds —
// close to the darkest rock colour so any sliver of ground peeking between
// scattered decorations still reads as "bank" rather than a mismatched
// colour showing through.
const GROUND_COLOUR = "#4a4030";

// The four margin corners (e.g. top-left: x in [0, margin], y in [0, margin])
// sit outside every edge's own shore band, which only runs the length of its
// one straight side (plus a small overshoot to bridge the seam) — so without
// this, each corner square is the plain dark ink background showing through
// behind wherever drawReefCorner's scattered rocks/reeds don't happen to
// cover it. Filled solid before anything else draws over it, so every corner
// reads as ground, however far the camera's view reaches into it.
function drawCornerFills(ctx, margin, world) {
  ctx.fillStyle = GROUND_COLOUR;
  ctx.fillRect(0, 0, margin, margin);
  ctx.fillRect(margin + world, 0, margin, margin);
  ctx.fillRect(0, margin + world, margin, margin);
  ctx.fillRect(margin + world, margin + world, margin, margin);
}

// Border density/size scaled up and no longer locked to one plant shade per
// side: each reed/pad now jitters its own green via randomPlantColour so the
// bank itself carries a lively mix instead of a flat per-edge tone. A solid
// shore band is drawn under each edge first (overshooting into the corners so
// adjacent bands overlap rather than leaving a diagonal gap), then the
// scattered rocks/reeds/pads on top — so the border reads as a continuous
// bank with decoration on it, never bare water showing through a gap.
function drawPondBorder(ctx, margin, world) {
  drawShoreBand(ctx, "x", margin, margin, world, 90, { x: 0, y: -1 }, GROUND_COLOUR, 90);
  drawShoreBand(ctx, "x", margin + world, margin, world, 120, { x: 0, y: 1 }, GROUND_COLOUR, 120);
  drawShoreBand(ctx, "y", margin, margin, world, 140, { x: -1, y: 0 }, GROUND_COLOUR, 140);
  drawShoreBand(ctx, "y", margin + world, margin, world, 160, { x: 1, y: 0 }, GROUND_COLOUR, 160);
  drawReefEdge(ctx, "x", margin, margin, world, 1.4, [40, 85], 90, { x: 0, y: -1 });
  drawReefEdge(ctx, "x", margin + world, margin, world, 1.6, [46, 100], 120, { x: 0, y: 1 });
  drawReefEdge(ctx, "y", margin, margin, world, 1.1, [42, 108], 140, { x: -1, y: 0 });
  drawReefEdge(ctx, "y", margin + world, margin, world, 1.8, [50, 115], 160, { x: 1, y: 0 });
  drawReefCorner(ctx, margin, margin, -1, -1);
  drawReefCorner(ctx, margin + world, margin, 1, -1);
  drawReefCorner(ctx, margin, margin + world, -1, 1);
  drawReefCorner(ctx, margin + world, margin + world, 1, 1);
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

// Interior scenery: loose clumps of rocks and reeds scattered across the
// open water, like stones and plants growing up from a real pond bed rather
// than in a tidy ring around the edge. Seen from directly above, a plant
// growing out of the bed has no "natural" lean the way a bank plant reaching
// for the open water does, so every reed here gets a fully random facing
// instead of the bank reeds' outward bias. Everything here is drawn with
// `underwater: true` so these clumps read as submerged, a shade darker/bluer
// than the identical shapes along the dry bank.
function drawReefAccents(ctx, margin, world) {
  const clusters = 34;
  for (let s = 0; s < clusters; s++) {
    const cx = margin + Math.random() * world;
    const cy = margin + Math.random() * world;
    const rocks = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < rocks; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 28;
      drawRock(
        ctx,
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        20 + Math.random() * 30,
        ROCK_COLOURS[Math.floor(Math.random() * ROCK_COLOURS.length)],
        Math.random() * Math.PI * 2,
        true,
      );
    }
    const reeds = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < reeds; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 40;
      const sx = cx + Math.cos(angle) * dist;
      const sy = cy + Math.sin(angle) * dist;
      const h = 40 + Math.random() * 60;
      const w = h * 0.3;
      drawReed(ctx, sx, sy, h, w, randomPlantColour(), Math.random() * Math.PI * 2, true);
    }
  }

  // Lily pads scattered separately and much more densely than the rock/reed
  // clumps — drifting alone or in loose little rafts of two or three, since
  // real lily pads cluster independently of rocky outcrops.
  const pads = 70;
  for (let s = 0; s < pads; s++) {
    const cx = margin + Math.random() * world;
    const cy = margin + Math.random() * world;
    const raft = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < raft; i++) {
      const px = cx + (Math.random() - 0.5) * 50;
      const py = cy + (Math.random() - 0.5) * 50;
      drawLilyPad(ctx, px, py, 20 + Math.random() * 26, randomPlantColour(), Math.random() * Math.PI * 2, true);
    }
  }
}

// Slight water-ripple distortion over the open interior water — the grid and
// the underwater-tinted rocks/plants — applied on top of the already-blitted
// seafloor each frame. The classic cheap approach: re-blit the same image in
// thin horizontal strips, each sourced from (and landing at) its own y but
// offset sideways by a time- and y-varying sine, so the whole interior wobbles
// like it's seen through shallow water instead of looking like a flat static
// image. Confined to the WORLD square only (not the dry bank, which is drawn
// once in buildSeafloor and left crisp/undistorted) by sourcing/targeting
// strictly y in [0, WORLD) of world space.
const RIPPLE_AMPLITUDE = 1.5;
const RIPPLE_WAVELENGTH = 18;
const RIPPLE_SPEED = 3.2;
const RIPPLE_STRIP_HEIGHT = 2;

function drawRippledWater(ctx, nowMs) {
  const t = nowMs / 1000;
  for (let y = 0; y < WORLD; y += RIPPLE_STRIP_HEIGHT) {
    const stripH = Math.min(RIPPLE_STRIP_HEIGHT, WORLD - y);
    const offset = Math.sin(y / RIPPLE_WAVELENGTH + t * RIPPLE_SPEED) * RIPPLE_AMPLITUDE;
    ctx.drawImage(seafloor, BORDER_MARGIN, BORDER_MARGIN + y, WORLD, stripH, offset, y, WORLD, stripH);
  }
}

// The seafloor is a cached world-sized image (dark pond-bed margin, a faint
// grid across the water, scattered rock/plant clumps, and a stony reed-lined
// bank), built once and blitted whole each frame rather than redrawn, so it
// reads as one scene instead of scattered shapes.
let seafloor = null;
function buildSeafloor() {
  const size = WORLD + BORDER_MARGIN * 2;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const bg = c.getContext("2d");
  // Margin (the bank beyond the playable square) in the same dark ink as the
  // rest of the app — the border rocks/reeds drawn over it are what mark the
  // edge, not a colour change.
  bg.fillStyle = "#04141c";
  bg.fillRect(0, 0, size, size);
  bg.fillStyle = "#0a3548";
  bg.fillRect(BORDER_MARGIN, BORDER_MARGIN, WORLD, WORLD);
  drawCornerFills(bg, BORDER_MARGIN, WORLD);
  bg.lineCap = "round";
  drawGridFloor(bg, BORDER_MARGIN, WORLD);
  drawReefAccents(bg, BORDER_MARGIN, WORLD);
  drawBoundaryGlow(bg, BORDER_MARGIN, WORLD);
  drawPondBorder(bg, BORDER_MARGIN, WORLD);
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

// Food reads as two pond-native things instead of one gem shape: a small
// floating leaf (a simple pointed-oval blade with a midrib) or a tiny minnow
// (a shrunk version of the player fish's own teardrop-body silhouette).
// `f.id` (deterministic, no per-item state needed) picks which of the two,
// its colour, and its facing/wobble so items don't all look identical.
const FOOD_FISH_COLOURS = ["#d9b35c", "#c97b4a", "#e8e3d0", "#9fb4c7"];

function drawFoodLeaf(ctx, f, colour) {
  const r = f.size * 1.5;
  const rot = ((f.id * 53) % 360) * (Math.PI / 180);
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.6, -r * 0.3, 0, r);
  ctx.quadraticCurveTo(-r * 0.6, -r * 0.3, 0, -r);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.strokeStyle = shade(colour, -18);
  ctx.lineWidth = Math.max(0.6, r * 0.1);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(0, r * 0.85);
  ctx.strokeStyle = shade(colour, -25) + "aa";
  ctx.lineWidth = Math.max(0.5, r * 0.06);
  ctx.stroke();
  ctx.restore();
}

function drawFoodFish(ctx, f, colour) {
  const r = f.size * 1.5;
  const rot = ((f.id * 71) % 360) * (Math.PI / 180);
  const wag = Math.sin(f.id * 1.7 + performance.now() / 180) * 0.5;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(rot);
  // Small forked tail, wagging gently, drawn before the body so the body
  // overlaps its joint.
  ctx.save();
  ctx.translate(-r * 1.3, 0);
  ctx.rotate(wag);
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.6);
  ctx.lineTo(r * 0.3, 0);
  ctx.lineTo(-r * 0.6, r * 0.6);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.restore();
  // Teardrop body: pointed tail-base, rounded head.
  ctx.beginPath();
  ctx.moveTo(-r * 1.3, 0);
  ctx.quadraticCurveTo(0, -r * 0.8, r * 0.9, 0);
  ctx.quadraticCurveTo(0, r * 0.8, -r * 1.3, 0);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.arc(r * 0.55, 0, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const drawFood = (ctx, f) => {
  if (f.id % 2 === 0) {
    drawFoodLeaf(ctx, f, seededPlantColour(f.id));
  } else {
    drawFoodFish(ctx, f, FOOD_FISH_COLOURS[f.id % FOOD_FISH_COLOURS.length]);
  }
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
  ctx.fillStyle = colour + "73";
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
  }, "44");
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
  }, "38");
  glowFill(ctx, "#ffb347", headR * 0.25, Math.max(1, headR * 0.05), () => {
    ctx.arc(cx, -headR * 0.02, headR * 0.58, Math.PI, 0);
  }, "56");
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
  }, "3d");
  [
    [-0.42, -headR * 0.28, headR * 0.3],
    [0, -headR * 0.42, headR * 0.38],
    [0.42, -headR * 0.28, headR * 0.3],
  ].forEach(([xOff, y, r]) => {
    glowFill(ctx, "#e8fbff", headR * 0.25, Math.max(1, headR * 0.05), () => {
      ctx.arc(cx + xOff * headR, y, r, 0, Math.PI * 2);
    }, "5c");
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

      // A small flower gem tucked among roughly a third of the leaves, sat
      // further out at the leaf tips (not in the empty middle over the
      // fish's face) so the flowers read as growing out of the wreath
      // itself.
      if (leafRand(seed + 0.2) < 0.35) {
        const fr = r * (1.05 + leafRand(seed + 0.4) * 0.12);
        const fx = cx + Math.cos(a) * fr;
        const fy = Math.sin(a) * fr;
        hatGem(ctx, fx, fy, headR * (0.07 + leafRand(seed + 0.6) * 0.05), "#ff4fd8");
      }
    }
  });
}

// Dash Master: an amber crystal baseball cap — an angled dome plus a sharp
// shard-like brim jutting forward, a lightning-bolt gem on the front panel,
// and glowing speed-chevrons trailing off the back.
function drawDashCap(ctx, headR, noseCenterX) {
  const cx = noseCenterX;
  glowFill(ctx, "#ffb347", headR * 0.3, Math.max(1, headR * 0.05), () => {
    ctx.arc(cx, -headR * 0.05, headR * 0.62, Math.PI, 0);
  }, "53");
  glowFill(ctx, "#ffb347", headR * 0.2, Math.max(1, headR * 0.05), () => {
    ctx.moveTo(cx + headR * 0.3, -headR * 0.02);
    ctx.lineTo(cx + headR * 0.95, headR * 0.1);
    ctx.lineTo(cx + headR * 0.55, headR * 0.18);
    ctx.closePath();
  }, "5c");
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
  }, "56");
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
  }, "44");
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
    ctx.fillStyle = "#ffb34773";
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
  }, "3d");
  glowFill(ctx, "#ffb347", headR * 0.18, Math.max(1, headR * 0.04), () => {
    ctx.ellipse(cx, -headR * 0.05, headR * 0.48, headR * 0.42, 0, Math.PI, 0);
  }, "53");
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
  }, "3d");
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
  }, "56");
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
  }, "5c");
  glowFill(ctx, "#ffd76b", headR * 0.15, Math.max(1, headR * 0.04), () => {
    ctx.rect(cx - headR * 0.24, topY + bowlH + headR * 0.28, headR * 0.48, headR * 0.1);
  }, "5c");
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
// Kept small so most hats sit close to the eyes rather than down near the
// tail-ward edge of the head; herbivore's own larger nudge below keeps the
// leaf crown exactly where it already was.
const HAT_SCALE = 0.75;
const HAT_BACK_SHIFT = 0.15;

// Each hat's own forward/back nudge (toward the tail, in headR units) used to
// live inside its renderer as `cx = noseCenterX - headR * K`. That ran after
// `extraRotation` below, so a nose-tail nudge got rotated into a sideways one
// whenever a hat was drawn on a (rotated) fish, throwing it off-centre. Moved
// here so it's folded into the same pre-rotation translate as HAT_BACK_SHIFT
// and always stays along the fish's true nose-tail axis. herbivore's nudge is
// larger than the rest specifically to offset HAT_BACK_SHIFT's drop above and
// hold the leaf crown at its original, already-tuned position.
const HAT_NUDGE = {
  crown: 0.25, survivalist: 0.15, glutton: 0.2, herbivore: 0.5333,
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

// Camera zoom: starts tight on a tiny new fish and eases out as it grows, so
// the world feels large and close at the start rather than showing the same
// wide view a fully-grown fish gets. ZOOM_IN is the factor applied at
// START_SIZE (>1 magnifies); ZOOM_OUT is the factor once the fish reaches
// ZOOM_REF_SIZE or bigger (1 = the original unzoomed view, which is what the
// game looked like before this feature existed). ZOOM_REF_SIZE is picked well
// below MAX_SIZE (the rare endgame cap) rather than at it, so the zoom-out
// plays out over the normal early/mid-game growth curve instead of only
// finishing once a fish is nearly unkillable.
const ZOOM_IN = 2.1;
const ZOOM_OUT = 1;
const ZOOM_REF_SIZE = 140;
// Smoothing factor for easing the camera toward its target zoom each frame
// (exponential decay, framerate-independent via dt) — without this, zoom
// would jump a visible step on every single growth tick instead of drifting
// smoothly outward.
const ZOOM_SMOOTHING = 2.5;
let currentZoom = ZOOM_IN;

function targetZoomFor(size) {
  const t = Math.min(1, Math.max(0, (size - START_SIZE) / (ZOOM_REF_SIZE - START_SIZE)));
  // Ease-out (sqrt) rather than linear: zoom relaxes quickly over the first
  // bit of growth, then tapers, which reads as "snapping out" from a cramped
  // start rather than a slow linear drift the whole way.
  return ZOOM_IN + (ZOOM_OUT - ZOOM_IN) * Math.sqrt(t);
}

// The current eased zoom factor, for main.js to convert the raw screen-space
// pointer into world coordinates (the cursor-wake trail's only consumer of
// that conversion) — render() is what advances `currentZoom` each frame, so
// callers must read this only after render() has run for the current frame.
export function getZoom() {
  return currentZoom;
}

// Snaps the camera back to fully zoomed-in — called once per new run (from
// main.js's play()) so a fresh small fish always starts tight-in rather than
// inheriting whatever zoom level the previous run eased out to.
export function resetZoom() {
  currentZoom = ZOOM_IN;
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
  // Ease currentZoom toward this frame's target (1 - e^-k*dt is the
  // framerate-independent form of "move a fixed fraction of the remaining gap
  // each frame") rather than jumping straight to it, so growth reads as a
  // smooth zoom-out instead of a snap every time `you.size` ticks up.
  currentZoom += (targetZoomFor(you.size) - currentZoom) * (1 - Math.exp(-ZOOM_SMOOTHING * dt));
  // Scale first (about the eventual screen centre) so the translate below,
  // which keeps `you` pinned there, lands in the same post-scale space;
  // doing it in the other order would scale the translation itself and pull
  // the player off-centre.
  ctx.translate(w / 2, h / 2);
  ctx.scale(currentZoom, currentZoom);
  ctx.translate(-you.x, -you.y);
  if (!seafloor) buildSeafloor();
  ctx.drawImage(seafloor, -BORDER_MARGIN, -BORDER_MARGIN);
  // Re-draws just the interior WORLD square (grid + underwater rocks/plants)
  // in wobbling horizontal strips on top of the plain blit above, so the dry
  // bank stays crisp/static while the open water gets the ripple distortion.
  drawRippledWater(ctx, performance.now());
  cursorWake.update(pointerWorld?.x, pointerWorld?.y, dt);
  cursorWake.draw(ctx);
  state.food.forEach((f) => drawFood(ctx, f));
  state.bots.forEach((b) => drawFish(ctx, b, false));
  others.forEach((o) => drawFish(ctx, o, "player"));
  drawBites(ctx, dt);
  drawFish(ctx, you, "you");
  ctx.restore();
}
