// Narratable per-player events for the crit 10 "tell people apart in the
// logs" requirement. Every call prints one JSON line to stdout — what
// `flyctl logs` tails live during the crit — and appends the same line to
// a file on the Fly volume, so the trail survives past the crit the same
// way leaderboard.ts's JSON survives redeploys.
import { appendFile, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./env.ts";

const file = join(DATA_DIR, "actions.log");
mkdirSync(DATA_DIR, { recursive: true });

// Serialises appends the same way leaderboard.ts serialises writes, so
// concurrent events (two players acting the same tick) can't interleave
// mid-line on disk.
let chain: Promise<unknown> = Promise.resolve();

export function logAction(event: Record<string, unknown>): void {
  const line = JSON.stringify({ t: new Date().toISOString(), ...event });
  console.log(line);
  chain = chain.then(
    () => new Promise<void>((resolve) => appendFile(file, line + "\n", () => resolve())),
  );
}
