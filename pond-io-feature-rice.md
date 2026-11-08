# pond.io — New Feature Ideas, RICE-Scored

Reviewed against the current build (`sim.js`, `render.js`, `puddle-bg.js`, `start.js`,
quests/hats, leaderboard, action log) so nothing below duplicates existing
mechanics (dash, shrink-above-threshold, eat-lock, 10 quests/hats, persistent
leaderboard, rock shoreline background).

## RICE methodology

- **Reach** = 1–10 (relative share of sessions/players who'd encounter or use
  it, not an absolute DAU figure since this is a course project, not a live
  product with analytics).
- **Impact** = 0.25 / 0.5 / 1 / 1.5 / 2 / 3 (minimal → massive, standard RICE
  scale).
- **Confidence** = 0.5 / 0.8 / 1.0.
- **Effort** = person-weeks of solo-dev-with-agent effort.
- **Score** = (Reach × Impact × Confidence) ÷ Effort.

## Ranked list

| # | Feature | Category | Reach | Impact | Conf. | Effort | Score | Why |
|---|---|---|---|---|---|---|---|---|
| 1 | Bite/eat particle burst (bubbles, chomp flash) | Art | 9 | 1.5 | 0.8 | 0.5 | **21.6** | Fires on every eat for every player; cheap canvas particles, no new state |
| 2 | Spawn grace period (brief invuln. on join/respawn) | Mechanics | 8 | 1.5 | 0.8 | 0.5 | **19.2** | Kills the "insta-eaten by a big bot on join" first-impression problem |
| 3 | Interactive first-time tutorial overlay | User Ed. | 10 | 2 | 0.8 | 1 | **16.0** | Every new player hits this once; controls aren't explained anywhere today |
| 4 | Death "poof" / scale-based confetti | Art | 9 | 1 | 0.8 | 0.5 | **14.4** | Every death gets a visual payoff instead of just vanishing |
| 5 | Contextual first-encounter tooltips ("bigger fish can eat you") | User Ed. | 9 | 1.5 | 0.8 | 0.75 | **14.4** | Teaches core danger rule in-context instead of via README |
| 6 | Post-game score breakdown screen | User Ed. | 9 | 1 | 0.8 | 0.5 | **14.4** | "Why was my score X" is currently opaque (size-over-time formula) |
| 7 | Minimap | UI | 9 | 2 | 0.8 | 1.5 | **9.6** | Big usability win in a 2000×2000 world with no spatial awareness tool |
| 8 | Live quest-progress HUD (bars toward next unlock) | UI | 8 | 1.5 | 0.8 | 1 | **9.6** | Quests exist but are invisible until the run ends |
| 9 | Anti-spawn-camping cooldown | Mechanics | 6 | 1 | 0.8 | 0.5 | **9.6** | Cheap guard against a known griefing pattern once multiplayer scales |
| 10 | Emote/ping action (non-text) | Actions | 7 | 1 | 0.8 | 0.75 | **7.47** | Light social layer without chat-moderation risk |
| 11 | Animated water caustics/lighting | Art | 9 | 1 | 0.8 | 1 | **7.2** | Seen by everyone every session; matches existing canvas art style |
| 12 | Mobile on-screen controls overlay (joystick + dash button) | UI | 6 | 2 | 0.8 | 1.5 | **6.4** | Touch input exists but has no visible affordance on mobile |
| 13 | Spectator mode after death | UI | 7 | 1 | 0.8 | 1 | **5.6** | Fills the dead-time between death and returning to start |
| 14 | Treasure chest rare spawn | Elements | 7 | 1 | 0.8 | 1 | **5.6** | Small, low-risk variety add reusing existing food-spawn logic |
| 15 | Settings panel (colourblind mode, volume, control scheme) | UI | 6 | 1 | 0.8 | 1 | **4.8** | Accessibility gap; currently zero settings exist |
| 16 | Power-up pickups (speed/invincibility/magnet) | Elements | 8 | 2 | 0.5 | 2 | **4.0** | High upside but balancing against eat-lock/dash needs playtesting |
| 17 | Daily challenge / rotating modifier | Mechanics | 7 | 1.5 | 0.5 | 1.5 | **3.5** | Retention lever, but value unproven without real DAU data |
| 18 | Idle/AFK shrink-out | Mechanics | 4 | 0.5 | 0.8 | 0.5 | **3.2** | Minor fairness fix, easy to build, low reach |
| 19 | Strategic shrink/fling (deliberate size-for-speed trade) | Actions | 6 | 1.5 | 0.5 | 1.5 | **3.0** | Adds depth but risks muddying the simple "bigger wins" rule |
| 20 | Practice/sandbox mode (offline, bots only, no stakes) | User Ed. | 6 | 1.5 | 0.5 | 1.5 | **3.0** | Good for nervous new players; competes with tutorial overlay |
| 21 | Day/night visual cycle | Art | 8 | 1 | 0.5 | 1.5 | **2.67** | Nice ambiance, uncertain whether players notice/care |
| 22 | Animated bot fish schools (coordinated small-fish groups) | Art | 8 | 1 | 0.5 | 1.5 | **2.67** | Visual life, but AI coordination is new, untested logic |
| 23 | Fish skin/pattern customization (stripes, spots) | Art | 7 | 1.5 | 0.5 | 2 | **2.63** | Personalization upside, but needs a UI + asset system from scratch |
| 24 | Jellyfish hazard zones | Elements | 7 | 1.5 | 0.5 | 2 | **2.63** | New danger type, needs careful balance against existing bot threats |
| 25 | Predator NPC shark (unkillable roaming hazard) | Elements | 7 | 1.5 | 0.5 | 2 | **2.63** | Fun tension add but risks feeling unfair without telegraphing |
| 26 | First-session guided "safe" bot (won't flee/attack) | User Ed. | 5 | 1 | 0.5 | 1 | **2.5** | Niche onboarding aid, smaller reach than tutorial/tooltips |
| 27 | Vote-rematch button | Actions | 3 | 0.5 | 0.8 | 0.5 | **2.4** | Low value in a persistent shared-world model (no "match" to restart) |
| 28 | Coral/kelp obstacle terrain | Elements | 8 | 1.5 | 0.5 | 2.5 | **2.4** | Adds hiding/strategy but needs collision + pathing rework for bots |
| 29 | Ram/stun attack (distinct from eating) | Actions | 6 | 1.5 | 0.5 | 2 | **2.25** | Interesting but adds a second combat verb to balance against eating |
| 30 | Expanded `/readme/` with embedded GIFs | User Ed. | 4 | 0.5 | 0.8 | 0.75 | **2.13** | Few players read the README; in-game education scores higher |
| 31 | Kill-cam / death replay | UI | 8 | 1 | 0.5 | 2 | **2.0** | Needs state-buffer recording; confidence low on implementation cost |
| 32 | Chat/emote text wheel | UI | 7 | 1 | 0.5 | 2 | **1.75** | Moderation/abuse surface for an unmoderated public leaderboard already |
| 33 | Team/clan mode | Mechanics | 6 | 2 | 0.5 | 3.5 | **1.71** | High potential impact but a large rework of the single-room eat model |
| 34 | Private lobby creation (friends-only room) | Actions | 5 | 2 | 0.5 | 3 | **1.67** | Breaks the "one shared pond, one process" architecture assumption |
| 35 | Current/tide zones (push entities) | Elements | 6 | 1 | 0.5 | 2 | **1.5** | Adds movement complexity without a clear strategic payoff |
| 36 | Temporary alliance mechanic (no-eat pact) | Actions | 5 | 1 | 0.5 | 2 | **1.25** | Cute idea, but hard to make legible/fair in a free-for-all game |
| 37 | Weather events (storm/visibility drop) | Elements | 5 | 1 | 0.5 | 2 | **1.25** | Could frustrate more than delight; unclear if it reads as "content" |
| 38 | Seasonal cosmetic re-skins | Art | 5 | 0.5 | 0.5 | 1.5 | **0.83** | Needs an ongoing content calendar this solo project can't sustain |
| 39 | Share replay/clip export | Actions | 4 | 1 | 0.5 | 3 | **0.67** | Video capture/export is a large build for a niche use case |
| 40 | Skill-based matchmaking / room split | Mechanics | 4 | 1 | 0.5 | 3 | **0.67** | No population data to split by, and only one room exists today |

## Headline takeaway

The top of the list is dominated by cheap, broadly-seen polish and onboarding
(particle effects, spawn grace, tutorial, tooltips, score breakdown) rather
than big new systems: RICE is penalizing the high-effort/uncertain-confidence
ideas (team mode, private lobbies, matchmaking, clip export) even though some
of those could matter more long-term.

---

*Prepared for pond.io, a COMP4020 Agentic Coding Studio final project (ANU),
repository `comp4020-agentic-coding-studio/comp4020-final-quackyduck826`.*
