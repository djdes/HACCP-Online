/**
 * Дедлайн гашения ВСД — один рабочий день по календарю РФ.
 *
 * Тест важен тем, что ошибка здесь тихая: срок просто уедет на день, и
 * клиент узнает об этом от Россельхознадзора, а не от нас.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarWarning,
  computeProcessingDueAt,
  describeDeadline,
  endOfDayInTimezone,
  hasCalendarData,
} from "@/lib/mercury/deadline";

describe("computeProcessingDueAt", () => {
  it("будний день → следующий будний", () => {
    // Вторник 2026-09-08 → среда 2026-09-09.
    const r = computeProcessingDueAt({ base: "2026-09-08" });
    assert.equal(r.dueDateKey, "2026-09-09");
    assert.equal(r.calendarKnown, true);
  });

  it("пятница → понедельник, а не суббота", () => {
    // 2026-09-11 пятница; 12-13 выходные.
    const r = computeProcessingDueAt({ base: "2026-09-11" });
    assert.equal(r.dueDateKey, "2026-09-14");
  });

  it("поставка в субботу отсчитывается от понедельника", () => {
    // Суббота 2026-09-12: первый рабочий — понедельник 14-го,
    // срок — вторник 15-го.
    const r = computeProcessingDueAt({ base: "2026-09-12" });
    assert.equal(r.dueDateKey, "2026-09-15");
  });

  it("новогодние каникулы перепрыгиваются целиком", () => {
    // 2026-01-01..08 — праздники по RU_CALENDAR_2026, 09 — пятница.
    const r = computeProcessingDueAt({ base: "2026-01-01" });
    assert.ok(
      r.dueDateKey > "2026-01-08",
      `срок ${r.dueDateKey} не должен попадать в каникулы`,
    );
  });

  it("принимает Date, а не только строку", () => {
    const r = computeProcessingDueAt({ base: new Date("2026-09-08T14:20:00Z") });
    assert.equal(r.dueDateKey, "2026-09-09");
  });

  it("год без календаря помечается флагом, но срок всё равно считается", () => {
    const r = computeProcessingDueAt({ base: "2030-06-10" });
    assert.equal(r.calendarKnown, false);
    assert.equal(r.dueDateKey, "2030-06-11");
    assert.match(String(calendarWarning("2030-06-10")), /2030/);
    assert.equal(calendarWarning("2026-09-08"), null);
    assert.equal(hasCalendarData("2026-09-08"), true);
  });
});

describe("endOfDayInTimezone", () => {
  it("конец дня по Москве — это 20:59:59 UTC", () => {
    const at = endOfDayInTimezone("2026-09-09", "Europe/Moscow");
    assert.equal(at.toISOString(), "2026-09-09T20:59:59.000Z");
  });

  it("камчатская зона заканчивает день на 9 часов раньше московской", () => {
    const msk = endOfDayInTimezone("2026-09-09", "Europe/Moscow").getTime();
    const pkc = endOfDayInTimezone("2026-09-09", "Asia/Kamchatka").getTime();
    assert.equal((msk - pkc) / 3600000, 9);
  });

  it("битая зона не роняет расчёт — откат на Москву", () => {
    const at = endOfDayInTimezone("2026-09-09", "Nowhere/Nothing");
    assert.equal(at.toISOString(), "2026-09-09T20:59:59.000Z");
  });
});

describe("describeDeadline", () => {
  const due = new Date("2026-09-09T20:59:59Z");

  it("больше восьми часов в запасе — спокойно", () => {
    const r = describeDeadline(due, new Date("2026-09-09T06:00:00Z"));
    assert.equal(r.tone, "ok");
  });

  it("меньше восьми часов — «скоро»", () => {
    const r = describeDeadline(due, new Date("2026-09-09T15:00:00Z"));
    assert.equal(r.tone, "soon");
  });

  it("после срока — просрочен, с числом суток", () => {
    const r = describeDeadline(due, new Date("2026-09-11T21:30:00Z"));
    assert.equal(r.tone, "overdue");
    assert.equal(r.daysOverdue, 2);
  });

  it("без срока ничего не выдумываем", () => {
    assert.equal(describeDeadline(null).tone, "ok");
  });
});
