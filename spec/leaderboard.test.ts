import { expect, inject, it } from "vitest";

const baseUrl = inject("baseUrl");
const url = new URL("/api/leaderboard", baseUrl);

const post = (body: unknown) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = async () => ((await (await fetch(url)).json()) as { entries: { name: string; score: number }[] }).entries;

it("round-trips a submitted score", async () => {
  const score = 9_000_000 + Math.floor(Math.random() * 1000);
  const res = await post({ name: "specfish", score, colour: "teal" });
  expect(res.status).toBe(200);
  expect((await get()).some((e) => e.name === "specfish" && e.score === score)).toBe(true);
});

it("orders entries by score, highest first", async () => {
  await post({ name: "low", score: 8_000_001, colour: "sky" });
  await post({ name: "high", score: 8_000_002, colour: "sky" });
  const scores = (await get()).map((e) => e.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
});

it("rejects malformed submissions and leaves the board unchanged", async () => {
  const before = await get();
  for (const bad of [
    {},
    { name: "x", colour: "teal" },
    { name: "x", score: "lots", colour: "teal" },
    { name: "x", score: -1, colour: "teal" },
    { name: "x", score: 1e9, colour: "#ff0000" },
  ]) {
    expect((await post(bad)).status).toBe(400);
  }
  expect(await get()).toEqual(before);
});
