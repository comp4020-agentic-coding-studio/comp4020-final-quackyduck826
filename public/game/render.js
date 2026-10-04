import { COLOURS } from "./profile.js";
import { WORLD } from "./sim.js";

export function render(ctx, state) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  const p = state.player;
  ctx.save();
  ctx.translate(w / 2 - p.x, h / 2 - p.y);
  ctx.strokeStyle = "#3b7a8f";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, WORLD, WORLD);
  const dot = (e, outline) => {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
    ctx.fillStyle = COLOURS[e.colour] ?? "#fff";
    ctx.fill();
    if (outline) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };
  state.food.forEach((f) => dot(f));
  state.bots.forEach((b) => dot(b));
  dot(p, true);
  ctx.restore();
}
