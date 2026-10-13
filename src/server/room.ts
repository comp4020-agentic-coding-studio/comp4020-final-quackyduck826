// The one shared game world: owns the tick loop, applies player input, and
// broadcasts snapshots. Reuses the client's pure sim/bots modules (plain JS,
// no DOM/fetch) verbatim — the server is just a new caller of the same
// `step`/`resolveEating`/`updateBots` functions the single-player client used
// to drive itself, now ticking once for everyone instead of once per browser.
import type { WebSocket } from "ws";
import { updateBots } from "../../public/game/bots.js";
import { COLOURS as COLOUR_NAMES, submit } from "./leaderboard.ts";
import {
  addPlayer,
  createWorld,
  eatingLocked,
  removePlayer,
  resolveEating,
  step,
  steer,
  triggerDash,
  WORLD,
} from "../../public/game/sim.js";

const TICK_HZ = 20;
const TICK_MS = 1000 / TICK_HZ;
const BOT_COLOURS = [...COLOUR_NAMES];

// sim.js/bots.js are plain, untyped JS by design (see plan.md), so TS can't
// infer the shape entities grow into via assignment after `makeEntity`
// returns (e.g. `player.score = 0`). These interfaces describe just the
// fields this file reads/writes, cast at the JS/TS boundary below, rather
// than trying to coax richer inference out of the shared JS modules.
interface Entity {
  id: number;
  x: number;
  y: number;
  angle: number;
  tailWag: number;
  size: number;
  colour: string;
  name: string;
  dashTimer: number;
  dashPenaltyTimer: number;
  big?: boolean;
}
interface Player extends Entity {
  score: number;
  maxSize: number;
  joinedAt: number;
}
interface Food {
  id: number;
  x: number;
  y: number;
  size: number;
  colour: string;
}
interface EatenEvent {
  type: "eaten";
  x: number;
  y: number;
  victim: number;
  victimIsPlayer: boolean;
  by: { name: string; colour: string };
}
interface World {
  players: Player[];
  bots: Entity[];
  food: Food[];
  events: EatenEvent[];
  elapsed: number;
}

interface Connection {
  socket: WebSocket;
  player: Player | null;
  heading: [number, number];
  dash: boolean;
}

const world = createWorld(BOT_COLOURS) as unknown as World;
const connections = new Map<WebSocket, Connection>();

function send(socket: WebSocket, msg: unknown): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg));
}

export function handleConnection(socket: WebSocket): void {
  const conn: Connection = { socket, player: null, heading: [0, 0], dash: false };
  connections.set(socket, conn);
  send(socket, { type: "welcome", world: WORLD, palette: BOT_COLOURS });

  socket.on("message", (raw) => {
    let msg: unknown;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (typeof msg !== "object" || msg === null) return;
    const { type } = msg as Record<string, unknown>;

    if (type === "join" && !conn.player) {
      const { name, colour } = msg as Record<string, unknown>;
      const safeColour = typeof colour === "string" && (BOT_COLOURS as string[]).includes(colour) ? colour : BOT_COLOURS[0];
      const player = addPlayer(world, safeColour) as unknown as Player;
      player.name = (typeof name === "string" ? name.trim() : "").slice(0, 16) || "anon";
      conn.player = player;
      send(socket, { type: "joined", id: player.id });
      return;
    }

    if (type === "input" && conn.player) {
      const { heading, dash } = msg as Record<string, unknown>;
      if (
        Array.isArray(heading) && heading.length === 2 &&
        typeof heading[0] === "number" && Number.isFinite(heading[0]) &&
        typeof heading[1] === "number" && Number.isFinite(heading[1])
      ) {
        const len = Math.hypot(heading[0], heading[1]) || 1;
        // Clamp to a unit vector server-side: input only ever carries a
        // heading, never a position or speed, so a client can't move faster
        // than steer()/speedFor() allow regardless of what it sends.
        conn.heading = len > 1 ? [heading[0] / len, heading[1] / len] : [heading[0], heading[1]];
      }
      if (dash === true) conn.dash = true;
    }
  });

  const cleanup = (): void => {
    connections.delete(socket);
    if (conn.player) {
      submitRun(conn.player);
      removePlayer(world, conn.player);
    }
  };
  socket.on("close", cleanup);
  socket.on("error", cleanup);
}

// The server holds the only trustworthy score (maxSize), so it submits to the
// persistent leaderboard itself once a run ends, rather than asking the
// client to report back a number it could have tampered with. Returns the
// final stats so the caller can also tell the client (for its local
// personal-best panel), without computing them twice.
function finalStats(p: Player) {
  return { score: Math.round(p.maxSize), timeSurvivedSeconds: Math.round(world.elapsed - p.joinedAt) };
}

function submitRun(p: Player): void {
  const { score, timeSurvivedSeconds } = finalStats(p);
  submit({ name: p.name, score, colour: p.colour, timeSurvivedSeconds }).catch(() => {});
}

function tick(): void {
  for (const conn of connections.values()) {
    if (!conn.player) continue;
    steer(conn.player, conn.heading[0], conn.heading[1]);
    if (conn.dash) {
      triggerDash(conn.player);
      conn.dash = false;
    }
  }
  updateBots(world, TICK_MS / 1000);
  step(world, TICK_MS / 1000);
  resolveEating(world);
  broadcast();
}

function publicPlayer(p: Player) {
  return {
    id: p.id, x: p.x, y: p.y, angle: p.angle, tailWag: p.tailWag, size: p.size,
    colour: p.colour, name: p.name, score: p.score, locked: eatingLocked(p),
    dashTimer: p.dashTimer, dashPenaltyTimer: p.dashPenaltyTimer, isPlayer: true,
  };
}

function broadcast(): void {
  const players = world.players.map(publicPlayer);
  const bots = world.bots.map((b) => ({
    id: b.id, x: b.x, y: b.y, angle: b.angle, tailWag: b.tailWag, size: b.size, colour: b.colour, name: b.name,
  }));
  const food = world.food.map((f) => ({ id: f.id, x: f.x, y: f.y, size: f.size, colour: f.colour }));
  const events = world.events;
  world.events = [];

  for (const conn of connections.values()) {
    if (conn.socket.readyState !== conn.socket.OPEN) continue;
    // resolveEating() already dropped an eaten player from world.players, but
    // conn.player still references that (now-stale) entity, so `you` still
    // reflects its final position/size for this one last snapshot.
    const you = conn.player ? publicPlayer(conn.player) : null;
    send(conn.socket, { type: "snapshot", t: world.elapsed, you, players, bots, food, events });

    const died = conn.player && events.find((e) => e.type === "eaten" && e.victim === conn.player!.id);
    if (died && conn.player) {
      const { score, timeSurvivedSeconds } = finalStats(conn.player);
      submitRun(conn.player);
      send(conn.socket, { type: "death", eatenBy: died.by, score, size: score, timeSurvivedSeconds });
      conn.player = null;
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startRoom(): void {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
}
