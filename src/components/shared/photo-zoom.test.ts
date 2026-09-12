import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOUBLE_TAP_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  ZOOM_IDENTITY,
  clampPan,
  clampScale,
  distance,
  isZoomed,
  midpoint,
  nextDoubleTapState,
  zoomAround,
} from "@/components/shared/photo-zoom";

const VIEWPORT = { width: 390, height: 844 };
const CONTENT = { width: 390, height: 520 };

/** Где окажется точка содержимого после преобразования. */
function project(state: { scale: number; x: number; y: number }, contentPoint: number) {
  return contentPoint * state.scale + state.x;
}

describe("clampScale", () => {
  it("держится в границах", () => {
    assert.equal(clampScale(0.2), MIN_ZOOM);
    assert.equal(clampScale(99), MAX_ZOOM);
    assert.equal(clampScale(2), 2);
  });

  it("не пропускает NaN дальше", () => {
    // Щипок одним пальцем даёт деление на ноль — после этого весь
    // лайтбокс исчезал бы с экрана без единой ошибки в консоли.
    assert.equal(clampScale(Number.NaN), MIN_ZOOM);
  });
});

describe("distance / midpoint", () => {
  it("считает расстояние между пальцами", () => {
    assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });

  it("середина — между пальцами", () => {
    assert.deepEqual(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 }), { x: 5, y: 10 });
  });
});

describe("zoomAround", () => {
  it("точка под пальцами остаётся на месте", () => {
    // Главное свойство щипка. Без него изображение убегает из-под руки.
    const focal = { x: 60, y: -120 };
    const before = ZOOM_IDENTITY;
    const after = zoomAround(before, focal, 3);
    // Координата содержимого под фокусом до и после совпадает.
    const contentUnderFocalBefore = (focal.x - before.x) / before.scale;
    const contentUnderFocalAfter = (focal.x - after.x) / after.scale;
    assert.ok(
      Math.abs(contentUnderFocalBefore - contentUnderFocalAfter) < 1e-9,
      `${contentUnderFocalBefore} !== ${contentUnderFocalAfter}`
    );
    assert.ok(Math.abs(project(after, contentUnderFocalAfter) - focal.x) < 1e-9);
  });

  it("центр остаётся центром при щипке по центру", () => {
    const after = zoomAround(ZOOM_IDENTITY, { x: 0, y: 0 }, 2);
    assert.deepEqual(after, { scale: 2, x: 0, y: 0 });
  });

  it("сжатие ниже единицы возвращает исходный вид", () => {
    const zoomed = zoomAround(ZOOM_IDENTITY, { x: 40, y: 40 }, 3);
    const back = zoomAround(zoomed, { x: 40, y: 40 }, 0.3);
    assert.equal(back.scale, MIN_ZOOM);
  });
});

describe("clampPan", () => {
  it("неприближённое фото не сдвигается вовсе", () => {
    const state = clampPan({ scale: 1, x: 200, y: 200 }, VIEWPORT, CONTENT);
    assert.deepEqual(state, { scale: 1, x: 0, y: 0 });
  });

  it("приближённое можно двигать, но не за край", () => {
    // При масштабе 2 ширина 780 против экрана 390 → запас ровно 195.
    const state = clampPan({ scale: 2, x: 900, y: 0 }, VIEWPORT, CONTENT);
    assert.equal(state.x, 195);
  });

  it("ось, по которой фото уже экрана, держится по центру", () => {
    // Высота 520*1.2=624 против экрана 844 — вертикали двигаться некуда.
    const state = clampPan({ scale: 1.2, x: 0, y: 300 }, VIEWPORT, CONTENT);
    assert.equal(state.y, 0);
  });
});

describe("nextDoubleTapState", () => {
  it("первое двойное касание приближает к точке касания", () => {
    const state = nextDoubleTapState(ZOOM_IDENTITY, { x: 50, y: 50 });
    assert.equal(state.scale, DOUBLE_TAP_ZOOM);
    assert.ok(isZoomed(state));
  });

  it("второе — возвращает как было", () => {
    const zoomed = nextDoubleTapState(ZOOM_IDENTITY, { x: 50, y: 50 });
    assert.deepEqual(nextDoubleTapState(zoomed, { x: 50, y: 50 }), ZOOM_IDENTITY);
  });

  it("накопленная погрешность не считается приближением", () => {
    // Иначе фото «залипает» приближённым после сведения пальцев.
    assert.equal(isZoomed({ scale: 1.000000004, x: 0, y: 0 }), false);
  });
});
