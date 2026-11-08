// Standalone particle bursts for the game-over overlay: gore on an eaten
// death, confetti on a good run. No imports — plain canvas 2d, driven by its
// own rAF loop so main.js's game loop doesn't need to know these exist.

const GUTS_COLOURS = ["#c0392b", "#e74c3c", "#ff6b6b", "#ff8aa3", "#8e2a2a", "#d35400"];
const CONFETTI_COLOURS = ["#52f1ff", "#ff4fd8", "#ffb347", "#b6ff3c"];
const GRAVITY = 420; // px/s^2, shared by both effects

let particles = [];
let running = false;
let lastT = null;

function resize(canvas) {
  const dpr = devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tick(canvas, now) {
  const dt = lastT == null ? 0 : Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  particles.forEach((p) => {
    p.age += dt;
    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.spin != null) p.angle += p.spin * dt;
  });
  particles = particles.filter((p) => p.age < p.lifetime);

  for (const p of particles) {
    const t = p.age / p.lifetime;
    const fade = 1 - t;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.angle != null) ctx.rotate(p.angle);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.fillStyle = p.colour;
    if (p.kind === "chunk") {
      const r = p.r * (1 - t * 0.5);
      ctx.beginPath();
      for (let i = 0; i < p.sides.length; i++) {
        const a = (i / p.sides.length) * Math.PI * 2;
        const rr = r * p.sides[i];
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    ctx.restore();
  }

  if (particles.length === 0) {
    running = false;
    lastT = null;
    return;
  }
  requestAnimationFrame((t) => tick(canvas, t));
}

function ensureRunning(canvas) {
  resize(canvas);
  if (running) return;
  running = true;
  lastT = null;
  requestAnimationFrame((t) => tick(canvas, t));
}

export function playGutsExplosion(canvas) {
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight * 0.39;
  const count = 30 + Math.floor(Math.random() * 11);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 220;
    const sideCount = 5 + Math.floor(Math.random() * 3);
    const sides = Array.from({ length: sideCount }, () => 0.7 + Math.random() * 0.5);
    particles.push({
      kind: "chunk",
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      r: 4 + Math.random() * 8,
      sides,
      colour: GUTS_COLOURS[Math.floor(Math.random() * GUTS_COLOURS.length)],
      age: 0,
      lifetime: 1 + Math.random() * 0.3,
    });
  }
  ensureRunning(canvas);
}

export function playConfettiBurst(canvas) {
  const w = canvas.clientWidth;
  const count = 50 + Math.floor(Math.random() * 21);
  for (let i = 0; i < count; i++) {
    particles.push({
      kind: "rect",
      x: Math.random() * w,
      y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 120,
      vy: 40 + Math.random() * 80,
      w: 5 + Math.random() * 4,
      h: 9 + Math.random() * 6,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 8,
      colour: CONFETTI_COLOURS[Math.floor(Math.random() * CONFETTI_COLOURS.length)],
      age: 0,
      lifetime: 1.6 + Math.random() * 0.6,
    });
  }
  ensureRunning(canvas);
}
