import { playConfettiBurst, playGutsExplosion } from "./death-fx.js";
import { createInput, isTouchDevice, setupTouchControls } from "./input.js";
import { resetLiveboard, updateLiveboard } from "./liveboard.js";
import { connect, interpolate } from "./net.js";
import { loadProfile, recordRun, saveProfile } from "./profile.js";
import { getZoom, render, resetZoom, triggerBite } from "./render.js";
import { DASH_DURATION, DASH_PENALTY_DURATION } from "./sim.js";
import { HATS, initStart, showBest, showLeaderboard } from "./start.js";
import { startPuddleBackground } from "./puddle-bg.js";
import { startFishPreview } from "./fish-preview.js";

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const input = createInput(canvas);
const { readHeading, consumeDash, readPointer } = input;
let profile = loadProfile();
let stopPuddleBg = null;
let stopFishPreview = null;

// Set up once, not per-run: the joystick/dash-button DOM is static, only its
// container's [hidden] toggles (in play() below) based on whether this is a
// touch device. isTouchDevice() is checked once here rather than per-frame
// since a device doesn't gain/lose a touchscreen mid-session.
if (isTouchDevice()) {
  setupTouchControls({
    zone: $("joystick-zone"),
    thumb: $("joystick-thumb"),
    dashBtn: $("dash-btn"),
    setTouchHeading: input.setTouchHeading,
    requestDash: input.requestDash,
  });
}

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
  start.refresh(profile);
  if (!stopPuddleBg) stopPuddleBg = startPuddleBackground();
  if (!stopFishPreview) stopFishPreview = startFishPreview("fish-preview", start.getLook);
}

