import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDayStart } from "./today-compliance";

/**
 * Граница суток в статусе «заполнено сегодня».
 *
 * На проде процесс живёт в UTC. Повар, заполняющий журнал в час ночи по
 * Москве, попадает в UTC-вчера — и его запись, легшая в сегодняшнюю дату,
 * не засчитывалась. Ровно это и проверяем.
 */

test("час ночи по Москве — это уже сегодня, а не UTC-вчера", () => {
  // 29 августа 01:30 МСК = 28 августа 22:30 UTC.
  const now = new Date("2026-08-28T22:30:00.000Z");
  const day = resolveDayStart("Europe/Moscow", now);
  assert.equal(day.toISOString(), "2026-08-29T00:00:00.000Z");
});

test("дневное время в московской зоне даёт тот же день", () => {
  const now = new Date("2026-08-28T16:12:00.000Z"); // 19:12 МСК
  const day = resolveDayStart("Europe/Moscow", now);
  assert.equal(day.toISOString(), "2026-08-28T00:00:00.000Z");
});

test("камчатская зона: вечер UTC — уже завтра", () => {
  // 28 августа 20:00 UTC = 29 августа 08:00 на Камчатке (UTC+12).
  const now = new Date("2026-08-28T20:00:00.000Z");
  const day = resolveDayStart("Asia/Kamchatka", now);
  assert.equal(day.toISOString(), "2026-08-29T00:00:00.000Z");
});

test("UTC-полночь — это явно названный день, его не сдвигаем", () => {
  // Так отчёт за период и сертификат перебирают даты в цикле. Сдвиг
  // сломал бы им нумерацию дней.
  const explicit = new Date("2026-08-15T00:00:00.000Z");
  assert.equal(
    resolveDayStart("Asia/Kamchatka", explicit).toISOString(),
    "2026-08-15T00:00:00.000Z",
  );
});

test("пустая зона — откат на Москву, а не падение", () => {
  const now = new Date("2026-08-28T22:30:00.000Z");
  assert.equal(
    resolveDayStart(null, now).toISOString(),
    "2026-08-29T00:00:00.000Z",
  );
});
