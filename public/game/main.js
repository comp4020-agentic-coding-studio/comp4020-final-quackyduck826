import { createInput } from "./input.js";
import { updateBots } from "./bots.js";
import { submitScore } from "./leaderboard.js";
import { COLOURS, loadProfile, recordRun, saveProfile } from "./profile.js";
import { render } from "./render.js";
import { createState, eatingLocked, resolveEating, step, steer } from "./sim.js";
import { initStart, showBest, showLeaderboard } from "./start.js";

const $ = (id) => document.getElementById(id);
const canvas = $("canvas");
const ctx = canvas.getContext("2d");
const readHeading = createInput(canvas);
let profile = loadProfile();

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener("resize", resize);

function showStart() {
  $("game").hidden = true;
  $("start").hidden = false;
  showBest(profile);
  showLeaderboard();
}

function play({ username, colour }) {
  profile = { ...profile, username, colour };
  saveProfile(profile);
  $("start").hidden = true;
  $("game").hidden = false;
  $("gameover").hidden = true;
  resize();
  const state = createState(colour, Object.keys(COLOURS));
  $("give-up").onclick = () => {
    state.alive = false;
    state.gaveUp = true;
  };
  let last = performance.now();

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const [hx, hy] = readHeading();
    steer(state.player, hx, hy);
    updateBots(state, dt);
    step(state, dt);
    resolveEating(state);
    render(ctx, state);
    $("hud").textContent = `Score ${Math.round(state.score)}  ${Math.round(state.elapsed)}s${eatingLocked(state) ? "  (eating locked: only players can be eaten)" : ""}`;
    if (state.alive) return requestAnimationFrame(frame);
    gameOver(state);
  };
  requestAnimationFrame(frame);
}

async function gameOver(state) {
  const run = { score: Math.round(state.score), size: Math.round(state.maxSize), timeSurvivedSeconds: Math.round(state.elapsed) };
  profile = recordRun(profile, run);
  $("gameover-title").textContent = state.gaveUp ? "Gave up" : "Eaten!";
  $("gameover-stats").textContent = `Score ${run.score} · Size ${run.size} · ${run.timeSurvivedSeconds}s`;
  $("gameover").hidden = false;
  try {
    await submitScore({ name: profile.username, score: run.score, colour: profile.colour, timeSurvivedSeconds: run.timeSurvivedSeconds });
  } catch {
    // leaderboard is best-effort; the personal best is already saved locally
  }
}

$("again").onclick = showStart;
initStart(profile, play);
showStart();
