# pond.io — PRFAQ

## Press Release

**pond.io launches: a browser-based multiplayer fish game where you grow by eating, and everyone can see your trace**

*Canberra, Australia — October 2026*

Today marks the public launch of pond.io, a free, no-install, browser-based .io-style game: you are a fish, you grow by eating pickups and smaller fish, and bigger fish can eat you. Built solo over three development sprints as part of ANU's COMP4020 Agentic Coding Studio, pond.io runs real-time multiplayer on a single shared-cpu Fly.io machine, costing cents rather than dollars to operate, while supporting a persistent global leaderboard, ten unlockable cosmetic quests, and a cast of fish-pun-named bots that keep the pond lively even when few humans are online.

Most browser .io games ask players to trust a black box: you play, you maybe see a score, and you have no way to tell if your progress meant anything or vanished the moment you closed the tab. pond.io was built around the opposite idea: a stranger should be able to do the core thing (grow a fish, survive, compete) and find their trace still there later, including after the server itself restarts. The personal-best panel on the start screen and the global top-10 leaderboard both persist through redeploys and cold starts, because the question "did this count?" should always have an honest answer.

Under the hood, pond.io is deliberately small: plain Node serving TypeScript natively with no bundler, vanilla JavaScript on the client with no framework, canvas 2D rendering, and a flat JSON file for the leaderboard instead of a database, because the write pattern never justified one. Real-time multiplayer, added in the second sprint, is server-authoritative over WebSockets: the server runs one shared simulation tick at 20Hz for every connected player and bot, broadcasting snapshots that the client interpolates for smooth motion, so no player can teleport, oversize themselves, or see state they shouldn't.

"The breakthrough wasn't really a feature, it was realizing that working and demonstrable are two different bars," said the project's developer, reflecting on the final sprint, which added structured server-side action logging so that who-did-what is provable from the logs alone, not just visible in a browser. "A system that can't explain itself from the outside is harder to trust, not just harder to grade."

Players can start playing immediately at the game's URL: pick a username and a colour from a fixed palette, hit Play, and they're swimming within seconds, no account, no download, no signup. A beta tester who played across the second sprint put it simply: "I came back the next day expecting to start from zero again, and my best run was still sitting there waiting for me to beat it. That's the whole game, honestly."

pond.io is available now, free to play, directly in any modern browser.

---

## Frequently Asked Questions

### Part 1: Customer FAQ (50 questions)

#### Gameplay & Controls

**1. What is pond.io?**
A browser-based .io-style game: you control a fish, grow by eating pickups and smaller fish, and avoid or flee bigger fish that can eat you.

**2. Do I need to install anything?**
No. It runs entirely in a modern browser; there's no app, plugin, or download.

**3. How do I control my fish?**
Point your mouse or finger toward where you want to go (pointer/touch steering), with WASD or arrow keys as a fallback on desktop.

**4. How do I grow?**
Eat food pickups scattered around the pond, or eat other fish (bots or players) that are meaningfully smaller than you.

**5. Can I eat any fish smaller than me?**
Not quite. You need to be at least 10% bigger than the target (a safety margin against same-size collisions) before an eat registers.

**6. What happens if I get eaten?**
Your run ends: the game shows a game-over overlay with your final score, size, and survival time, then returns you to the start screen.

**7. What is the "dash"?**
A short burst of speed on a cooldown, useful for closing a gap on prey or escaping a predator. It has a visible cooldown bar so you know when it's ready again.

**8. Do bigger fish move slower?**
Yes. Size comes with a small speed penalty, so growth is a trade-off, not a strictly dominant strategy.

**9. Is there a food pellet that only prey-sized fish can eat?**
Pickups (kelp-style food) stay eatable up to a certain size; past that, the game expects you to be hunting other fish instead, not farming pellets forever.

**10. What happens when a bot is eaten?**
It respawns after a short delay at minimum size, so the pond doesn't feel emptied out.

#### Progression & Leaderboards

**11. What counts toward my score?**
Score accumulates over a run as a function of your size over time, so it rewards both growing big and staying alive, not just one or the other.

