// WebSocket client: owns the connection, sends input once per animation
// frame, and buffers incoming snapshots so the renderer can interpolate
// between two known server states instead of snapping to whichever snapshot
// arrived most recently.
const RENDER_DELAY = 0.1; // seconds behind the latest snapshot; absorbs jitter between 20Hz ticks

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

export function connect({ name, colour, onWelcome, onJoined, onDeath, onClose, onEvents }) {
  const socket = new WebSocket(wsUrl());
  const buffer = []; // ordered snapshots, each {t, you, players, bots, food, events}
  let world = 2000;
  let palette = [];

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "join", name, colour }));
  });

  socket.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "welcome") {
      world = msg.world;
      palette = msg.palette;
      onWelcome?.({ world, palette });
    } else if (msg.type === "joined") {
      onJoined?.(msg.id);
    } else if (msg.type === "snapshot") {
      buffer.push(msg);
      // Keep a little more than the render delay needs so interpolation
      // always has two snapshots to bracket; older ones are just discarded.
      while (buffer.length > 30) buffer.shift();
      // Fired once per snapshot arrival (not per render frame, which samples
      // the same snapshot repeatedly while waiting for the next one), so a
      // one-off event like a bite effect plays exactly once.
      if (msg.events?.length) onEvents?.(msg.events);
    } else if (msg.type === "death") {
      onDeath?.({ eatenBy: msg.eatenBy, score: msg.score, size: msg.size, timeSurvivedSeconds: msg.timeSurvivedSeconds });
    }
  });

  socket.addEventListener("close", () => onClose?.());

  let lastHeading = [0, 0];
  function sendInput(heading, dash) {
    lastHeading = heading;
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "input", heading, dash }));
  }

  // Returns an interpolated view of the world at "now minus RENDER_DELAY", or
  // null if there isn't enough snapshot history yet (e.g. just connected).
  function sample() {
    if (buffer.length === 0) return null;
    const renderTime = buffer[buffer.length - 1].t - RENDER_DELAY;
    let older = buffer[0];
    let newer = buffer[buffer.length - 1];
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i].t <= renderTime && buffer[i + 1].t >= renderTime) {
        older = buffer[i];
        newer = buffer[i + 1];
        break;
      }
    }
    const span = newer.t - older.t || 1;
    const frac = Math.max(0, Math.min(1, (renderTime - older.t) / span));
    return { older, newer, frac, latest: buffer[buffer.length - 1] };
  }

  return { sendInput, sample, close: () => socket.close(), get lastHeading() { return lastHeading; } };
}

const lerp = (a, b, t) => a + (b - a) * t;

function lerpAngle(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// Interpolates one entity between its state in `older` and `newer` lists
// (matched by id); falls back to whichever one has it if only one does, so an
// entity that just spawned or just died doesn't vanish/pop for a frame.
function interpolateList(olderList, newerList, frac) {
  const byId = new Map(olderList.map((e) => [e.id, e]));
  return newerList.map((n) => {
    const o = byId.get(n.id);
    if (!o) return n;
    return {
      ...n,
      x: lerp(o.x, n.x, frac),
      y: lerp(o.y, n.y, frac),
      angle: lerpAngle(o.angle, n.angle, frac),
      tailWag: lerp(o.tailWag, n.tailWag, frac),
      size: lerp(o.size, n.size, frac),
    };
  });
}

// Builds the renderable { you, players, bots, food } for the current sample,
// `you` excluded from `players` (the caller draws it separately, outlined).
export function interpolate(sample, youId) {
  if (!sample) return null;
  const { older, newer, frac } = sample;
  const you = newer.you ? interpolateList([older.you ?? newer.you], [newer.you], frac)[0] : null;
  const players = interpolateList(older.players, newer.players, frac).filter((p) => p.id !== youId);
  const bots = interpolateList(older.bots, newer.bots, frac);
  const food = newer.food;
  return { you, players, bots, food };
}
