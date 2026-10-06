# Crit 8 reflection

The breakthrough was small: partway through getting the fish to render right, I pushed the tail shape to a third version, didn't like it, and reverted back to the second stage's approach before trying again — it's the "stage 3 reverted to stage 2" note in PROCESS.md. That sounds trivial, but it reframed how I work with an agent. Progress doesn't have to be a straight line, and backtracking mid-session costs almost nothing when the next attempt can just restart from a known-good point instead of patching something half-working.

That's changed what I want to be as a developer: less attached to whatever the last change was, more willing to say "that's not it" immediately and try again, rather than defending a sunk cost. The bot-jitter bug later confirmed the same lesson from the other direction — the fix only came once I stopped patching symptoms and asked why the AI's target choice had no memory between frames at all.
