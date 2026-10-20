// The one shared game world: owns the tick loop, applies player input, and
// broadcasts snapshots. Reuses the client's pure sim/bots modules (plain JS,
// no DOM/fetch) verbatim — the server is just a new caller of the same
// `step`/`resolveEating`/`updateBots` functions the single-player client used
// to drive itself, now ticking once for everyone instead of once per browser.
import type { WebSocket } from "ws";
import { logAction } from "./actionLog.ts";
import { updateBots } from "../../public/game/bots.js";
import { COLOURS as COLOUR_NAMES, submit } from "./leaderboard.ts";
import { checkQuests, HAT_IDS, THRESHOLDS, type HatId, type QuestTallies } from "./quests.ts";
import {
  addPlayer,
  createWorld,
  eatingLocked,
  MAX_SIZE,
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
  crowned: boolean;
  // Which hat this player chose to wear this run, whitelisted against the
  // known hat ids the same way colour is whitelisted; null = none worn.
  // Rendered from the start of the run, not gated on re-earning it within
  // the run — a deliberate simplification over the crown's old behaviour,
  // since wearing a hat is purely cosmetic (see publicPlayer()).
  wornHat: HatId | null;
  // Quest tallies, accumulated over the run and read once at the end
  // (death or give-up) by checkQuests() — see quests.ts.
  entitiesEaten: number;
  foodEaten: number;
  dashCount: number;
  ateAPlayer: boolean;
  ateGiant: boolean;
  // Rolling history of recent sizes, oldest first, used only for the Giant
  // Slayer check: "bigger than you were GIANT_SLAYER_WINDOW_SECONDS ago".
  // Sampled once a second (sinceSizeSample accumulates dt between samples),
  // not every tick — a full tick-rate history would be wasteful.
  sizeHistory: number[];
  sinceSizeSample: number;
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
  victimSize: number;
  by: { id: number; name: string; colour: string };
}
interface FoodEvent {
  type: "food";
  by: number;
}
interface World {
  players: Player[];
  bots: Entity[];
  food: Food[];
  events: (EatenEvent | FoodEvent)[];
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
      const { name, colour, wornHat } = msg as Record<string, unknown>;
      const safeColour = typeof colour === "string" && (BOT_COLOURS as string[]).includes(colour) ? colour : BOT_COLOURS[0];
      const player = addPlayer(world, safeColour) as unknown as Player;
      player.name = (typeof name === "string" ? name.trim() : "").slice(0, 16) || "anon";
      // `crowned` (did this player ever reach MAX_SIZE) is re-derived from
      // gameplay each run in tick(), never trusted from the client. `wornHat`
      // is purely a display preference the client sends based on its own
      // localStorage record of past unlocks — nothing mechanical depends on it.
      player.crowned = false;
      player.wornHat = typeof wornHat === "string" && (HAT_IDS as readonly string[]).includes(wornHat) ? (wornHat as HatId) : null;
      player.entitiesEaten = 0;
      player.foodEaten = 0;
      player.dashCount = 0;
      player.ateAPlayer = false;
      player.ateGiant = false;
      player.sizeHistory = [player.size];
      player.sinceSizeSample = 0;
      conn.player = player;
      logAction({ type: "join", player: player.id, name: player.name, colour: player.colour });
      send(socket, { type: "joined", id: player.id });
      return;
    }

    if (type === "giveUp" && conn.player) {
      finishRun(conn, conn.player, { eatenBy: null, gaveUp: true }).catch(() => {});
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
    // If conn.player is already null, a death or give-up already ran
    // finishRun() for this connection (it nulls conn.player synchronously,
    // before its first await) — nothing left to do here.
    if (conn.player) {
      logAction({ type: "disconnect", player: conn.player.id, name: conn.player.name });
      submitScoreOnly(conn.player);
      removePlayer(world, conn.player);
    }
  };
  socket.on("close", cleanup);
  socket.on("error", cleanup);
}

// The server holds the only trustworthy score (maxSize), so it submits to the
// persistent leaderboard itself once a run ends, rather than asking the
// client to report back a number it could have tampered with.
function finalStats(p: Player) {
  return { score: Math.round(p.maxSize), timeSurvivedSeconds: Math.round(world.elapsed - p.joinedAt) };
}

// Plain disconnect (network drop, tab closed) with no give-up or death
// message in flight: there's no live socket to report quest results to, so
// this just submits the score — same as before quests existed. Used only by
// cleanup(); death() and give-up both go through finishRun() below instead,
// which also nulls conn.player, so by the time cleanup() runs after either of
// those conn.player is already null and this is skipped (see its own guard).
function submitScoreOnly(p: Player): void {
  const { score, timeSurvivedSeconds } = finalStats(p);
  submit({ name: p.name, score, colour: p.colour, timeSurvivedSeconds }).catch(() => {});
}

