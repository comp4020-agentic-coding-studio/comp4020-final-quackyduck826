// Desired heading as a unit vector from pointer position (relative to screen
// centre, where the camera keeps the player) with WASD/arrow fallback. A
// click or spacebar press requests a dash in that same heading.
export function createInput(canvas) {
  const keys = new Set();
  let pointer = null;
  let dashRequested = false;
  addEventListener("keydown", (e) => {
    keys.add(e.key.toLowerCase());
    if (e.key === " " && !e.repeat) dashRequested = true;
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  const move = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", (e) => {
    move(e);
    dashRequested = true;
  });
  const readHeading = () => {
    let x = 0, y = 0;
    const k = (...n) => n.some((c) => keys.has(c));
    if (k("a", "arrowleft")) x -= 1;
    if (k("d", "arrowright")) x += 1;
    if (k("w", "arrowup")) y -= 1;
    if (k("s", "arrowdown")) y += 1;
    if (!x && !y && pointer) [x, y] = [pointer.x, pointer.y];
    const len = Math.hypot(x, y);
    return len < 8 ? [0, 0] : [x / len, y / len];
  };
  const consumeDash = () => {
    const requested = dashRequested;
    dashRequested = false;
    return requested;
  };
  return { readHeading, consumeDash };
}
