import { COLOURS } from "./profile.js";
import { getLeaderboard } from "./leaderboard.js";

export function initStart(profile, onPlay) {
  const form = document.getElementById("start-form");
  const input = document.getElementById("username");
  const picker = document.getElementById("colour-picker");
  let colour = profile.colour;
  input.value = profile.username;

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
    onPlay({ username: input.value.trim(), colour });
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
      li.textContent = `${e.name}: ${e.score}`;
      li.style.color = COLOURS[e.colour] ?? "inherit";
      return li;
    }));
    if (!entries.length) ol.textContent = "No scores yet.";
  } catch {
    ol.textContent = "Leaderboard unavailable.";
  }
}
