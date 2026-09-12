import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  LONG_PRESS_MOVE_TOLERANCE_PX,
  LONG_PRESS_MS,
  isLongPressCancelled,
  longPressProgress,
} from "@/lib/long-press";

describe("isLongPressCancelled", () => {
  it("неподвижный палец жест не снимает", () => {
    assert.equal(isLongPressCancelled({ x: 100, y: 200 }, { x: 100, y: 200 }), false);
  });

  it("дрожание в пределах допуска терпим", () => {
    // Идеально неподвижно палец не держит никто.
    assert.equal(isLongPressCancelled({ x: 100, y: 200 }, { x: 104, y: 203 }), false);
  });

  it("прокрутка списка снимает жест", () => {
    // Иначе меню открывается у случайной карточки во время листания.
    assert.equal(isLongPressCancelled({ x: 100, y: 200 }, { x: 102, y: 260 }), true);
  });

  it("считает по прямой, а не по осям по отдельности", () => {
    // По каждой оси 8 px — в допуске, по диагонали 11 px — нет.
    const diagonal = { x: 108, y: 208 };
    assert.ok(Math.hypot(8, 8) > LONG_PRESS_MOVE_TOLERANCE_PX);
    assert.equal(isLongPressCancelled({ x: 100, y: 200 }, diagonal), true);
  });
});

describe("longPressProgress", () => {
  it("растёт от нуля до единицы", () => {
    assert.equal(longPressProgress(0), 0);
    assert.equal(longPressProgress(LONG_PRESS_MS / 2), 0.5);
    assert.equal(longPressProgress(LONG_PRESS_MS), 1);
  });

  it("не уходит за единицу и ниже нуля", () => {
    assert.equal(longPressProgress(99999), 1);
    assert.equal(longPressProgress(-5), 0);
  });

  it("нулевая длительность не делит на ноль", () => {
    assert.equal(longPressProgress(10, 0), 1);
  });
});
