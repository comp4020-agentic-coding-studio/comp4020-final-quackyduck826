# pond.io

pond.io is an .io-style game: you are a fish, you grow by eating pickups and smaller fish, and bigger fish eat you. Increase your score along with your size to get onto the global leaderboard, and collect achievements along the way that award you hats your fish can wear.

## What "good" means this week

A playable game that is challenging but doable even against a room full of only bots. Online multiplayer should work properly for a small group of real players, and reasonably for a large group playing at the same time.

## Deliberately deferred

Working perfectly for a very large group of 10+ people online at once. The status of achievements is only calculated at the end of a run, this was to reduce workload on the server so that a test didn't need to be constantly polling for each player currently in game, allowing it to run faster.

## Checking the trace persists

Play a run, then open the start screen again: your personal best, unlocked hat collection and the global top 10 are all still there, including after the app restarts.

## Important things to know

The game is predominantly controlled with the mouse but has option of also using spacebar (or click) for dash. When spawning into a new game a player has 5 seconds of immunity from being eaten. When playing on a phone the mouse controls are replaced with a joystick and dash button, these are tested and work on actual devices but are not functional in the inspect menu when testing screen ratios on computer as mouse controls supersede them.