**12. Is my score the same as my size?**
No. Size, survival time, and score are tracked separately and shown separately on your personal-best panel; only score is submitted to the global leaderboard.

**13. Will I lose my progress if I close the tab?**
No. Your personal best (score, size, time survived) is saved locally in your browser and is there the next time you open the start screen.

**14. Will my progress survive if the game server restarts or redeploys?**
Yes, for the global leaderboard. It's written to a storage volume that survives machine restarts and new deploys, which was specifically verified rather than assumed.

**15. Is there a global leaderboard?**
Yes, a top-10 board of best scores, visible on the start screen and updated live during multiplayer play.

**16. Do I need an account to appear on the leaderboard?**
No. You just type a name before you play; there's no signup or login.

**17. Can someone else see my personal best?**
No. Your personal best is private to your browser (stored locally); only your submitted score, name, and colour are shared on the global leaderboard.

**18. What are the "quests"?**
Ten optional in-run achievements (like surviving a set time, eating a set number of fish or pellets, or finishing on the leaderboard) that unlock cosmetic hats for your fish.

**19. Do unlocked hats make my fish stronger?**
No, hats are purely cosmetic. Nothing mechanical depends on which hat you're wearing.

**20. Is there a quest for playing many times?**
Yes, a "veteran" quest tracked locally in your browser, since it counts lifetime play across runs rather than anything within a single run.

#### Multiplayer

**21. Is pond.io multiplayer?**
Yes. Real-time multiplayer was added after the single-player launch; you play in a shared world alongside other connected players and bots.

**22. What happens if there's no one else online?**
Bot fish fill out the world so it never feels empty, even solo.

**23. Can bots and players interact the same way?**
Yes, with one exception: only players, not bots, count toward certain quest tallies (like "player hunter"), to keep that quest meaningful.

**24. Do bots have names?**
Yes, randomly assigned fish-pun names (think "Gill-bert" or "Cod Almighty") so the pond doesn't read as a row of plain colour swatches.

**25. What happens if my connection drops mid-game?**
You'll see a distinct "connection lost" state rather than the game silently treating it as a death.

**26. If I reconnect, do I resume where I left off?**
No, currently a dropped connection starts a fresh join rather than resuming your in-progress fish.

**27. Can another player cheat by teleporting or instantly growing?**
No. Clients only ever send a direction and a dash flag; the server computes all position, growth, and eating itself.

**28. Why does movement sometimes feel slightly behind real time?**
The game intentionally renders a touch behind the live server state and smooths between updates, which trades a small, steady delay for motion that doesn't stutter.

**29. How many players can be in one pond at once?**
Everyone currently plays in one shared world; there's no matchmaking or separate rooms yet.

**30. Can I play against friends specifically?**
Not as a private match today. Everyone who's playing shares the same pond.

#### Account & Privacy

**31. Do I need to give an email address or password?**
No. There's no account system at all.

**32. What personal information does pond.io collect?**
Just the display name and colour you type before playing, which is shown publicly alongside your leaderboard score if you submit one.

**33. Is my chosen name moderated?**
Names are trimmed and length-capped; there's no profanity filtering today, so treat the leaderboard as a public, unmoderated space.

**34. Can I pick any colour for my fish?**
You choose from a fixed set of preset colours rather than a free-form colour picker.

**35. Can I delete my leaderboard entry?**
Not self-service today; there's no account to authenticate a delete request against.

**36. Does pond.io use cookies or trackers?**
Your personal best is stored via your browser's local storage, which is specific to your device and browser, not a tracking cookie shared across sites.

**37. Is my gameplay session recorded anywhere I can see?**
The server logs structured events (join, death, eat) for operational purposes; there's no per-player dashboard of your session history beyond your local personal-best panel.

**38. Can I play without appearing on the public leaderboard?**
The leaderboard submission happens automatically at the end of a run today; there's no opt-out toggle currently.

**39. Is pond.io free?**
Yes, free to play with no in-app purchases, ads, or paid tiers.

**40. Who built pond.io?**
A single developer, working with an AI coding agent, as part of a university course project.

#### Platform & Access

