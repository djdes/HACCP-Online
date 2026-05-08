/**
 * Regression-тесты для applyRoomScheduleToMatrix (cleaning-document.ts).
 *
 * Покрывают сценарии которые мы ломали в недавних коммитах:
 *   • rooms-mode: применение плана к selectedRoomIds без config.rooms
 *   • monthly-расписание (cleaning-stage 2026-05-08+ — last day, multiple days)
 *   • weekly bitmask приоритет general > current
 *   • dbRooms приоритетнее config.rooms
 *
 * См. spec docs/superpowers/specs/01-architecture.md (anti-regression workflow:
 * «сначала тест, потом фикс»).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRoomScheduleToMatrix,
  defaultCleaningDocumentConfig,
  type RoomScheduleFromDb,
} from "@/lib/cleaning-document";

function buildDateKeys(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (
    let d = new Date(start);
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

test("rooms-mode: selectedRoomIds без config.rooms получают T по дефолту (currentDays=127)", () => {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-A", "room-B"],
    rooms: [], // пусто — нет per-room scope
    matrix: {},
  };
  const dates = buildDateKeys("2026-05-04", "2026-05-10"); // Пн-Вс
  const result = applyRoomScheduleToMatrix(config, dates, "fill-empty");
  // Дефолт currentDays=127 → каждый день T для каждой комнаты
  assert.equal(result.matrix["room-A"]?.["2026-05-04"], "T", "Mon");
  assert.equal(result.matrix["room-A"]?.["2026-05-08"], "T", "Fri");
  assert.equal(result.matrix["room-B"]?.["2026-05-10"], "T", "Sun");
});

test("dbRooms map переопределяет расписание (rooms-mode)", () => {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-X"],
    rooms: [],
    matrix: {},
  };
  const dbRooms = new Map<string, RoomScheduleFromDb>([
    [
      "room-X",
      {
        id: "room-X",
        currentDays: 31, // Пн-Пт
        generalDays: 32, // Сб
      },
    ],
  ]);
  const dates = buildDateKeys("2026-05-04", "2026-05-10");
  const result = applyRoomScheduleToMatrix(
    config,
    dates,
    "fill-empty",
    dbRooms,
  );
  assert.equal(result.matrix["room-X"]?.["2026-05-04"], "T", "Mon should be T");
  assert.equal(result.matrix["room-X"]?.["2026-05-09"], "G", "Sat should be G");
  assert.equal(
    result.matrix["room-X"]?.["2026-05-10"],
    undefined,
    "Sun not scheduled — empty",
  );
});

test("monthly-режим: 'last' матчится с последним днём месяца", () => {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-Y"],
    rooms: [],
    matrix: {},
  };
  const dbRooms = new Map<string, RoomScheduleFromDb>([
    [
      "room-Y",
      {
        id: "room-Y",
        generalScheduleType: "monthly",
        generalMonthDays: ["last"],
        currentScheduleType: "weekly",
        currentDays: 0, // никогда T
      },
    ],
  ]);
  // Май 2026: 31 день, последний = 2026-05-31
  const dates = buildDateKeys("2026-05-29", "2026-05-31");
  const result = applyRoomScheduleToMatrix(
    config,
    dates,
    "fill-empty",
    dbRooms,
  );
  assert.equal(
    result.matrix["room-Y"]?.["2026-05-31"],
    "G",
    "May 31 = last day, должно быть G",
  );
  assert.equal(
    result.matrix["room-Y"]?.["2026-05-30"],
    undefined,
    "May 30 не последний день",
  );
});

test("monthly-режим: список конкретных дней", () => {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-Z"],
    rooms: [],
    matrix: {},
  };
  const dbRooms = new Map<string, RoomScheduleFromDb>([
    [
      "room-Z",
      {
        id: "room-Z",
        generalScheduleType: "monthly",
        generalMonthDays: ["1", "15"],
        currentDays: 0,
      },
    ],
  ]);
  const dates = buildDateKeys("2026-05-01", "2026-05-16");
  const result = applyRoomScheduleToMatrix(
    config,
    dates,
    "fill-empty",
    dbRooms,
  );
  assert.equal(result.matrix["room-Z"]?.["2026-05-01"], "G");
  assert.equal(result.matrix["room-Z"]?.["2026-05-15"], "G");
  assert.equal(result.matrix["room-Z"]?.["2026-05-08"], undefined);
  assert.equal(result.matrix["room-Z"]?.["2026-05-16"], undefined);
});

test("general приоритетнее current в один и тот же weekly-день", () => {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-Q"],
    rooms: [],
    matrix: {},
  };
  const dbRooms = new Map<string, RoomScheduleFromDb>([
    [
      "room-Q",
      {
        id: "room-Q",
        currentDays: 127, // каждый день
        generalDays: 32, // Sat (бит 5)
      },
    ],
  ]);
  const dates = buildDateKeys("2026-05-09", "2026-05-09"); // суббота
  const result = applyRoomScheduleToMatrix(
    config,
    dates,
    "fill-empty",
    dbRooms,
  );
  // Sat в обеих масках — должен победить general → "G"
  assert.equal(result.matrix["room-Q"]?.["2026-05-09"], "G");
});

test("fill-empty НЕ перезаписывает существующие отметки", () => {
  const config = {
    ...defaultCleaningDocumentConfig(),
    cleaningMode: "rooms" as const,
    selectedRoomIds: ["room-R"],
    rooms: [],
    matrix: { "room-R": { "2026-05-04": "/" } }, // менеджер пометил как «не проводилась»
  };
  const dbRooms = new Map<string, RoomScheduleFromDb>([
    [
      "room-R",
      { id: "room-R", currentDays: 127 },
    ],
  ]);
  const dates = buildDateKeys("2026-05-04", "2026-05-04");
  const result = applyRoomScheduleToMatrix(
    config,
    dates,
    "fill-empty",
    dbRooms,
  );
  // «/» сохранилось, не перетёрто на T
  assert.equal(result.matrix["room-R"]?.["2026-05-04"], "/");
});
