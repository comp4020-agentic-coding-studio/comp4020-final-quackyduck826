# pond.io

pond.io is an .io-style game based off of simple games like slither.io and agar.io. You are a fish swimming around a pond, you grow by eating small leaves and tiny fish and other 'player' fish that are smaller than you, and bigger fish eat you. As you collect the differnt types of food and grow your fish your score also increases. Increase your score to get onto the global leaderboard of only real players, bots scores are ignored here, while collecting achievements along the way. each acheivement that you unlock awards you a hat that your fish can wear in the next run.

## What "good" means this week

A playable game that is challenging but doable even against a room full of only bots. The game should have an end point, a place where finishing your run feels like youve acheved something challenging. Online multiplayer should work properly for a small group of real players, allowing you to eat eachother and other bot players. online multiplayer should also work reasonably for a large group playing at the same time.

## Deliberately deferred

Working perfectly for a very large group of 10+ people online at once. The status of achievements is only calculated at the end of a run, this was to reduce workload on the server so that a test didn't need to be constantly polling for each player currently in game, allowing it to run faster.

## Checking the trace persists

Play a run, then open the start screen again: your personal best, unlocked hat collection and the global top 10 are all still there, including after the app restarts.

## Important things to know

The game is predominantly controlled with the mouse but has option of also using spacebar (or click) for dash. When spawning into a new game a player has 5 seconds of immunity from being eaten. You must be at least 5% larger than another fish to eat it, and once you pass a certain size you will no longer be able to eat the tiny free spawning food. You will also begin to bleed size after reaching a certain size, but youre score will continue to rise when eating. When playing on a phone the mouse controls are replaced with a joystick and dash button, these are tested and work on actual devices but are not functional in the inspect menu when testing screen ratios on computer as mouse controls supersede them. 
