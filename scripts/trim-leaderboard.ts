#!/usr/bin/env node
// One-time migration: drop the top N leaderboard entries (highest score
// first, the order the file is already stored in). Entries scored under the
// old time-integrated formula are no longer achievable under the current
// one (score = peak size reached), so this clears the stale top of the
// board once rather than leaving it to confuse new scores.
// Usage: node scripts/trim-leaderboard.ts <path-to-leaderboard.json> <count>
import { readFileSync, writeFileSync } from "node:fs";
import type { Entry } from "../src/server/leaderboard.ts";

const [, , path, countArg] = process.argv;
const count = Number(countArg);
if (!path || !Number.isInteger(count) || count < 0) {
  console.error("usage: node scripts/trim-leaderboard.ts <path-to-leaderboard.json> <count>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(path, "utf8")) as { entries: Entry[] };
const before = data.entries.length;
data.entries = data.entries.slice(count);
writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
console.log(`trimmed top ${count}: ${before} -> ${data.entries.length} entries`);
