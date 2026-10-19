import { COLOURS } from "./profile.js";
import { getLeaderboard } from "./leaderboard.js";

// Reflects the profile's crown state onto the toggle. Called once at setup
// and again each time the start screen is shown, since `crownUnlocked` can
// flip true mid-session (a run just now reached MAX_SIZE) after the form was
// already built.
export function refreshCrownToggle(profile) {
  document.getElementById("crown-toggle").hidden = !profile.crownUnlocked;
  document.getElementById("wear-crown").checked = profile.wantsCrown;
}

export function initStart(profile, onPlay) {
  const form = document.getElementById("start-form");
  const input = document.getElementById("username");
  const picker = document.getElementById("colour-picker");
  const crownToggle = document.getElementById("crown-toggle");
  const crownCheckbox = document.getElementById("wear-crown");
  let colour = profile.colour;
  input.value = profile.username;
  refreshCrownToggle(profile);

  for (const name of Object.keys(COLOURS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.title = name;
    b.setAttribute("aria-label", name);
    b.style.background = COLOURS[name];
    b.setAttribute("aria-pressed", String(name === colour));
    b.onclick = () => {
      colour = name;
      picker.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-pressed", String(s === b)));
    };
    picker.append(b);
  }
  form.onsubmit = (e) => {
    e.preventDefault();
    // Read live DOM state (kept current by refreshCrownToggle on every
    // showStart) rather than the `profile` this closure captured at setup —
    // that object gets replaced, not mutated, after each run, so checking its
    // `crownUnlocked` here would stay stuck at whatever it was at page load.
    onPlay({ username: input.value.trim(), colour, wearCrown: !crownToggle.hidden && crownCheckbox.checked });
  };
}

export function showBest(profile) {
  const el = document.getElementById("personal-best");
  const b = profile.personalBest;
  el.textContent = b
    ? `Score ${Math.round(b.score)} · Size ${Math.round(b.size)} · Time ${Math.round(b.timeSurvivedSeconds)}s`
    : "No runs yet. Play to set your first best.";
}

export async function showLeaderboard() {
  const ol = document.getElementById("leaderboard");
  try {
    const entries = await getLeaderboard();
    ol.replaceChildren(...entries.map((e) => {
      const li = document.createElement("li");
      li.textContent = `${e.name}: ${e.score} · ${e.timeSurvivedSeconds ?? 0}s`;
      li.style.color = COLOURS[e.colour] ?? "inherit";
      return li;
    }));
    if (!entries.length) ol.textContent = "No scores yet.";
  } catch {
    ol.textContent = "Leaderboard unavailable.";
  }
}
