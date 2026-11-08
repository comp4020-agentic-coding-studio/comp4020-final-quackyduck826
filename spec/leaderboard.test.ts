import { expect, inject, it } from "vitest";

const baseUrl = inject("baseUrl");
const url = new URL("/api/leaderboard", baseUrl);

const post = (body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = async () =>
  ((await (await fetch(url)).json()) as { entries: { name: string; score: number; timeSurvivedSeconds: number }[] }).entries;

it("round-trips a submitted score and its time survived", async () => {
  const score = 9_000_000 + Math.floor(Math.random() * 1000);
  const res = await post({ name: "specfish", score, colour: "teal", timeSurvivedSeconds: 42 });
  expect(res.status).toBe(200);
  expect((await get()).some((e) => e.name === "specfish" && e.score === score && e.timeSurvivedSeconds === 42)).toBe(true);
});

it("orders entries by score, highest first", async () => {
  await post({ name: "low", score: 8_000_001, colour: "sky", timeSurvivedSeconds: 10 });
  await post({ name: "high", score: 8_000_002, colour: "sky", timeSurvivedSeconds: 20 });
  const scores = (await get()).map((e) => e.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});

it("rejects malformed submissions and never adds them to the board", async () => {
  for (const bad of [
    {},
    { name: "x", colour: "teal" },
    { name: "x", score: "lots", colour: "teal" },
    { name: "x", score: -1, colour: "teal" },
    { name: "x", score: 1e9, colour: "#ff0000" },
  ]) {
    expect((await post(bad)).status).toBe(400);
  }
  // Asserting the whole board is byte-for-byte unchanged would flake on this
  // shared live leaderboard: other tests' players can disconnect and submit
  // a real score (room.ts's cleanup() does this without awaiting it) at any
  // point during this test's run. What this test actually owns is that none
  // of ITS malformed submissions landed, not that nothing else in the world
  // moved — so it checks for the absence of entries matching the bad payloads'
  // own name, rather than for an unchanged board overall.
  expect((await get()).some((e) => e.name === "x")).toBe(false);
});