**41. What devices does pond.io work on?**
Any device with a modern browser; it supports both pointer/touch steering and keyboard controls.

**42. Does it work on mobile?**
Yes, touch input is supported for steering.

**43. Do I need a powerful computer to play?**
No, it's a lightweight 2D canvas game with modest client requirements.

**44. Does pond.io work offline?**
No, it needs a live connection for multiplayer sync and leaderboard access.

**45. Why might the game take a moment to load the first time I visit?**
The server can go to sleep when nobody's playing to save on hosting cost, and wakes up on the next visit, which can add a brief cold-start delay.

**46. Is there a readme or rules page in-app?**
Yes, a `/readme/` page on the site documents what the game is and what's deliberately out of scope for now.

**47. Can I see the game's source code?**
It's hosted as a course project repository; availability depends on whether the repository is public at the time you're asking.

**48. Is there a way to report a bug?**
There's no in-game report flow today; issues would go through the project's code repository.

**49. Will pond.io add more features over time?**
It's an actively developed course project with a clear roadmap of deferred features (see the business FAQ for specifics).

**50. Is pond.io going to charge money in the future?**
There's no monetization plan; it's a non-commercial course project.

### Part 2: Business / Internal FAQ (50 questions)

#### Product & Scope

**1. What problem is pond.io actually solving?**
It's the vehicle for demonstrating, in one shippable artifact, that an agent-assisted solo developer can take a product from zero to a persistent, real-time multiplayer app across three assessed milestones, each with a visible, testable "bar."

**2. Who is the customer?**
Primarily the course's graders and crit audience at each milestone, secondarily anyone who plays the public build; the product has to satisfy both a stranger playing it cold and an evaluator checking specific claims against the running app.

**3. What was explicitly out of scope at first launch (crit 8)?**
Real-time multiplayer, which the brief explicitly permitted deferring; bots stood in for other players so the single-player core could ship first.

**4. What defines "done" for each milestone?**
A written, dated definition in `README.md` of what "good" means that week, checkable live against the deployed app, not just against local dev.

**5. How is scope decided week to week?**
Via a written plan (`plan.md`, `planLive.md`) committed before implementation, covering stack choice, file-by-file changes, and an explicit non-goals list, so scope creep has to be argued for in writing.

**6. What's the single most important non-negotiable requirement across all milestones?**
That a stranger's trace (their score, their personal best) survives a real restart or redeploy, not just an in-memory session; this was independently re-verified at each milestone, not assumed to still hold.

**7. Why ship a single shared "pond" instead of matchmaking into separate rooms?**
The hosting footprint is one process on one machine; one shared room is free architecturally, while matchmaking would add complexity with no current capacity problem to justify it.

**8. What's the stated reason bots have names and personalities (fish puns) rather than being anonymous?**
Pure polish decided after the functional bar was met, specifically to stop the pond from reading as "a row of colour swatches" when real player density is low.

**9. Why ten quests instead of a simpler single win condition?**
To reward multiple playstyles (survival, predation, foraging, dash usage, leaderboard rank) rather than collapsing the game into one dominant strategy, and to give returning players goals beyond chasing a single top score.

**10. Why are quest-unlocked hats purely cosmetic with no re-verification by the server?**
Because nothing mechanical depends on them, the same trust level already extended to a player's self-reported colour choice; re-verifying would add validation complexity for zero gameplay stakes.

#### Architecture & Engineering

**11. Why no framework or bundler on the client?**
The client is a handful of small JS modules; a build pipeline would be disproportionate tooling for that footprint, and skipping it keeps the whole stack understandable in one sitting.

**12. Why does the server run TypeScript natively instead of compiling it?**
The Node version in use runs `.ts` directly without a build step, as long as non-erasable syntax (enums, parameter properties) is avoided, which removes a whole build stage for zero functional cost.

**13. Why is the leaderboard a flat JSON file instead of a real database?**
Writes are small, infrequent, and single-process; a database engine would be overhead with no current payoff. The explicit fallback plan, if concurrent writes or richer queries ever mattered, is SQLite on the same volume, not a separate DB service.

