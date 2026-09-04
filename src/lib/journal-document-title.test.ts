import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  buildDocumentAutoTitle,
  buildJournalDocumentTitle,
  formatJournalPeriodLabel,
  getDocumentTitlePeriod,
  uniqueDocumentTitle,
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

describe("getDocumentTitlePeriod", () => {
  it("годовой журнал — весь год из селекта «Год»", () => {
    assert.deepEqual(getDocumentTitlePeriod("audit_plan", { dateFrom: "2026-09-07", year: 2027 }), {
      dateFrom: "2027-01-01",
      dateTo: "2027-12-31",
    });
  });

  it("годовой журнал без «Года» — год выбранной даты", () => {
    assert.deepEqual(
      getDocumentTitlePeriod("accident_journal", { dateFrom: "2026-09-07", dateTo: "2026-09-07" }),
      { dateFrom: "2026-01-01", dateTo: "2026-12-31" }
    );
  });

  it("бессрочный журнал — без периода", () => {
    assert.equal(getDocumentTitlePeriod("disinfectant_usage", { dateFrom: "2026-09-07" }), null);
    assert.equal(getDocumentTitlePeriod("glass_control", { dateFrom: "2026-09-07" }), null);
  });

  it("полумесячный — как пришло", () => {
    assert.deepEqual(getDocumentTitlePeriod("cleaning", { dateFrom: "2026-09-16", dateTo: "2026-09-30" }), {
      dateFrom: "2026-09-16",
      dateTo: "2026-09-30",
    });
  });

  it("месячный с одной датой — календарный месяц", () => {
    assert.deepEqual(getDocumentTitlePeriod("metal_impurity", { dateFrom: "2026-02-07" }), {
      dateFrom: "2026-02-01",
      dateTo: "2026-02-28",
    });
    assert.deepEqual(
      getDocumentTitlePeriod("incoming_control", { dateFrom: "2026-09-07", dateTo: "2026-09-07" }),
      { dateFrom: "2026-09-01", dateTo: "2026-09-30" }
    );
  });

  it("месячный с реальным диапазоном — без изменений; полный ISO режется до дня", () => {
    assert.deepEqual(
      getDocumentTitlePeriod("climate_control", {
        dateFrom: "2026-09-01T00:00:00.000Z",
        dateTo: "2026-09-30T00:00:00.000Z",
      }),
      { dateFrom: "2026-09-01", dateTo: "2026-09-30" }
    );
  });

  it("мусор вместо даты — null", () => {
    assert.equal(getDocumentTitlePeriod("metal_impurity", { dateFrom: "" }), null);
    assert.equal(getDocumentTitlePeriod("audit_plan", { dateFrom: "nope" }), null);
  });
});

describe("uniqueDocumentTitle", () => {
  it("свободное название — без изменений", () => {
    assert.equal(
      uniqueDocumentTitle("Журнал уборки — сентябрь 2026", ["Другое"]),
      "Журнал уборки — сентябрь 2026"
    );
  });

  it("занято — « (2)», занято и оно — « (3)»", () => {
    assert.equal(uniqueDocumentTitle("Журнал", ["Журнал"]), "Журнал (2)");
    assert.equal(uniqueDocumentTitle("Журнал", ["Журнал", "Журнал (2)"]), "Журнал (3)");
  });

  it("регистр и пробелы не учитываются", () => {
    assert.equal(uniqueDocumentTitle("Журнал ", ["  журнал"]), "Журнал (2)");
  });

  it("пустая база — пустая строка", () => {
    assert.equal(uniqueDocumentTitle("   ", ["x"]), "");
  });
});

describe("buildDocumentAutoTitle", () => {
  it("уборка: имя + полумесяц + суффикс", () => {
    assert.equal(
      buildDocumentAutoTitle({
        templateCode: "cleaning",
        journalName: "Журнал уборки",
        dateFrom: "2026-09-01",
        dateTo: "2026-09-15",
        existingTitles: ["Журнал уборки — 1–15 сентября 2026"],
      }),
      "Журнал уборки — 1–15 сентября 2026 (2)"
    );
  });

  it("годовой: «2026 год»", () => {
    assert.equal(
      buildDocumentAutoTitle({
        templateCode: "training_plan",
        journalName: "План обучения",
        dateFrom: "2026-09-07",
        year: "2026",
      }),
      "План обучения — 2026 год"
    );
  });

  it("бессрочный: только имя", () => {
    assert.equal(
      buildDocumentAutoTitle({
        templateCode: "intensive_cooling",
        journalName: "Журнал контроля",
        dateFrom: "2026-09-07",
      }),
      "Журнал контроля"
    );
  });
});
