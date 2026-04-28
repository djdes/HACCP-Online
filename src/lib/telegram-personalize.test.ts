/**
 * Снэпшот-тесты для `personalizeMessage`.
 *
 * Цель — зафиксировать стабильность контракта placeholder'ов: имена,
 * приветствия, время суток, дни недели. Если кто-то решит поменять
 * формулировку, тест упадёт и привлечёт внимание ревью.
 *
 * `personalizeMessage` использует локальное время сервера (`getHours`,
 * `getDay`). Чтобы тесты были детерминированными независимо от TZ
 * сервера, мы передаём явный `now: Date` и собираем дату через
 * локальные конструкторы (`new Date(year, month, ...)`), а не через
 * UTC ISO-строки.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { personalizeMessage } from "@/lib/telegram";

function localDate(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0
): Date {
  return new Date(year, monthIndex, day, hour, minute, 0, 0);
}

test("personalizeMessage returns text unchanged when there are no placeholders", () => {
  assert.equal(personalizeMessage("hello world", { name: "Иван" }), "hello world");
});

test("personalizeMessage replaces {name} with the first word of ctx.name", () => {
  const out = personalizeMessage("Привет, {name}!", {
    name: "  Иван  Иванов  ",
    now: localDate(2026, 3, 20, 10),
  });
  assert.equal(out, "Привет, Иван!");
});

test("personalizeMessage falls back to «сотрудник» when name is missing", () => {
  assert.equal(
    personalizeMessage("{name}, заполните журнал", {
      name: null,
      now: localDate(2026, 3, 20, 10),
    }),
    "сотрудник, заполните журнал"
  );
  assert.equal(
    personalizeMessage("{name}, заполните журнал", {
      name: "   ",
      now: localDate(2026, 3, 20, 10),
    }),
    "сотрудник, заполните журнал"
  );
});

test("personalizeMessage HTML-escapes user-provided name to keep parse_mode=HTML safe", () => {
  const out = personalizeMessage("Привет, {name}!", {
    name: "<admin> & co",
    now: localDate(2026, 3, 20, 10),
  });
  // First word of "<admin> & co" → "<admin>"; escape → "&lt;admin&gt;"
  assert.equal(out, "Привет, &lt;admin&gt;!");
});

test("personalizeMessage replaces {greeting} with morning greeting at 06:00 boundary", () => {
  // 06:00 — переход «ночью → утром» (граница `< 6` exclusive).
  assert.equal(
    personalizeMessage("{greeting}!", {
      name: null,
      now: localDate(2026, 3, 20, 6),
    }),
    "Доброе утро!"
  );
  // 05:59 — всё ещё ночь.
  assert.equal(
    personalizeMessage("{greeting}!", {
      name: null,
      now: localDate(2026, 3, 20, 5, 59),
    }),
    "Доброй ночи!"
  );
});

test("personalizeMessage replaces {greeting} across day boundaries", () => {
  // 12:00 → день
  assert.equal(
    personalizeMessage("{greeting}", { name: null, now: localDate(2026, 3, 20, 12) }),
    "Добрый день"
  );
  // 11:59 → утро
  assert.equal(
    personalizeMessage("{greeting}", {
      name: null,
      now: localDate(2026, 3, 20, 11, 59),
    }),
    "Доброе утро"
  );
  // 18:00 → вечер
  assert.equal(
    personalizeMessage("{greeting}", { name: null, now: localDate(2026, 3, 20, 18) }),
    "Добрый вечер"
  );
  // 17:59 → день
  assert.equal(
    personalizeMessage("{greeting}", {
      name: null,
      now: localDate(2026, 3, 20, 17, 59),
    }),
    "Добрый день"
  );
  // 23:59 → вечер
  assert.equal(
    personalizeMessage("{greeting}", {
      name: null,
      now: localDate(2026, 3, 20, 23, 59),
    }),
    "Добрый вечер"
  );
  // 00:00 → ночь
  assert.equal(
    personalizeMessage("{greeting}", { name: null, now: localDate(2026, 3, 20, 0) }),
    "Доброй ночи"
  );
});

test("personalizeMessage maps {timeOfDay} same way as {greeting} but in adverbial form", () => {
  assert.equal(
    personalizeMessage("Желаем {timeOfDay} добра", {
      name: null,
      now: localDate(2026, 3, 20, 0),
    }),
    "Желаем ночью добра"
  );
  assert.equal(
    personalizeMessage("Желаем {timeOfDay} добра", {
      name: null,
      now: localDate(2026, 3, 20, 8),
    }),
    "Желаем утром добра"
  );
  assert.equal(
    personalizeMessage("Желаем {timeOfDay} добра", {
      name: null,
      now: localDate(2026, 3, 20, 14),
    }),
    "Желаем днём добра"
  );
  assert.equal(
    personalizeMessage("Желаем {timeOfDay} добра", {
      name: null,
      now: localDate(2026, 3, 20, 21),
    }),
    "Желаем вечером добра"
  );
});

test("personalizeMessage replaces {dayOfWeek} with accusative-case Russian day name", () => {
  // 2026-04-20 — понедельник.
  const monday = localDate(2026, 3, 20, 10);
  assert.equal(
    personalizeMessage("Не забудьте про {dayOfWeek}", {
      name: null,
      now: monday,
    }),
    "Не забудьте про понедельник"
  );
  // sweep всю неделю — порядок [воскресенье, пнд, вт, ср, чт, пт, сб]
  const expectedByDayIndex = [
    "воскресенье",
    "понедельник",
    "вторник",
    "среду",
    "четверг",
    "пятницу",
    "субботу",
  ];
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const day = localDate(2026, 3, 19 + dayOffset, 10); // 2026-04-19 = воскресенье
    const out = personalizeMessage("В {dayOfWeek}", { name: null, now: day });
    assert.equal(out, `В ${expectedByDayIndex[day.getDay()]}`);
  }
});

test("personalizeMessage combines all placeholders in a single template", () => {
  const out = personalizeMessage("{greeting}, {name}! Сегодня {dayOfWeek}.", {
    name: "Алексей",
    now: localDate(2026, 3, 20, 10), // понедельник, утро
  });
  assert.equal(out, "Доброе утро, Алексей! Сегодня понедельник.");
});

test("personalizeMessage is idempotent: re-running on the same text does nothing extra", () => {
  const ctx = { name: "Олег", now: localDate(2026, 3, 20, 14) };
  const first = personalizeMessage("Привет, {name}!", ctx);
  const second = personalizeMessage(first, ctx);
  assert.equal(first, "Привет, Олег!");
  assert.equal(first, second);
});
