import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  buildJournalDocumentTitle,
  formatJournalPeriodLabel,
} from "./journal-document-title";

describe("formatJournalPeriodLabel", () => {
  it("весь месяц — именительный падеж без чисел", () => {
    assert.equal(formatJournalPeriodLabel("2026-09-01", "2026-09-30"), "сентябрь 2026");
    // Февраль високосного и обычного года — граница считается без Date.
    assert.equal(formatJournalPeriodLabel("2024-02-01", "2024-02-29"), "февраль 2024");
    assert.equal(formatJournalPeriodLabel("2026-02-01", "2026-02-28"), "февраль 2026");
  });

  it("половина месяца — «1–15 сентября 2026»", () => {
    assert.equal(formatJournalPeriodLabel("2026-09-01", "2026-09-15"), "1–15 сентября 2026");
    assert.equal(formatJournalPeriodLabel("2026-09-16", "2026-09-30"), "16–30 сентября 2026");
  });

  it("один день — без диапазона", () => {
    assert.equal(formatJournalPeriodLabel("2026-09-07", "2026-09-07"), "7 сентября 2026");
    // Дата окончания вообще не задана (годовые и «однодневные» журналы).
    assert.equal(formatJournalPeriodLabel("2026-09-07"), "7 сентября 2026");
    assert.equal(formatJournalPeriodLabel("2026-09-07", ""), "7 сентября 2026");
  });

  it("период через границу месяцев", () => {
    assert.equal(
      formatJournalPeriodLabel("2026-09-25", "2026-10-08"),
      "25 сентября – 8 октября 2026"
    );
  });

  it("период через границу лет — год у обеих дат", () => {
    assert.equal(
      formatJournalPeriodLabel("2026-12-25", "2027-01-08"),
      "25 декабря 2026 – 8 января 2027"
    );
  });

  it("весь календарный год — «2026 год»", () => {
    assert.equal(formatJournalPeriodLabel("2026-01-01", "2026-12-31"), "2026 год");
  });

  it("перевёрнутый и битый период не ломают название", () => {
    // Дата окончания раньше начала — считаем периодом один день начала.
    assert.equal(formatJournalPeriodLabel("2026-09-15", "2026-09-01"), "15 сентября 2026");
    assert.equal(formatJournalPeriodLabel("", ""), "");
    assert.equal(formatJournalPeriodLabel("27.08.2026", ""), "");
    assert.equal(formatJournalPeriodLabel("2026-13-01", "2026-13-05"), "");
    assert.equal(formatJournalPeriodLabel("2026-02-30", "2026-03-01"), "");
    assert.equal(formatJournalPeriodLabel(null, undefined), "");
  });
});

describe("buildJournalDocumentTitle", () => {
  it("склеивает название журнала и период", () => {
    assert.equal(
      buildJournalDocumentTitle({
        journalName: "Гигиенический журнал",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-15",
      }),
      "Гигиенический журнал — 1–15 сентября 2026"
    );
    assert.equal(
      buildJournalDocumentTitle({
        journalName: "Гигиенический журнал",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-30",
      }),
      "Гигиенический журнал — сентябрь 2026"
    );
    assert.equal(
      buildJournalDocumentTitle({
        journalName: "Журнал уборки",
        dateFrom: "2026-09-07",
        dateTo: "2026-09-07",
      }),
      "Журнал уборки — 7 сентября 2026"
    );
    assert.equal(
      buildJournalDocumentTitle({
        journalName: "Журнал уборки",
        dateFrom: "2026-09-25",
        dateTo: "2026-10-08",
      }),
      "Журнал уборки — 25 сентября – 8 октября 2026"
    );
  });

  it("без периода остаётся одно название журнала", () => {
    assert.equal(
      buildJournalDocumentTitle({ journalName: "Журнал уборки", dateFrom: "" }),
      "Журнал уборки"
    );
    assert.equal(
      buildJournalDocumentTitle({ journalName: "  ", dateFrom: "2026-09-07" }),
      "7 сентября 2026"
    );
    assert.equal(buildJournalDocumentTitle({ journalName: "", dateFrom: "" }), "");
  });
});
