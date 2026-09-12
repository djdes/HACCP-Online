import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INITIAL_SCROLL_HIDE_STATE,
  SCROLL_HIDE_AFTER_PX,
  nextScrollHideState,
  type ScrollHideState,
} from "@/app/mini/_lib/scroll-direction";

/** Прогон последовательности координат, как их отдаёт браузер. */
function run(ys: number[], from: ScrollHideState = INITIAL_SCROLL_HIDE_STATE) {
  return ys.reduce(nextScrollHideState, from);
}

describe("nextScrollHideState", () => {
  it("в начале списка кнопка видна всегда", () => {
    assert.equal(run([0, 10, 40, SCROLL_HIDE_AFTER_PX]).hidden, false);
  });

  it("прокрутка вниз прячет", () => {
    assert.equal(run([0, 100, 300]).hidden, true);
  });

  it("прокрутка вверх возвращает", () => {
    assert.equal(run([0, 100, 300, 240]).hidden, false);
  });

  it("возврат к началу показывает, даже если пряталась", () => {
    assert.equal(run([0, 300, 10]).hidden, false);
  });

  it("дрожание в пару пикселей ничего не переключает", () => {
    // Именно так ведёт себя инерционный скролл iOS: кнопка мигала бы.
    const after = run([0, 300]);
    assert.equal(after.hidden, true);
    const jitter = run([302, 299, 303, 300, 301], after);
    assert.equal(jitter.hidden, true);
    assert.equal(jitter.lastY, after.lastY, "мелкие шаги не сдвигают опору");
  });

  it("мелкие шаги в одну сторону всё же копятся", () => {
    // Иначе медленный скролл пальцем не сработает вовсе.
    const after = run([0, 300]);
    const slow = run([305, 310, 316], after);
    assert.equal(slow.hidden, true);
    assert.ok(slow.lastY > after.lastY);
  });

  it("отскок за верхний край не считается прокруткой вверх", () => {
    // Safari отдаёт отрицательный scrollY при оттяжке — без зажима
    // это выглядело бы как резкое движение вверх.
    const state = run([-40], { lastY: 0, hidden: false });
    assert.equal(state.hidden, false);
    assert.equal(state.lastY, 0);
  });
});