// The server is authoritative: this client's own role is to send input and
// render whatever the latest interpolated snapshot says, not to simulate.
function play({ username, colour, wornHat }) {
  profile = { ...profile, username, colour, wornHat };
  saveProfile(profile);
  $("start").hidden = true;
  $("game").hidden = false;
  $("gameover").hidden = true;
  $("connection-lost").hidden = true;
  stopPuddleBg?.();
  stopPuddleBg = null;
  stopFishPreview?.();
  stopFishPreview = null;
  resize();
  resetZoom();
  resetLiveboard();
  $("touch-controls").hidden = !isTouchDevice();
  // The bar itself is always visible for the whole run (so cooldown stays
  // legible even before a first dash); only the "click or space to dash"
  // hint above it hides once dashHappened flips true, which happens once per
  // run and never resets back.
  $("dash-hint").hidden = false;
  $("dash-fill").style.width = "0%";
  let dashHappened = false;
  const dashCooldown = DASH_DURATION + DASH_PENALTY_DURATION;
  let youId = null;
  let lastYou = null; // most recent known "you" snapshot, for the give-up stats (the server sends no death message for a voluntary quit)
  let elapsed = 0;
  let running = true;

  const net = connect({
    name: profile.username.trim() || "anon",
    colour,
    wornHat,
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

  // Give-up asks the server to end the run (so quest tallies and the
  // leaderboard rank are reported the same way a real death is); the server
  // replies via onDeath above with gaveUp: true, which is what actually ends
  // the run. GIVE_UP_FALLBACK_MS only covers the connection already being
  // dead (no response is coming), in which case the run still ends locally
  // with best-effort stats and no quest unlocks, rather than hanging forever.
  const GIVE_UP_FALLBACK_MS = 1500;
  $("give-up").onclick = () => {
    net.giveUp();
    setTimeout(() => {
      if (!running) return; // onDeath already ended the run
      const stats = lastYou
        ? { score: Math.round(lastYou.score), size: Math.round(lastYou.size), timeSurvivedSeconds: Math.round(elapsed) }
        : {};
      endRun({ ...stats, gaveUp: true, quests: [] });
    }, GIVE_UP_FALLBACK_MS);
  };

  let last = performance.now();
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const [hx, hy] = readHeading();
    const dash = consumeDash();
    if (dash && !dashHappened) {
      dashHappened = true;
      $("dash-hint").hidden = true;
    }
    net.sendInput([hx, hy], dash);

    const sample = net.sample();
    const view = sample && youId != null ? interpolate(sample, youId) : null;
    if (view?.you) {
      lastYou = view.you;
      updateLiveboard({ players: [view.you, ...view.players], bots: view.bots }, youId, dt);
      const { dashTimer, dashPenaltyTimer } = view.you;
      // dashTimer (the burst) and dashPenaltyTimer (the slowdown after) run
      // one after the other, not together: while still bursting, the full
      // penalty is still ahead, so remaining time-to-ready is dashTimer plus
      // the whole penalty duration, not just whichever timer is non-zero.
      const remaining = dashTimer > 0 ? dashTimer + DASH_PENALTY_DURATION : dashPenaltyTimer;
      const ready = remaining <= 0;
      $("dash-fill").style.width = `${ready ? 100 : Math.max(0, (1 - remaining / dashCooldown) * 100)}%`;
      // Pointer from input.js is already screen-relative-to-canvas-centre (see
      // its `move` handler), and render()'s camera keeps `you` pinned at that
      // same screen centre (translate(w/2, h/2), scale(zoom), translate(-you.x,
      // -you.y)) — so world position is you's world position plus that
      // screen-space offset scaled down by the current zoom (a screen pixel
      // covers less world space the more zoomed in the camera is). Reads
      // getZoom() from the *previous* frame's render() call, one frame stale,
      // which is fine since zoom eases smoothly rather than jumping.
      const pointer = readPointer();
      const zoom = getZoom();
      const pointerWorld = pointer ? { x: view.you.x + pointer.x / zoom, y: view.you.y + pointer.y / zoom } : null;
      render(ctx, { bots: view.bots, food: view.food }, view.you, view.players, dt, pointerWorld);
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

async function gameOver({ eatenBy, gaveUp, score = 0, size = 0, timeSurvivedSeconds = 0, quests = [] }) {
  const run = { score, size, timeSurvivedSeconds, quests };
  const prevBestScore = profile.personalBest?.score ?? 0;
  const before = profile.hatsUnlocked;
  profile = recordRun(profile, run);
  const newlyUnlocked = profile.hatsUnlocked.filter((id) => !before.includes(id));
  const isNewBest = run.score > prevBestScore;

  const killerName = eatenBy && (eatenBy.name ?? eatenBy.colour.charAt(0).toUpperCase() + eatenBy.colour.slice(1));
  $("gameover-title").textContent = gaveUp ? "Gave up" : killerName ? `Eaten by ${killerName}` : "Eaten!";
  $("gameover-stats").textContent = `Score ${run.score} · Size ${run.size} · ${run.timeSurvivedSeconds}s`;
  const unlocksEl = $("gameover-unlocks");
  if (newlyUnlocked.length) {
    const labels = newlyUnlocked.map((id) => HATS.find((h) => h.id === id)?.label ?? id);
    unlocksEl.textContent = `New hat${labels.length > 1 ? "s" : ""} unlocked: ${labels.join(", ")}!`;
    unlocksEl.hidden = false;
  } else {
    unlocksEl.hidden = true;
  }
  $("gameover").hidden = false;
  const fxCanvas = $("gameover-fx");
  // Gore on an actual death (not a voluntary give-up — nothing ate you), a
  // confetti burst layered on top whenever the run was "good" (new best
  // score or a freshly unlocked hat) — both can fire together, death-fx.js's
  // shared particle loop handles that.
  if (!gaveUp) playGutsExplosion(fxCanvas);
  if (isNewBest || newlyUnlocked.length) playConfettiBurst(fxCanvas);
  try {
    await showLeaderboard();
  } catch {
    // best-effort refresh; game-over screen still shows fine without it
  }
}

$("again").onclick = showStart;
$("reconnect").onclick = showStart;
const start = initStart(profile, play);
showStart();
