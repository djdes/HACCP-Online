/**
 * Regression: демо-организация не заполняет журналы БУДУЩИМ числом.
 *
 * Жалоба владельца 2026-09-07: в свежесозданном демо у бракеража
 * скоропортящейся продукции стояла «фактическая реализация» через два
 * дня после сегодняшнего поступления, а вечерние записи (мойка 17:10,
 * раздача 15:30) появлялись в демо, созданном в час дня.
 *
 * Правило: факт вносится, только когда его момент уже наступил.
 * Сроки годности (`expiryDate`, `shelfLifeDate`) — исключение: это
 * не факт, а срок, и он обязан смотреть вперёд.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDemoJournalSeed,
  type DemoJournalContext,
  type DemoStaff,
} from "@/lib/demo-organization-journals";
import { getDemoRoster } from "@/lib/demo-organization-roster";

const TODAY = "2026-09-07";
/** Демо создано в 13:00 — всё, что позже, ещё не произошло. */
const NOW_MINUTES = 13 * 60;

function buildContext(): DemoJournalContext {
  const roster = getDemoRoster("restaurant");
  const windowKeys = [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
    "2026-09-06",
    TODAY,
  ];
  const people: DemoStaff[] = roster.people.map((person, index) => ({
    ...person,
    id: `demo-user-${index}`,
  }));
  const pick = (predicate: (p: DemoStaff) => boolean) =>
    people.find(predicate) ?? people[0];

  return {
    documentId: "demo-doc",
    rawConfig: {},
    docDateFrom: new Date(`${windowKeys[0]}T00:00:00Z`),
    windowKeys,
    todayKey: TODAY,
    ago: (k) => windowKeys[windowKeys.length - 1 - k],
    happened: (dateKey, timeHm) => {
      if (!dateKey) return false;
      if (dateKey < TODAY) return true;
      if (dateKey > TODAY) return false;
      if (!timeHm) return true;
      const [h, m] = timeHm.split(":").map(Number);
      return h * 60 + (m || 0) <= NOW_MINUTES;
    },
    people,
    manager: pick((p) => p.role === "manager"),
    technologist: pick((p) => p.position === "Технолог"),
    chef: pick((p) => p.role === "head_chef"),
    cleaner: pick((p) => p.position === "Уборщик"),
    cook: pick((p) => /^Повар/.test(p.position)),
    storekeeper: pick((p) => p.position === "Кладовщик"),
    dishwasher: pick((p) => p.position === "Посудомойщик"),
    roster,
    organizationName: "Демо — Ресторан",
  };
}

/** Ключи, которым будущая дата положена по смыслу. */
const FUTURE_ALLOWED = new Set([
  "expiryDate",
  "shelfLifeDate",
  "dueDatePlan",
  "nextDate",
  "nextCalibrationDate",
  "nextServiceDate",
]);

function collectFutureDates(node: unknown, path: string, out: string[]) {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    const key = path.split(".").pop() ?? "";
    if (FUTURE_ALLOWED.has(key)) return;
    if (/^\d{4}-\d{2}-\d{2}/.test(node) && node.slice(0, 10) > TODAY) {
      out.push(`${path} = ${node}`);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectFutureDates(item, `${path}[]`, out);
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      collectFutureDates(value, path ? `${path}.${key}` : key, out);
    }
  }
}

describe("демо-журналы не заполняются вперёд", () => {
  it("бракераж скоропортящейся: реализация не позже сегодня", () => {
    const ctx = buildContext();
    const seed = buildDemoJournalSeed("perishable_rejection", ctx);
    const rows = (seed?.config as { rows: Array<Record<string, string>> }).rows;

    assert.ok(rows.length > 0, "строки вообще должны быть");
    for (const row of rows) {
      if (!row.actualSaleDate) continue;
      assert.ok(
        row.actualSaleDate <= TODAY,
        `реализация ${row.actualSaleDate} при сегодня ${TODAY}`,
      );
    }
    // Срок годности, наоборот, обязан смотреть вперёд.
    assert.ok(rows.some((row) => row.expiryDate > TODAY));
  });

  it("вечерние записи сегодняшнего дня не появляются в час дня", () => {
    const ctx = buildContext();

    const cleaning = buildDemoJournalSeed("equipment_cleaning", ctx);
    const cleaningToday = (cleaning?.rows ?? []).filter(
      (row) => (row.date as Date).toISOString().slice(0, 10) === TODAY,
    );
    assert.equal(cleaningToday.length, 0, "мойка в 16:30/17:10 ещё не состоялась");

    const finished = buildDemoJournalSeed("finished_product", ctx);
    const finishedRows = (finished?.config as {
      rows: Array<Record<string, string>>;
    }).rows;
    for (const row of finishedRows) {
      assert.ok(
        row.productionDateTime.slice(0, 10) < TODAY ||
          row.productionDateTime <= `${TODAY} 13:00`,
        `бракераж ${row.productionDateTime} ещё не наступил`,
      );
    }
  });

  it("ни один журнал не пишет факт будущим числом", () => {
    const ctx = buildContext();
    const codes = [
      "incoming_control",
      "finished_product",
      "perishable_rejection",
      "product_writeoff",
      "traceability_test",
      "equipment_cleaning",
      "staff_training",
      "ppe_issuance",
    ];
    for (const code of codes) {
      const seed = buildDemoJournalSeed(code, ctx);
      if (!seed) continue;
      const found: string[] = [];
      collectFutureDates(seed.config ?? null, "", found);
      assert.deepEqual(found, [], `${code}: факт будущим числом — ${found.join(", ")}`);
    }
  });
});
