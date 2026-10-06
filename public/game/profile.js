const KEY = "pond-profile";
export const COLOURS = {
  coral: "#ff7f6b", amber: "#ffb347", lime: "#a6e22e", teal: "#2ec4b6",
  sky: "#4cc9f0", violet: "#a78bfa", pink: "#f472b6", slate: "#94a3b8",
};

const blank = () => ({ username: "", colour: "coral", personalBest: null });

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
  const next = { ...profile, personalBest };
  saveProfile(next);
  return next;
}
