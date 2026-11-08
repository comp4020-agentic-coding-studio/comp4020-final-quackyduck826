// Desired heading as a unit vector from pointer position (relative to screen
// centre, where the camera keeps the player) with WASD/arrow fallback. A
// click or spacebar press requests a dash in that same heading. On a touch
// device, main.js wires up setupTouchControls() below instead, which feeds a
// heading through `setTouchHeading` that takes priority over keyboard/pointer
// whenever it's active (the joystick is actively being dragged).
export function createInput(canvas) {
  const keys = new Set();
  let pointer = null;
  let dashRequested = false;
  let touchHeading = null;
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
    if (touchHeading) return touchHeading;
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
  // Raw last-known pointer position (screen-relative to the canvas centre,
  // same coordinates `move` above records), for callers that want the
  // pointer itself rather than the heading derived from it — e.g. the
  // cursor-wake ripple trail (render.js), which needs to know where on
  // screen the cursor actually is, not just which way it points. Returns
  // null until the pointer has moved over the canvas at least once.
  const readPointer = () => pointer;
  // Set by the joystick drag handler below with a already-unit-length [x, y],
  // or null once the thumb is released, to fall back to keyboard/pointer.
  const setTouchHeading = (h) => { touchHeading = h; };
  const requestDash = () => { dashRequested = true; };
  return { readHeading, consumeDash, readPointer, setTouchHeading, requestDash };
}

// True on a touch-primary device (phone/tablet), used by main.js to decide
// whether to reveal the on-screen joystick/dash button at all — a mouse user
// with a touchscreen monitor shouldn't get thumb controls cluttering the
// view. Read once at call time rather than cached, since nothing here needs
// to react to a device gaining/losing touch support mid-session.
export const isTouchDevice = () => matchMedia("(pointer: coarse)").matches;

const JOYSTICK_DEADZONE = 0.12; // fraction of maxRadius below which heading is zero, avoids drift from a near-centre thumb

// Wires a joystick zone + thumb element to drive `setTouchHeading`, and a
// dash button to call `requestDash`. Pointer Events (not touchstart/move),
// since the zone/button already set `touch-action: none` in CSS to suppress
// scroll/zoom gestures, and pointer events cover mouse testing too. Uses
// setPointerCapture so the drag keeps tracking even if the finger slides
// outside the zone's own bounding box.
export function setupTouchControls({ zone, thumb, dashBtn, setTouchHeading, requestDash }) {
  let activePointerId = null;

  const vectorFor = (e) => {
    const r = zone.getBoundingClientRect();
    // Read fresh per-event, not cached at setup time: the joystick zone is
    // inside #touch-controls, which stays `hidden` (0 layout size) until a
    // run starts, so a radius captured once at module-init time would be 0
    // forever and leave the thumb visually stuck at centre.
    const maxRadius = r.width / 2;
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    thumb.style.transform = dist > 0
      ? `translate(${(dx / dist) * clamped}px, ${(dy / dist) * clamped}px)`
      : "translate(0, 0)";
    if (clamped / maxRadius < JOYSTICK_DEADZONE) return [0, 0];
    return [dx / dist, dy / dist];
  };

  zone.addEventListener("pointerdown", (e) => {
    activePointerId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    setTouchHeading(vectorFor(e));
  });
  zone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== activePointerId) return;
    setTouchHeading(vectorFor(e));
  });
  const release = (e) => {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    thumb.style.transform = "translate(0, 0)";
    setTouchHeading(null);
  };
  zone.addEventListener("pointerup", release);
  zone.addEventListener("pointercancel", release);

  dashBtn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    requestDash();
  });
}
