import { COLOURS, VETERAN_RUNS } from "./profile.js";
import { getLeaderboard } from "./leaderboard.js";

// Mirrors src/server/HAT_IDS (that one's TypeScript, loaded server-side only,
// so the ids are duplicated here rather than shared across the client/server
// boundary) plus the label and unlock description shown in the menu. Exported
// so main.js's gameover notification can turn a newly-unlocked id into the
// same label the menu shows, without a third copy of this list.
export const HATS = [
  { id: "crown", label: "Crown", unlock: "Reach max size in a single run" },
  { id: "survivalist", label: "Survivalist Hat", unlock: "Survive 3 minutes in a single run" },
  { id: "glutton", label: "Chef's Hat", unlock: "Eat 15 fish in a single run" },
  { id: "herbivore", label: "Leaf Crown", unlock: "Eat 30 food pickups in a single run" },
  { id: "dashMaster", label: "Dash Cap", unlock: "Dash 20 times in a single run" },
  { id: "playerHunter", label: "Tricorn", unlock: "Eat another real player" },
  { id: "giantSlayer", label: "Viking Helmet", unlock: "Eat something much bigger than you were recently" },
  { id: "veteran", label: "Fedora", unlock: `Play ${VETERAN_RUNS} runs` },
  { id: "leaderboardEntrant", label: "Medal", unlock: "Place in the top 10 leaderboard" },
  { id: "leaderboardLeader", label: "Trophy", unlock: "Reach #1 on the leaderboard" },
];

// Rebuilds the hats menu from scratch each time (simpler than diffing tiles)
// and returns the selected hat id, read fresh from live DOM state rather than
// a value captured at setup — the profile.hatsUnlocked snapshot it's built
// from can go stale mid-session (a run can unlock a new hat), matching how
// refreshCrownToggle used to re-sync the old single crown toggle.
function renderHatsMenu(menu, profile) {
  menu.querySelectorAll(".hat-tile").forEach((t) => t.remove());
  let selected = profile.hatsUnlocked.includes(profile.wornHat) ? profile.wornHat : null;

  const makeTile = (id, label, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hat-tile";
    b.textContent = label;
    b.title = title;
    const unlocked = id === null || profile.hatsUnlocked.includes(id);
    b.disabled = !unlocked;
    b.setAttribute("aria-pressed", String(id === selected));
    if (unlocked) {
      b.onclick = () => {
        selected = id;
        menu.querySelectorAll(".hat-tile").forEach((t) => t.setAttribute("aria-pressed", String(t === b)));
      };
    }
    menu.append(b);
  };

  makeTile(null, "None", "No hat");
  for (const h of HATS) makeTile(h.id, h.label, profile.hatsUnlocked.includes(h.id) ? h.label : h.unlock);

  return () => selected;
}

export function initStart(profile, onPlay) {
  const form = document.getElementById("start-form");
  const input = document.getElementById("username");
  const picker = document.getElementById("colour-picker");
  const hatsMenu = document.getElementById("hats-menu");
  let colour = profile.colour;
  input.value = profile.username;
  // Re-rendered fresh each time the start screen shows (see showStart in
  // main.js), since profile is reassigned, not mutated, after each run —
  // a run that just unlocked a hat needs the menu to reflect that.
  let getSelectedHat = renderHatsMenu(hatsMenu, profile);

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
    onPlay({ username: input.value.trim(), colour, wornHat: getSelectedHat() });
  };

  return {
    refresh(nextProfile) {
      profile = nextProfile;
      getSelectedHat = renderHatsMenu(hatsMenu, profile);
    },
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
