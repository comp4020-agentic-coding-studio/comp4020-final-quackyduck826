import { expect, inject, it } from "vitest";

const baseUrl = inject("baseUrl");
const wsUrl = new URL("/ws", baseUrl);
wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";

function connect(name: string): Promise<{ socket: WebSocket; nextSnapshot: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const queue: unknown[] = [];
    const waiters: ((msg: unknown) => void)[] = [];
    socket.addEventListener("open", () => socket.send(JSON.stringify({ type: "join", name, colour: "teal" })));
    socket.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data as string);
      if (msg.type !== "snapshot") return;
      const waiter = waiters.shift();
      if (waiter) waiter(msg);
      else queue.push(msg);
    });
    socket.addEventListener("error", reject);
    const nextSnapshot = () =>
      new Promise((res) => {
        const queued = queue.shift();
        if (queued) res(queued);
        else waiters.push(res);
      });
    socket.addEventListener("open", () => resolve({ socket, nextSnapshot }));
  });
}

it("sees another player join and leave the shared world", async () => {
  const a = await connect("spec-alice");
  await a.nextSnapshot(); // past the first snapshot (joins one tick after "join" is processed)
  const beforeCount = (await a.nextSnapshot()).players.length;

  const b = await connect("spec-bob");
  await b.nextSnapshot();

  // Poll a few snapshots until alice's view includes bob, rather than
  // asserting on the very next tick (join and snapshot delivery aren't
  // perfectly synchronized across two sockets).
  let sawBoth = false;
  for (let i = 0; i < 20 && !sawBoth; i++) {
    const snap = await a.nextSnapshot();
    sawBoth = snap.players.length >= beforeCount + 1 && snap.players.some((p: any) => p.name === "spec-bob");
  }
  expect(sawBoth).toBe(true);

  b.socket.close();

  let bobGone = false;
  for (let i = 0; i < 20 && !bobGone; i++) {
    const snap = await a.nextSnapshot();
    bobGone = !snap.players.some((p: any) => p.name === "spec-bob");
  }
  expect(bobGone).toBe(true);

  a.socket.close();
});