**14. How are concurrent writes to that JSON file kept safe?**
An in-process promise chain serializes writes, and each write is atomic (write to a temp file, then rename), so a killed process mid-write can't corrupt the leaderboard.

**15. Why WebSockets and not a simpler polling approach for multiplayer?**
Polling can't deliver the latency a real-time .io game needs; WebSockets were the first and only new runtime dependency added, specifically because hand-rolling the protocol's framing and masking is the kind of subtle-bug surface not worth owning.

**16. Why is the server authoritative over the whole simulation rather than trusting client state?**
Because the hosting setup is a single process with no horizontal scaling, one authority is free architecturally; it also closes off an entire class of client-side cheating (position/size spoofing) by construction.

**17. What tick rate does the simulation run at, and why that number?**
20Hz, chosen as the floor for the game to feel responsive without taxing a 256MB shared-CPU machine; it's an explicit candidate for revisiting if entity count or AI cost grows.

**18. How is "stuttery" multiplayer movement avoided given a 20Hz tick but 60Hz+ screens?**
The client renders a short delay behind the latest snapshot and interpolates positions between the two bracketing snapshots, trading a small fixed latency for smoothness.

**19. Why was the core simulation written as pure functions over a plain state object from day one?**
It was an explicit hedge, made during the single-player milestone, against rework once multiplayer needed the same logic server-side; that bet paid off directly when crit 9 reused those functions almost unchanged.

**20. What changed about `createState` when multiplayer was added?**
It split so a room can start with just bots and food, then let players join and leave the shared collection dynamically, instead of rebuilding the whole world per run.

#### Cost & Infrastructure

**21. What does pond.io cost to run?**
A single shared-cpu-1x Fly.io machine with 256MB memory and a 1GB volume, configured to auto-stop when idle and auto-start on the next request, keeping cost in the range of cents rather than dollars.

**22. Why allow the machine to sleep when idle instead of running 24/7?**
It's most of why the app is cheap to run; the trade-off, accepted deliberately, is an occasional cold-start delay on the first request after idle.

**23. Is there a database service in the hosting setup?**
No. The hosting constraints explicitly call out that there's no separate database server available in the course-managed setup; storage is the one mounted volume.

**24. What happens to data if the volume is lost or the app is redeployed badly?**
The leaderboard and action log live only on that one volume; this was treated as the single biggest operational risk and was specifically re-verified to survive redeploys and restarts, since a bad deploy is the one thing that could quietly wipe it.

**25. Could this scale to many more concurrent players?**
Not without rework: the architecture assumes one process, one room, no horizontal scaling. More load would require revisiting the tick rate, the single-room model, and likely the JSON-file leaderboard.

**26. Why no containerized multi-service setup (separate app + DB containers)?**
The whole app is a single Docker image with no install step, matching the zero-added-runtime-dependency goal for most of the build; splitting services would add operational surface with no current justification.

**27. Does local development match the deployed environment?**
Yes, verification explicitly includes running the same checks against a local Docker build before and after deploying, specifically to catch drift between dev and the Fly environment.

**28. What's the deployment trigger?**
Manual `flyctl deploy` while the repository is private; once the repository is flipped public, the same deploy command runs automatically via CI on every push to the main branch.

**29. What's the single biggest infrastructure constraint shaping these decisions?**
256MB of memory on a shared CPU with no second service available; every storage and concurrency decision (flat file over DB, single-process authority) traces back to fitting inside that envelope.

**30. If traffic spiked unexpectedly, what would break first?**
Most likely the single-room, single-tick-loop model and the JSON leaderboard's write path; neither was built with concurrent scale in mind, by design, given current usage.

#### Risk, Security & Observability

**31. What stops a malicious client from cheating in multiplayer?**
Inbound messages are restricted to a direction and a dash flag; the server never accepts position or size from a client, so there's no message a client can send to directly mutate either.

**32. What stops a player from manipulating another player's fish?**
Each connection maps to exactly one player entity server-side, and every inbound action is applied only to that connection's own entity; there's no message type that takes another player's ID as a mutation target.

