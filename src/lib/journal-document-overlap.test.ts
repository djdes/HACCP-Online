import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  findOverlappingDocument,
  periodsOverlap,
} from "@/lib/journal-document-overlap";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const period = (from: string, to: string) => ({
  dateFrom: d(from),
  dateTo: d(to),
});

describe("periodsOverlap", () => {
  it("одинаковые периоды", () => {
    // Ровно случай с прода: крон создал «1–15», руководитель создал
    // «1–15» ещё раз.
    assert.equal(
      periodsOverlap(period("2026-09-01", "2026-09-15"), period("2026-09-01", "2026-09-15")),
      true,
    );
  });

  it("один внутри другого", () => {
    assert.equal(
      periodsOverlap(period("2026-09-01", "2026-09-30"), period("2026-09-10", "2026-09-12")),
      true,
    );
  });

  it("общий один день на стыке — уже перекрытие", () => {
    // Отметка за 15-е попала бы в оба документа, и ни один не выглядел
    // бы заполненным целиком.
    assert.equal(
      periodsOverlap(period("2026-09-01", "2026-09-15"), period("2026-09-15", "2026-09-30")),
      true,
    );
  });

  it("соседние периоды без общего дня не пересекаются", () => {
    assert.equal(
      periodsOverlap(period("2026-09-01", "2026-09-15"), period("2026-09-16", "2026-09-30")),
      false,
    );
  });

  it("разные месяцы", () => {
    assert.equal(
      periodsOverlap(period("2026-09-01", "2026-09-30"), period("2026-10-01", "2026-10-31")),
      false,
    );
  });

  it("порядок аргументов не важен", () => {
    const a = period("2026-09-01", "2026-09-15");
    const b = period("2026-09-10", "2026-09-20");
    assert.equal(periodsOverlap(a, b), periodsOverlap(b, a));
  });
});

describe("findOverlappingDocument", () => {
  const active = {
    id: "d1",
    title: "Гигиенический журнал · Сентябрь с 1 по 15",
    ...period("2026-09-01", "2026-09-15"),
    status: "active",
  };

  it("находит активный документ на тот же период", () => {
    const got = findOverlappingDocument([active], period("2026-09-01", "2026-09-15"));
    assert.equal(got?.id, "d1");
  });

  it("закрытый документ не мешает новому", () => {
    // Закрытый — это уже сданный период; новый бланк рядом нормален.
    const closed = { ...active, status: "closed" };
    assert.equal(
      findOverlappingDocument([closed], period("2026-09-01", "2026-09-15")),
      null,
    );
  });

  it("непересекающийся период не считается дублем", () => {
    assert.equal(
      findOverlappingDocument([active], period("2026-09-16", "2026-09-30")),
      null,
    );
  });

  it("пустой список", () => {
    assert.equal(findOverlappingDocument([], period("2026-09-01", "2026-09-15")), null);
  });

  it("возвращает первый подходящий, а не последний", () => {
    const second = { ...active, id: "d2", title: "второй" };
    const got = findOverlappingDocument(
      [active, second],
      period("2026-09-05", "2026-09-10"),
    );
    assert.equal(got?.id, "d1");
  });

  it("документ без статуса считается действующим", () => {
    const noStatus = { id: "d9", title: "без статуса", ...period("2026-09-01", "2026-09-15") };
    assert.equal(
      findOverlappingDocument([noStatus], period("2026-09-02", "2026-09-03"))?.id,
      "d9",
    );
  });
});
