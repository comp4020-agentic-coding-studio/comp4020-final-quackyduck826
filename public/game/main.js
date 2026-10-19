import { createInput } from "./input.js";
import { resetLiveboard, updateLiveboard } from "./liveboard.js";
import { connect, interpolate } from "./net.js";
import { loadProfile, recordRun, saveProfile } from "./profile.js";
import { render, triggerBite } from "./render.js";
import { DASH_DURATION, DASH_PENALTY_DURATION } from "./sim.js";
import { initStart, refreshCrownToggle, showBest, showLeaderboard } from "./start.js";
import { startPuddleBackground } from "./puddle-bg.js";

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const { readHeading, consumeDash } = createInput(canvas);
let profile = loadProfile();
let stopPuddleBg = null;

// Backing store sized at device pixel density (not just CSS pixels), then
// scaled back down via the context transform: without this, a canvas stretched
// to fill a high-DPI screen (e.g. retina, most phones) is rendered at half
// resolution or less and upscaled, which is what made text and fine strokes
// look soft/fuzzy rather than cleanly anti-aliased.
function resize() {
  const dpr = devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener("resize", resize);

function showStart() {
  $("game").hidden = true;
  $("connection-lost").hidden = true;
  $("start").hidden = false;
  showBest(profile);
  showLeaderboard();
  refreshCrownToggle(profile);
  if (!stopPuddleBg) stopPuddleBg = startPuddleBackground();
}

// The server is authoritative: this client's own role is to send input and
// render whatever the latest interpolated snapshot says, not to simulate.
function play({ username, colour, wearCrown }) {
  // Only remember the toggle's own state once it's actually unlocked and
  // shown; before that, `wearCrown` is always false (the toggle is hidden and
  // start.js never sends it true) and shouldn't stomp the pre-unlock default.
  const wantsCrown = profile.crownUnlocked ? !!wearCrown : profile.wantsCrown;
  profile = { ...profile, username, colour, wantsCrown };
  saveProfile(profile);
  $("start").hidden = true;
  $("game").hidden = false;
  $("gameover").hidden = true;
  $("connection-lost").hidden = true;
  stopPuddleBg?.();
  stopPuddleBg = null;
  resize();
  resetLiveboard();
  $("dash-bar").hidden = true;
  $("dash-hint").hidden = true;
  let dashBarShown = false;
  const dashCooldown = DASH_DURATION + DASH_PENALTY_DURATION;
  let youId = null;
  let lastYou = null; // most recent known "you" snapshot, for the give-up stats (the server sends no death message for a voluntary quit)
  let elapsed = 0;
  let running = true;

  const net = connect({
    name: profile.username.trim() || "anon",
    colour,
    wearCrown,
    onJoined: (id) => { youId = id; },
    onDeath: (stats) => endRun(stats),
    // Only an *unexpected* close (the socket dropping on its own, not after a
    // death message or a give-up) counts as a connection loss; `running`
    // is already false by the time either of those closes the socket.
    onClose: () => { if (running) connectionLost(); },
    onEvents: (events) => {
      for (const ev of events) {
        if (ev.type === "eaten") triggerBite(ev.x, ev.y, ev.by.colour);
      }
    },
  });

  $("give-up").onclick = () => {
    const stats = lastYou
      ? { score: Math.round(lastYou.score), size: Math.round(lastYou.size), timeSurvivedSeconds: Math.round(elapsed), crowned: lastYou.crowned }
      : {};
    endRun({ ...stats, gaveUp: true });
  };

  let last = performance.now();
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const [hx, hy] = readHeading();
    const dash = consumeDash();
    if (dash && !dashBarShown) {
      dashBarShown = true;
      $("dash-bar").hidden = false;
    }
    net.sendInput([hx, hy], dash);

    const sample = net.sample();
    const view = sample && youId != null ? interpolate(sample, youId) : null;
    if (view?.you) {
      lastYou = view.you;
      updateLiveboard({ players: [view.you, ...view.players], bots: view.bots }, youId, dt);
      if (dashBarShown) {
        const { dashTimer, dashPenaltyTimer } = view.you;
        // dashTimer (the burst) and dashPenaltyTimer (the slowdown after) run
        // one after the other, not together: while still bursting, the full
        // penalty is still ahead, so remaining time-to-ready is dashTimer plus
        // the whole penalty duration, not just whichever timer is non-zero.
        const remaining = dashTimer > 0 ? dashTimer + DASH_PENALTY_DURATION : dashPenaltyTimer;
        const ready = remaining <= 0;
        $("dash-fill").style.width = `${ready ? 100 : Math.max(0, (1 - remaining / dashCooldown) * 100)}%`;
        $("dash-hint").hidden = !ready;
      }
      render(ctx, { bots: view.bots, food: view.food }, view.you, view.players, dt);
      $("hud").textContent = `Score ${Math.round(view.you.score)}  ${Math.round(elapsed)}s${view.you.locked ? "  (eating locked: only players can be eaten)" : ""}`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  function endRun(stats) {
    if (!running) return;
    running = false;
    net.close();
    gameOver(stats);
  }

  function connectionLost() {
    if (!running) return;
    running = false;
    $("game").hidden = true;
    $("connection-lost").hidden = false;
  }
}

async function gameOver({ eatenBy, gaveUp, score = 0, size = 0, timeSurvivedSeconds = 0, crowned = false }) {
  const run = { score, size, timeSurvivedSeconds, crowned };
  profile = recordRun(profile, run);
  const killerName = eatenBy && (eatenBy.name ?? eatenBy.colour.charAt(0).toUpperCase() + eatenBy.colour.slice(1));
  $("gameover-title").textContent = gaveUp ? "Gave up" : killerName ? `Eaten by ${killerName}` : "Eaten!";
  $("gameover-stats").textContent = `Score ${run.score} · Size ${run.size} · ${run.timeSurvivedSeconds}s`;
  $("gameover").hidden = false;
  try {
    await showLeaderboard();
  } catch {
    // best-effort refresh; game-over screen still shows fine without it
  }
}

$("again").onclick = showStart;
$("reconnect").onclick = showStart;
initStart(profile, play);
showStart();