// The one place a run actually ends with something to tell the client:
// a real death (eatenBy set) or a voluntary give-up (gaveUp: true). Nulls
// conn.player synchronously, before the first await, so a socket-close
// racing in behind this (the client closes its own socket right after
// getting the death message) can't also submit via cleanup()'s guard.
async function finishRun(conn: Connection, p: Player, { eatenBy, gaveUp }: { eatenBy: { name: string; colour: string } | null; gaveUp: boolean }): Promise<void> {
  conn.player = null;
  // A death-triggered call finds `p` already absent from world.players
  // (resolveEating() removes it the same tick the "eaten" event fires), so
  // this is a no-op there; for give-up, `p` is still very much in the world,
  // and removing it doesn't need to wait on the leaderboard submission below.
  removePlayer(world, p);
  logAction({
    type: gaveUp ? "giveUp" : "death",
    player: p.id,
    name: p.name,
    eatenBy: eatenBy ? { name: eatenBy.name, colour: eatenBy.colour } : null,
    finalSize: Math.round(p.maxSize),
    timeSurvivedSeconds: Math.round(world.elapsed - p.joinedAt),
  });
  const { score, timeSurvivedSeconds } = finalStats(p);
  const { rank } = await submit({ name: p.name, score, colour: p.colour, timeSurvivedSeconds });
  const tallies: QuestTallies = {
    crowned: p.crowned,
    timeSurvivedSeconds,
    entitiesEaten: p.entitiesEaten,
    foodEaten: p.foodEaten,
    dashCount: p.dashCount,
    ateAPlayer: p.ateAPlayer,
    ateGiant: p.ateGiant,
    leaderboardRank: rank,
  };
  send(conn.socket, { type: "death", eatenBy, gaveUp, score, size: score, timeSurvivedSeconds, quests: checkQuests(tallies) });
}

function tick(): void {
  const dt = TICK_MS / 1000;
  for (const conn of connections.values()) {
    if (!conn.player) continue;
    steer(conn.player, conn.heading[0], conn.heading[1]);
    if (conn.dash) {
      // Only a dash that actually started counts toward the quest tally —
      // a press during cooldown is a no-op in sim.js and shouldn't inflate it.
      if (triggerDash(conn.player)) conn.player.dashCount++;
      conn.dash = false;
    }
  }
  updateBots(world, TICK_MS / 1000);
  step(world, TICK_MS / 1000);
  resolveEating(world);

  const byId = new Map(world.players.map((p) => [p.id, p]));
  for (const e of world.events) {
    if (e.type === "food") {
      const eater = byId.get(e.by);
      if (eater) eater.foodEaten++;
    } else {
      const attacker = byId.get(e.by.id);
      if (!attacker) continue;
      attacker.entitiesEaten++;
      if (e.victimIsPlayer) {
        attacker.ateAPlayer = true;
        // Only player-eats-player is logged here; food/bot eats would flood
        // the stream at tick rate and aren't what the crit narration needs.
        logAction({
          type: "eat",
          player: attacker.id,
          name: attacker.name,
          victim: e.victim,
          victimSize: Math.round(e.victimSize),
          newSize: Math.round(attacker.size),
        });
      }
      // Giant Slayer: victim is substantial on its own (the floor), and at
      // least GIANT_SLAYER_MULTIPLIER times the attacker's own size from
      // GIANT_SLAYER_WINDOW_SECONDS ago (sizeHistory[0], the oldest sample
      // still in the window) — see quests.ts for the full reasoning.
      const referenceSize = attacker.sizeHistory[0] ?? attacker.size;
      if (e.victimSize >= referenceSize * THRESHOLDS.giantSlayerMultiplier && e.victimSize >= THRESHOLDS.giantSlayerMinVictimSize) {
        attacker.ateGiant = true;
      }
    }
  }

  for (const p of world.players) {
    // Sticky: once true, stays true for the rest of the run even if the player
    // later shrinks back down (SHRINK_RATE applies above SHRINK_SIZE).
    if (p.size >= MAX_SIZE) p.crowned = true;

    p.sinceSizeSample += dt;
    if (p.sinceSizeSample >= 1) {
      p.sinceSizeSample = 0;
      p.sizeHistory.push(p.size);
      const maxSamples = THRESHOLDS.giantSlayerWindowSeconds;
      if (p.sizeHistory.length > maxSamples) p.sizeHistory.shift();
    }
  }
  broadcast();
}

function publicPlayer(p: Player) {
  return {
    id: p.id, x: p.x, y: p.y, angle: p.angle, tailWag: p.tailWag, size: p.size,
    colour: p.colour, name: p.name, score: p.score, locked: eatingLocked(p),
    dashTimer: p.dashTimer, dashPenaltyTimer: p.dashPenaltyTimer, isPlayer: true,
    // Echoed from the start of the run, not gated on re-earning it within
    // the run (see the wornHat field comment above) — every connected
    // client renders whatever hat this player chose, visible to everyone,
    // not just the wearer.
    hat: p.wornHat,
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
    if (died && conn.player && died.type === "eaten") {
      finishRun(conn, conn.player, { eatenBy: died.by, gaveUp: false }).catch(() => {});
    }
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startRoom(): void {
  if (timer) return;
  timer = setInterval(tick, TICK_MS);
}
