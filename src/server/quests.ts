// Pure quest-threshold logic: no server, socket or filesystem dependency, so
// it's testable in isolation (spec/quests.test.ts). room.ts accumulates the
// tallies below over the course of a run and calls checkQuests() once at the
// end (death or give-up) — quests are never checked mid-run.

// "crown" is the pre-existing reach-MAX_SIZE unlock, folded in here as one
// quest among ten rather than a special case. "veteran" (play N runs,
// lifetime) is deliberately absent: there's no server-side account system,
// so it can only be a client-side localStorage counter (see profile.js) —
// trusted the same way the game already trusts a player's chosen colour,
// since it's cosmetic-only and nothing mechanical depends on it.
export const QUEST_IDS = [
  "crown",
  "survivalist",
  "glutton",
  "herbivore",
  "dashMaster",
  "playerHunter",
  "giantSlayer",
  "leaderboardEntrant",
  "leaderboardLeader",
] as const;

export type QuestId = (typeof QUEST_IDS)[number];

export const THRESHOLDS = {
  survivalistSeconds: 180, // 3 minutes — well past typical early-death timescales
  gluttonCount: 15, // sustained predation, not an incidental kill or two
  herbivoreCount: 30, // reachable within the ~50-pickup budget before KELP_EAT_SIZE locks out food-eating
  dashMasterCount: 20, // >=56s of dash-reliant play at the ~2.8s cooldown
  giantSlayerWindowSeconds: 20, // how far back "recently" looks
  giantSlayerMultiplier: 2.5, // victim size vs. size this many seconds ago
  giantSlayerMinVictimSize: 50, // floor so a near-join-size kill can't trivially qualify
} as const;

export interface QuestTallies {
  crowned: boolean;
  timeSurvivedSeconds: number;
  entitiesEaten: number;
  foodEaten: number;
  dashCount: number;
  ateAPlayer: boolean;
  ateGiant: boolean;
  leaderboardRank: number | null; // null = not top 10, 0 = #1
}

export function checkQuests(t: QuestTallies): QuestId[] {
  const quests: QuestId[] = [];
  if (t.crowned) quests.push("crown");
  if (t.timeSurvivedSeconds >= THRESHOLDS.survivalistSeconds) quests.push("survivalist");
  if (t.entitiesEaten >= THRESHOLDS.gluttonCount) quests.push("glutton");
  if (t.foodEaten >= THRESHOLDS.herbivoreCount) quests.push("herbivore");
  if (t.dashCount >= THRESHOLDS.dashMasterCount) quests.push("dashMaster");
  if (t.ateAPlayer) quests.push("playerHunter");
  if (t.ateGiant) quests.push("giantSlayer");
  if (t.leaderboardRank !== null) quests.push("leaderboardEntrant");
  if (t.leaderboardRank === 0) quests.push("leaderboardLeader");
  return quests;
}
