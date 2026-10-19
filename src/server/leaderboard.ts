import { mkdirSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./env.ts";

// Fixed palette: the client start screen offers exactly these, and the server
// rejects anything else, so validation stays trivial.
export const COLOURS = ["coral", "amber", "lime", "teal", "sky", "violet", "pink", "slate"] as const;

export interface Entry {
  name: string;
  score: number;
  colour: string;
  timeSurvivedSeconds: number;
  achievedAt: string;
}

const MAX_ENTRIES = 10;
const MAX_NAME = 16;
const file = join(DATA_DIR, "leaderboard.json");

mkdirSync(DATA_DIR, { recursive: true });

function load(): Entry[] {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

let entries = load();
// Serialises writes so concurrent submissions can't interleave on disk.
let chain: Promise<unknown> = Promise.resolve();

export function top(): Entry[] {
  return entries;
}

export type Parsed = { ok: true; entry: Omit<Entry, "achievedAt"> } | { ok: false; error: string };

export function parseSubmission(body: unknown): Parsed {
  if (typeof body !== "object" || body === null) return { ok: false, error: "body must be an object" };
  const { name, score, colour, timeSurvivedSeconds } = body as Record<string, unknown>;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0) {
    return { ok: false, error: "score must be a non-negative integer" };
  }
  if (typeof colour !== "string" || !(COLOURS as readonly string[]).includes(colour)) {
    return { ok: false, error: "colour must be one of: " + COLOURS.join(", ") };
  }
  if (name !== undefined && typeof name !== "string") return { ok: false, error: "name must be a string" };
  let time = 0;
  if (timeSurvivedSeconds !== undefined) {
    if (typeof timeSurvivedSeconds !== "number" || !Number.isInteger(timeSurvivedSeconds) || timeSurvivedSeconds < 0) {
      return { ok: false, error: "timeSurvivedSeconds must be a non-negative integer" };
    }
    time = timeSurvivedSeconds;
  }
  // eslint-disable-next-line no-control-regex
  const clean = (name ?? "").replace(/[\u0000-\u001f<>&"']/g, "").trim().slice(0, MAX_NAME);
  return { ok: true, entry: { name: clean || "anon", score, colour, timeSurvivedSeconds: time } };
}

export interface SubmitResult {
  entries: Entry[];
  // 0-based index of this submission in the final top-10 list, or null if it
  // didn't place — lets a caller (e.g. a "reached the leaderboard"/"reached
  // #1" quest check) know where this run landed without re-deriving it from
  // `entries` itself (a duplicate score, or the leaderboard changing under a
  // concurrent submission, would make that unreliable).
  rank: number | null;
}

export function submit(entry: Omit<Entry, "achievedAt">): Promise<SubmitResult> {
  const submitted = { ...entry, achievedAt: new Date().toISOString() };
  const next = [...entries, submitted].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
  entries = next;
  const rank = next.indexOf(submitted);
  const write = chain.then(async () => {
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify({ entries: next }, null, 2));
    await rename(tmp, file);
  });
  chain = write.catch(() => {});
  return write.then(() => ({ entries: next, rank: rank === -1 ? null : rank }));
}
