import { COLOURS } from "./profile.js";
import { WORLD } from "./sim.js";

const drawFood = (ctx, f) => {
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
  ctx.fillStyle = COLOURS[f.colour] ?? "#fff";
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
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  const labelY = e.y - e.size - fontSize * 0.4 - 4;
  ctx.strokeText(label, e.x, labelY);
  ctx.fillStyle = "#e8f6fa";
  ctx.fillText(label, e.x, labelY);
}

export function render(ctx, state) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  const p = state.player;
  ctx.save();
  ctx.translate(w / 2 - p.x, h / 2 - p.y);
  ctx.strokeStyle = "#3b7a8f";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, WORLD, WORLD);
  state.food.forEach((f) => drawFood(ctx, f));
  state.bots.forEach((b) => drawFish(ctx, b, false));
  drawFish(ctx, p, true);
  ctx.restore();
}
