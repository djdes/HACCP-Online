import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { renderWeeklyDigestEmail, renderWeeklyDigestTelegram, type WeeklyDigestData } from "@/lib/weekly-digest/render";

const data: WeeklyDigestData = {
  orgName: "Кафе <Тест>",
  weekStart: "2026-09-07",
  weekEnd: "2026-09-14",
  compliancePct: 72,
  filledSlots: 36,
  totalSlots: 50,
  bottomTemplates: [{ name: "Гигиена", missed: 3 }],
  topEmployeeName: "Иванова",
  topEmployeeCount: 21,
  tfDone: 4,
  tfStuck: 1,
  incidents: { total: 2, open: 1 },
  absentEmployees: ["Петров"],
  expiring: [{ date: "2026-09-20", title: "Медкнижка: Петров — Терапевт" }],
};

describe("renderWeeklyDigestEmail", () => {
  it("тема с процентом, все разделы и экранирование", () => {
    const { subject, html } = renderWeeklyDigestEmail(data, "https://wesetup.ru");
    assert.equal(subject, "Сводка за неделю · Кафе <Тест>: заполнено 72%");
    assert.ok(html.includes("Кафе &lt;Тест&gt;"));
    assert.ok(html.includes("72%"));
    assert.ok(html.includes("Гигиена — 3 дн."));
    assert.ok(html.includes("Не отмечались всю неделю"));
    assert.ok(html.includes("Петров"));
    assert.ok(html.includes("20.09 — Медкнижка: Петров — Терапевт"));
    assert.ok(html.includes("не закрыто 1"));
    assert.ok(html.includes("https://wesetup.ru/settings/notifications"));
  });
  it("пустые разделы описаны словами, а не пропущены молча", () => {
    const { html } = renderWeeklyDigestEmail({ ...data, absentEmployees: [], expiring: [], incidents: { total: 0, open: 0 } }, "https://x");
    assert.ok(html.includes("Все сотрудники отмечались."));
    assert.ok(html.includes("Ничего не истекает."));
    assert.ok(html.includes("не было"));
  });
});

describe("renderWeeklyDigestTelegram", () => {
  it("те же разделы в HTML Telegram", () => {
    const text = renderWeeklyDigestTelegram(data);
    assert.ok(text.includes("Кафе &lt;Тест&gt;"));
    assert.ok(text.includes("Заполнено: <b>72%</b>"));
    assert.ok(text.includes("Не отмечались всю неделю:</b> Петров"));
    assert.ok(text.includes("20.09 — Медкнижка: Петров — Терапевт"));
  });
});
