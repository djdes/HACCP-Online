import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FAIL_STREAK_ALERT_THRESHOLD,
  OUTBOX_PENDING_ALERT_THRESHOLD,
  OUTBOX_STALE_MS,
} from "./platform-alerts";

/**
 * Пороги алертов админу. Тест не про арифметику, а про намерение:
 * значения легко «поправить» при рефакторинге, и тогда алерт либо
 * замолчит навсегда, либо превратится в шум — заметить это по коду
 * трудно, а последствия видно только в тот день, когда сломается прод.
 */

test("серия провалов: будим со второго, а не с первого", () => {
  // Первый провал чинится следующим тиком (poll ходит раз в 10 минут),
  // человека это будить не должно.
  assert.equal(FAIL_STREAK_ALERT_THRESHOLD, 2);
  assert.ok(FAIL_STREAK_ALERT_THRESHOLD > 1, "с первого провала — это шум");
});

test("порог очереди outbox оставляет место штатному всплеску", () => {
  assert.equal(OUTBOX_PENDING_ALERT_THRESHOLD, 20);
  assert.ok(
    OUTBOX_PENDING_ALERT_THRESHOLD >= 10,
    "слишком низкий порог сработает на обычной ночной раздаче задач",
  );
});

test("залипшей очередь считается через полчаса", () => {
  assert.equal(OUTBOX_STALE_MS, 30 * 60 * 1000);
  // Outbox проигрывается раз в 30 секунд. Полчаса — это шесть десятков
  // неудачных попыток подряд, случайностью это уже не объяснить.
  assert.ok(OUTBOX_STALE_MS >= 10 * 60 * 1000);
});
