const KEY = "pond-profile";
export const COLOURS = {
  coral: "#ff7f6b", amber: "#ffb347", lime: "#a6e22e", teal: "#2ec4b6",
  sky: "#4cc9f0", violet: "#a78bfa", pink: "#f472b6", slate: "#94a3b8",
};

// VETERAN_RUNS is exported so start.js can show its own unlock tooltip
// without duplicating the number.
export const VETERAN_RUNS = 10;

const blank = () => ({
  username: "", colour: "coral", personalBest: null,
  hatsUnlocked: [], wornHat: null, runsPlayed: 0,
});

export function loadProfile() {
  try {
    return { ...blank(), ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return blank();
  }
}

export function saveProfile(p) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

// Each stat is tracked as its own best; returns the updated profile.
export function recordRun(profile, run) {
  const prev = profile.personalBest ?? { score: 0, size: 0, timeSurvivedSeconds: 0 };
  const personalBest = {
    score: Math.max(prev.score, run.score),
    size: Math.max(prev.size, run.size),
    timeSurvivedSeconds: Math.max(prev.timeSurvivedSeconds, run.timeSurvivedSeconds),
  };
  const runsPlayed = profile.runsPlayed + 1;
  // Union, not replace: `run.quests` is only what this run satisfied, not
  // the player's whole unlock history, and the server re-derives each one
  // from gameplay every run, so this only ever grows, never drops a hat.
  const hatsUnlocked = new Set(profile.hatsUnlocked);
  for (const q of run.quests ?? []) hatsUnlocked.add(q);
  // "veteran" is the one quest with no server corroboration at all — there's
  // no account system to check a lifetime run count against, so it's trusted
  // from this purely client-side counter, same trust level the game already
  // gives a player's chosen colour (cosmetic-only, nothing mechanical reads
  // it). Every other hat in hatsUnlocked came from the server's own tally.
  if (runsPlayed >= VETERAN_RUNS) hatsUnlocked.add("veteran");
  const next = { ...profile, personalBest, runsPlayed, hatsUnlocked: [...hatsUnlocked] };
  saveProfile(next);
  return next;
}
