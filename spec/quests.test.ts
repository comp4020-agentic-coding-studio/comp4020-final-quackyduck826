import { expect, it } from "vitest";
import { checkQuests, THRESHOLDS, type QuestTallies } from "../src/server/quests.ts";

// Pure logic, no running app needed — unlike every other spec file, this
// doesn't use `inject("baseUrl")`.

const base: QuestTallies = {
  crowned: false,
  timeSurvivedSeconds: 0,
  entitiesEaten: 0,
  foodEaten: 0,
  dashCount: 0,
  ateAPlayer: false,
  ateGiant: false,
  leaderboardRank: null,
};

it("unlocks nothing when every tally is at its baseline", () => {
  expect(checkQuests(base)).toEqual([]);
});

it("crown unlocks exactly when crowned is true", () => {
  expect(checkQuests({ ...base, crowned: true })).toContain("crown");
});

it("survivalist unlocks at the time threshold, not one second under it", () => {
  expect(checkQuests({ ...base, timeSurvivedSeconds: THRESHOLDS.survivalistSeconds - 1 })).not.toContain("survivalist");
  expect(checkQuests({ ...base, timeSurvivedSeconds: THRESHOLDS.survivalistSeconds })).toContain("survivalist");
});

it("glutton unlocks at the kill-count threshold, not one under it", () => {
  expect(checkQuests({ ...base, entitiesEaten: THRESHOLDS.gluttonCount - 1 })).not.toContain("glutton");
  expect(checkQuests({ ...base, entitiesEaten: THRESHOLDS.gluttonCount })).toContain("glutton");
});

it("herbivore unlocks at the food-count threshold, not one under it", () => {
  expect(checkQuests({ ...base, foodEaten: THRESHOLDS.herbivoreCount - 1 })).not.toContain("herbivore");
  expect(checkQuests({ ...base, foodEaten: THRESHOLDS.herbivoreCount })).toContain("herbivore");
});

it("dashMaster unlocks at the dash-count threshold, not one under it", () => {
  expect(checkQuests({ ...base, dashCount: THRESHOLDS.dashMasterCount - 1 })).not.toContain("dashMaster");
  expect(checkQuests({ ...base, dashCount: THRESHOLDS.dashMasterCount })).toContain("dashMaster");
});

it("playerHunter is binary: any true unlocks it, regardless of count", () => {
  expect(checkQuests({ ...base, ateAPlayer: true })).toContain("playerHunter");
});

it("giantSlayer unlocks exactly when ateGiant is true", () => {
  expect(checkQuests({ ...base, ateGiant: true })).toContain("giantSlayer");
});

it("leaderboard quests key off rank: null unlocks neither, 0 unlocks both, 5 unlocks only entrant", () => {
  expect(checkQuests({ ...base, leaderboardRank: null })).not.toContain("leaderboardEntrant");
  expect(checkQuests({ ...base, leaderboardRank: null })).not.toContain("leaderboardLeader");

  const top = checkQuests({ ...base, leaderboardRank: 0 });
  expect(top).toContain("leaderboardEntrant");
  expect(top).toContain("leaderboardLeader");

  const placed = checkQuests({ ...base, leaderboardRank: 5 });
  expect(placed).toContain("leaderboardEntrant");
  expect(placed).not.toContain("leaderboardLeader");
});

it("stacks every satisfied quest in one call", () => {
  const quests = checkQuests({
    crowned: true,
    timeSurvivedSeconds: THRESHOLDS.survivalistSeconds,
    entitiesEaten: THRESHOLDS.gluttonCount,
    foodEaten: THRESHOLDS.herbivoreCount,
    dashCount: THRESHOLDS.dashMasterCount,
    ateAPlayer: true,
    ateGiant: true,
    leaderboardRank: 0,
  });
  expect(new Set(quests)).toEqual(new Set([
    "crown", "survivalist", "glutton", "herbivore", "dashMaster",
    "playerHunter", "giantSlayer", "leaderboardEntrant", "leaderboardLeader",
  ]));
});