**33. What data can one player see about another?**
Only what's already broadcast to everyone: position, size, name, colour, and cosmetic hat. Nothing private exists per player beyond their own live connection.

**34. How is the leaderboard submission endpoint protected from bad input?**
Name is trimmed, sanitized, and length-capped; score must be a finite non-negative integer; colour must match a fixed server-side whitelist. Anything else is rejected with a 400 and the leaderboard is left unchanged.

**35. Is there a cap on request size to prevent abuse?**
Yes, the leaderboard POST body is capped at 4KB server-side and rejected if exceeded.

**36. How does static file serving avoid path traversal attacks?**
Static serving is guarded explicitly against path traversal, serving only files under the intended public/docs directories by extension.

**37. How is "who did what" made provable after the fact, not just visible live?**
A dedicated action log writes structured JSON lines to stdout (tailed live via the hosting platform's log stream) and appends the same line to a file on the persistent volume, so both live and after-the-fact review are possible.

**38. Why log at join/disconnect/death/player-eats-player but not every food pellet eaten?**
Food-pellet events happen at the simulation's full tick rate and would flood the log stream without adding anything narratable; the chosen events are the ones a human reviewing the log would actually care about.

**39. How are concurrent log writes kept from interleaving into garbled lines?**
The action log follows the same serialized-write pattern already used for the leaderboard file, so concurrent events can't corrupt a line mid-write.

**40. What's the biggest unmitigated risk in the current build?**
No reconnection-with-state-preservation: a dropped socket is treated as a fresh join rather than a resumable session, which is an accepted gap given the time budget, not an oversight.

#### Process, Course Context & Roadmap

**41. What's the overall delivery model?**
A solo developer working in a plan-then-execute loop with an AI coding agent: write a plan document, implement against it, deploy, play-test the live result, then return with a punch list for the next pass.

**42. How is the agent's behavior constrained project to project?**
Via a project-level rules file that the developer authors themselves (left intentionally empty by default), covering things like which files the agent must not touch and which architectural choices (native TypeScript, dependency-free client) must hold.

**43. Are there any files the agent is barred from editing without explicit permission?**
Yes, the process-history file and anything in the reflections folder are explicitly protected from unsupervised edits, since they're meant to be the developer's own account, not agent-generated.

**44. How often are changes committed and reviewed?**
Frequently, at points where a change is independently reviewable, with pushes to the shared server reserved for larger milestones or explicit requests, rather than every local change triggering a deploy.

**45. What's the testing strategy?**
A layered spec suite covering live-HTTP invariants, leaderboard round-tripping and validation rejection, the served game shell, multiplayer join/leave behavior across two real WebSocket clients, and quest-threshold logic in isolation.

**46. What's explicitly deferred to a future milestone, and why those items specifically?**
Matchmaking/multiple rooms (no current need beyond one shared world), lag compensation and client-side prediction beyond render-side interpolation (inputs are applied strictly on the tick they arrive), and reconnection-with-state-preservation (a dropped socket is a fresh join). Each was a deliberate cut, not a miss.

**47. What would trigger moving off the flat-file leaderboard to SQLite?**
Concurrent writes becoming contentious or query needs becoming richer than "top 10 by score"; this threshold was written down explicitly as the trigger condition, on the same volume, rather than left implicit.

**48. How does the course's weekly "crit" milestone cadence shape the architecture?**
Each milestone has its own plan document and its own explicit non-goals list, so each week's scope is independently arguable and independently testable, rather than one large undifferentiated build.

**49. What's the stated personal/process lesson that came out of this build?**
That "working" and "demonstrable" are different bars: a system that can't explain its own behavior from the outside (via logs, here) is harder to trust and harder to debug, not just harder to grade, a lesson that drove the final milestone's logging work.

**50. What would "success" look like beyond the course deadline?**
A stranger with no context can play a full run, find their trace intact later, play alongside real other people, and understand roughly what happened from the server's own logs, without needing to read the source to trust any of those claims.

---

*PRFAQ prepared for pond.io, a COMP4020 Agentic Coding Studio final project (ANU), repository `comp4020-agentic-coding-studio/comp4020-final-quackyduck826`.*
