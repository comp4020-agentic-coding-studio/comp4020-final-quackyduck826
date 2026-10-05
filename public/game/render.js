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

  // Tail, drawn first so the body overlaps its joint.
  ctx.save();
  ctx.translate(tailX, 0);
  ctx.rotate(Math.sin(e.tailWag) * 0.5);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, -e.size * 0.18);
  ctx.lineTo(-e.size * 0.85, -e.size * 0.1);
  ctx.lineTo(-e.size * 0.85, e.size * 0.1);
  ctx.lineTo(0, e.size * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.translate(-e.size * 0.85, 0);
  ctx.rotate(Math.sin(e.tailWag - 1.4) * 0.7);
  ctx.beginPath();
  ctx.moveTo(0, -e.size * 0.1);
  ctx.lineTo(-e.size * 0.7, -e.size * 0.45);
  ctx.lineTo(-e.size * 0.5, 0);
  ctx.lineTo(-e.size * 0.7, e.size * 0.45);
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

  // Eyes mark the head end.
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  const eyeX = noseCenterX + headR * 0.3;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.arc(eyeX, side * headR * 0.5, e.size * 0.08, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
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
