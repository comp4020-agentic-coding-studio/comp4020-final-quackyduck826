export async function getLeaderboard() {
  const res = await fetch("/api/leaderboard");
  if (!res.ok) throw new Error("leaderboard unavailable");
  return (await res.json()).entries;
}

export async function submitScore({ name, score, colour }) {
  const res = await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, score, colour }),
  });
  if (!res.ok) throw new Error("submit failed");
  return (await res.json()).entries;
}
