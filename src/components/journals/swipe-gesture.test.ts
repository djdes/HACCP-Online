import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_SWIPE_CONFIG,
  canStartSwipe,
  decideSwipe,
  swipeOffset,
} from "@/components/journals/swipe-gesture";

const at = (x: number, y: number) => ({ x, y });

describe("canStartSwipe", () => {
  it("у левого края не начинаем — там системный «назад» на iOS", () => {
    // Перехватив его, мы увели бы человека со страницы вместо отметки.
    assert.equal(canStartSwipe(at(0, 100)), false);
    assert.equal(canStartSwipe(at(20, 100)), false);
  });

  it("дальше от края — начинаем", () => {
    assert.equal(canStartSwipe(at(40, 100)), true);
    assert.equal(canStartSwipe(at(300, 100)), true);
  });
});

describe("decideSwipe", () => {
  it("уверенное движение вправо ставит норму", () => {
    assert.deepEqual(decideSwipe(at(100, 200), at(200, 205)), {
      kind: "right",
    });
  });

  it("уверенное движение влево открывает шторку", () => {
    assert.deepEqual(decideSwipe(at(300, 200), at(200, 205)), { kind: "left" });
  });

  it("короткое движение ещё ничего не значит", () => {
    // Дрожание руки и случайный сдвиг при касании короче порога.
    assert.deepEqual(decideSwipe(at(100, 200), at(140, 200)), {
      kind: "pending",
    });
  });

  describe("прокрутка списка не должна ставить значения", () => {
    it("вертикальное движение отдаём скроллу сразу", () => {
      assert.deepEqual(decideSwipe(at(100, 200), at(110, 320)), {
        kind: "scroll",
      });
    });

    it("быстрый скролл с уходом вбок — всё ещё скролл", () => {
      // Именно этот случай ловит проверка вертикали ДО порога: без неё
      // палец, ведущий список, дотянул бы до 72 px вбок и подписал
      // журнал.
      assert.deepEqual(decideSwipe(at(100, 200), at(190, 400)), {
        kind: "scroll",
      });
    });

    it("диагональ круче 30° — тоже скролл", () => {
      // 100 вбок и 80 вниз — это ~38°.
      assert.deepEqual(decideSwipe(at(100, 200), at(200, 280)), {
        kind: "scroll",
      });
    });

    it("пологая диагональ засчитывается", () => {
      // 100 вбок и 20 вниз — это ~11°, движение явно горизонтальное.
      assert.deepEqual(decideSwipe(at(100, 200), at(200, 220)), {
        kind: "right",
      });
    });
  });

  it("ровно на пороге ещё рано, чуть дальше — уже жест", () => {
    const t = DEFAULT_SWIPE_CONFIG.thresholdPx;
    assert.deepEqual(decideSwipe(at(100, 200), at(100 + t - 1, 200)), {
      kind: "pending",
    });
    assert.deepEqual(decideSwipe(at(100, 200), at(100 + t, 200)), {
      kind: "right",
    });
  });

  it("движения не было вовсе", () => {
    assert.deepEqual(decideSwipe(at(100, 200), at(100, 200)), {
      kind: "pending",
    });
  });
});

describe("swipeOffset", () => {
  it("до порога строка едет за пальцем один в один", () => {
    assert.equal(swipeOffset(40), 40);
    assert.equal(swipeOffset(-40), -40);
  });

  it("за порогом появляется сопротивление", () => {
    const t = DEFAULT_SWIPE_CONFIG.thresholdPx;
    const far = swipeOffset(t + 200);
    assert.ok(far > t, "строка всё же сдвинулась дальше порога");
    assert.ok(far < t + 200, "но заметно меньше, чем прошёл палец");
  });

  it("строка не уезжает за экран даже при рывке", () => {
    // Полтора экрана пальцем не должны увести строку в никуда.
    assert.ok(swipeOffset(2000) < 300);
    assert.ok(swipeOffset(-2000) > -300);
  });

  it("сопротивление симметрично", () => {
    assert.equal(swipeOffset(500), -swipeOffset(-500));
  });
});
