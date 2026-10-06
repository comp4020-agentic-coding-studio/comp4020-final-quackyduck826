// Live in-game leaderboard: top 5 entities (player + bots) by current size.
// Separate from the persistent server-backed leaderboard on the start screen.
const $ = (id) => document.getElementById(id);

const UPDATE_INTERVAL = 0.25; // seconds between DOM re-renders
let sinceUpdate = 0;

function displayName(entity) {
  if (entity.isPlayer) return entity.name || "You";
  return entity.name ?? entity.colour.charAt(0).toUpperCase() + entity.colour.slice(1);
}

// Call when a new game starts so stale rows from the previous run don't
// linger and the throttle timer doesn't carry over.
export function resetLiveboard() {
  sinceUpdate = 0;
  const el = $("liveboard");
  if (el) el.textContent = "";
}

// Called every frame; only actually touches the DOM a few times a second.
export function updateLiveboard(state, dt) {
  sinceUpdate += dt;
  if (sinceUpdate < UPDATE_INTERVAL) return;
  sinceUpdate = 0;
  const el = $("liveboard");
  if (!el) return;
  const top = [state.player, ...state.bots].sort((a, b) => b.size - a.size).slice(0, 5);
  el.innerHTML = "";
  for (const e of top) {
    const li = document.createElement("li");
    li.textContent = `${displayName(e)} · ${Math.round(e.size)}`;
    if (e.isPlayer) li.classList.add("me");
    el.appendChild(li);
  }
}
