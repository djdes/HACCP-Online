import assert from "node:assert/strict";
import test from "node:test";

import { cutoutPath, holeRect, placeCard } from "./spotlight-geometry";

const viewport = { width: 1280, height: 800 };

test("holeRect pads the target on every side", () => {
  const hole = holeRect({ x: 100, y: 50, width: 120, height: 40 }, 6);
  assert.deepEqual(hole, { x: 94, y: 44, width: 132, height: 52 });
});

test("cutoutPath starts with the viewport rectangle and closes the hole", () => {
  const path = cutoutPath(viewport, { x: 94, y: 44, width: 132, height: 52 }, 12);
  assert.ok(path.startsWith("M0 0H1280V800H0Z"));
  assert.ok(path.includes("M106 44"), "hole starts after the corner radius");
  assert.ok(path.endsWith("z"));
});

test("cutoutPath radius never exceeds half of the hole", () => {
  const path = cutoutPath(viewport, { x: 0, y: 0, width: 10, height: 10 }, 12);
  assert.ok(path.includes("a5 5 0 0 1"), path);
});

test("placeCard prefers below the target when there is room", () => {
  const hole = { x: 400, y: 100, width: 200, height: 40 };
  const placed = placeCard({ viewport, hole, card: { width: 360, height: 200 } });
  assert.equal(placed.side, "below");
  assert.equal(placed.top, 100 + 40 + 10);
  assert.equal(placed.left, 400 + 100 - 180);
});

test("placeCard flips above when the bottom has no room", () => {
  const hole = { x: 400, y: 700, width: 200, height: 40 };
  const placed = placeCard({ viewport, hole, card: { width: 360, height: 200 } });
  assert.equal(placed.side, "above");
  assert.equal(placed.top, 700 - 10 - 200);
});

test("placeCard clamps to the viewport margins", () => {
  const hole = { x: 0, y: 0, width: 40, height: 40 };
  const placed = placeCard({ viewport, hole, card: { width: 360, height: 200 } });
  assert.equal(placed.left, 12);
  assert.equal(placed.top, 40 + 10);
  const right = placeCard({ viewport, hole: { x: 1250, y: 0, width: 30, height: 30 }, card: { width: 360, height: 200 } });
  assert.equal(right.left, 1280 - 12 - 360);
});

test("placeCard keeps an oversized card on screen", () => {
  const hole = { x: 0, y: 0, width: 1280, height: 780 };
  const placed = placeCard({ viewport, hole, card: { width: 360, height: 200 } });
  assert.equal(placed.top, 800 - 12 - 200);
});
