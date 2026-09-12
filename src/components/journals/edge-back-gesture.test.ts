import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_EDGE_BACK_CONFIG,
  canStartEdgeBack,
  commitDistance,
  shouldCommitEdgeBack,
  trackEdgeBack,
} from "@/components/journals/edge-back-gesture";
import { canStartSwipe } from "@/components/journals/swipe-gesture";

const WIDTH = 390;

describe("canStartEdgeBack", () => {
  it("начинается только у левого края", () => {
    assert.equal(canStartEdgeBack({ x: 4, y: 300 }), true);
    assert.equal(canStartEdgeBack({ x: 120, y: 300 }), false);
  });

  it("делит экран со свайпом строки без зазора и без нахлёста", () => {
    // Если зоны разойдутся, в щели между ними не сработает ничего,
    // а при нахлёсте сработает и то и другое сразу.
    for (const x of [0, 14, 28, 29, 200]) {
      const edge = canStartEdgeBack({ x, y: 300 });
      const row = canStartSwipe({ x, y: 300 });
      assert.notEqual(edge, row, `x=${x}: обе зоны ответили одинаково`);
    }
  });
});

describe("trackEdgeBack", () => {
  it("движение вправо копит прогресс", () => {
    const move = trackEdgeBack({ x: 5, y: 300 }, { x: 55, y: 302 }, WIDTH);
    assert.equal(move.kind, "pending");
    if (move.kind !== "pending") return;
    assert.ok(move.progress > 0 && move.progress < 1);
  });

  it("прогресс упирается в единицу, а не растёт дальше", () => {
    const move = trackEdgeBack({ x: 5, y: 300 }, { x: 380, y: 300 }, WIDTH);
    assert.equal(move.kind, "pending");
    if (move.kind !== "pending") return;
    assert.equal(move.progress, 1);
  });

  it("прокрутка списка от края не считается жестом", () => {
    // Самая дорогая ошибка: человек листает, а его уводит с экрана.
    assert.equal(trackEdgeBack({ x: 5, y: 500 }, { x: 25, y: 300 }, WIDTH).kind, "cancel");
  });

  it("движение влево снимает жест", () => {
    assert.equal(trackEdgeBack({ x: 20, y: 300 }, { x: 4, y: 300 }, WIDTH).kind, "cancel");
  });

  it("наклон круче предела — это не «назад»", () => {
    // dx=60, dy=40 → около 34°, больше 25°.
    assert.equal(trackEdgeBack({ x: 5, y: 300 }, { x: 65, y: 340 }, WIDTH).kind, "cancel");
  });
});

describe("commitDistance", () => {
  it("на узком экране не опускается ниже минимума", () => {
    assert.equal(commitDistance(200), DEFAULT_EDGE_BACK_CONFIG.minCommitPx);
  });

  it("на широком считается долей ширины", () => {
    assert.equal(commitDistance(800), 200);
  });
});

describe("shouldCommitEdgeBack", () => {
  it("дотянул до порога — уходим назад", () => {
    assert.equal(shouldCommitEdgeBack(1, 0), true);
  });

  it("не дотянул и вёл медленно — остаёмся", () => {
    assert.equal(shouldCommitEdgeBack(0.6, 0.05), false);
  });

  it("быстрый рывок засчитывается, иначе жест кажется тугим", () => {
    assert.equal(shouldCommitEdgeBack(0.4, 0.9), true);
  });

  it("рывок почти из ничего не засчитывается", () => {
    // Задели край ладонью — экран закрываться не должен.
    assert.equal(shouldCommitEdgeBack(0.05, 2), false);
  });
});
