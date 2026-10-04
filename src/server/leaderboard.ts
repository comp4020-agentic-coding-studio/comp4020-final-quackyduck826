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
  const { name, score, colour } = body as Record<string, unknown>;
  if (typeof score !== "number" || !Number.isInteger(score) || score < 0) {
    return { ok: false, error: "score must be a non-negative integer" };
  }
  if (typeof colour !== "string" || !(COLOURS as readonly string[]).includes(colour)) {
    return { ok: false, error: "colour must be one of: " + COLOURS.join(", ") };
  }
  if (name !== undefined && typeof name !== "string") return { ok: false, error: "name must be a string" };
  // eslint-disable-next-line no-control-regex
  const clean = (name ?? "").replace(/[\u0000-\u001f<>&"']/g, "").trim().slice(0, MAX_NAME);
  return { ok: true, entry: { name: clean || "anon", score, colour } };
}

export function submit(entry: Omit<Entry, "achievedAt">): Promise<Entry[]> {
  const next = [...entries, { ...entry, achievedAt: new Date().toISOString() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ENTRIES);
  entries = next;
  const write = chain.then(async () => {
    const tmp = file + ".tmp";
    await writeFile(tmp, JSON.stringify({ entries: next }, null, 2));
    await rename(tmp, file);
  });
  chain = write.catch(() => {});
  return write.then(() => next);
}
