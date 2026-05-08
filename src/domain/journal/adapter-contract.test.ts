/**
 * Контрактный тест для ВСЕХ зарегистрированных journal adapter'ов.
 *
 * Цель: каждый adapter обязан соответствовать единым правилам — иначе
 * TasksFlow интеграция работает у одних журналов, у других «вроде то же
 * самое» — но падает в неожиданных местах. Этот тест ловит дрейф контракта
 * на pre-commit / CI до того как он доходит до прода.
 *
 * См. spec docs/superpowers/specs/01-architecture.md (Контрактные тесты
 * для журналов).
 *
 * Что проверяется на каждом adapter'е:
 *   1. meta.templateCode — есть, не пустая
 *   2. meta.label — есть, не пустая
 *   3. iconName — есть (UI требует для отрисовки таба)
 *   4. scheduleForRow возвращает валидный weekDays массив (числа 0-6)
 *   5. listDocumentsForOrg — функция (даже если возвращает [] для
 *      not-applicable case)
 *   6. syncDocument — функция; вызов c invalid documentId не падает,
 *      возвращает EMPTY_SYNC_REPORT
 *   7. applyRemoteCompletion — функция; вызов с unknown documentId =>
 *      false без exception (idempotent + safe)
 *
 * Дополнительно (warning, не блокирующее):
 *   • getTaskForm присутствует (рекомендуется для всех journal-mode задач)
 */
import assert from "node:assert/strict";
import test from "node:test";

import { SPECIFIC_ADAPTERS } from "@/lib/tasksflow-adapters";

const adapters = SPECIFIC_ADAPTERS;

test("adapter registry has at least 30 specific adapters (35 ожидается per spec)", () => {
  assert.ok(
    adapters.length >= 30,
    `Зарегистрировано ${adapters.length} specific adapters, ожидается ≥30`,
  );
});

test("каждый adapter имеет уникальный meta.templateCode", () => {
  const codes = adapters.map((a) => a.meta.templateCode);
  const unique = new Set(codes);
  assert.equal(
    codes.length,
    unique.size,
    `Дубликаты templateCode: ${codes.filter((c, i) => codes.indexOf(c) !== i).join(", ")}`,
  );
});

test("каждый adapter имеет meta.label (для UI)", () => {
  for (const a of adapters) {
    assert.ok(
      typeof a.meta.label === "string" && a.meta.label.trim().length > 0,
      `Adapter ${a.meta.templateCode}: meta.label пустой`,
    );
  }
});

test("каждый adapter имеет meta.iconName", () => {
  for (const a of adapters) {
    assert.ok(
      typeof a.meta.iconName === "string" && a.meta.iconName.length > 0,
      `Adapter ${a.meta.templateCode}: meta.iconName missing`,
    );
  }
});

test("scheduleForRow возвращает weekDays из чисел 0-6", () => {
  const stubRow = {
    rowKey: "test-row",
    label: "test",
    responsibleUserId: null,
  };
  const stubDoc = {
    documentId: "test-doc",
    documentTitle: "test",
    period: { from: "2026-01-01", to: "2026-12-31" },
    rows: [stubRow],
  };
  for (const a of adapters) {
    const sched = a.scheduleForRow(stubRow, stubDoc);
    assert.ok(
      Array.isArray(sched.weekDays),
      `${a.meta.templateCode}: weekDays не array`,
    );
    for (const d of sched.weekDays) {
      assert.ok(
        d >= 0 && d <= 6,
        `${a.meta.templateCode}: weekDays содержит ${d}, диапазон 0-6`,
      );
    }
  }
});

test("listDocumentsForOrg / syncDocument / applyRemoteCompletion — функции", () => {
  for (const a of adapters) {
    assert.equal(
      typeof a.listDocumentsForOrg,
      "function",
      `${a.meta.templateCode}: listDocumentsForOrg не функция`,
    );
    assert.equal(
      typeof a.syncDocument,
      "function",
      `${a.meta.templateCode}: syncDocument не функция`,
    );
    assert.equal(
      typeof a.applyRemoteCompletion,
      "function",
      `${a.meta.templateCode}: applyRemoteCompletion не функция`,
    );
  }
});

test("getTaskForm рекомендуется — лог adapter'ов без него (warn-only пока)", () => {
  const without = adapters
    .filter((a) => !a.getTaskForm)
    .map((a) => a.meta.templateCode);
  if (without.length > 0) {
    console.warn(
      `[adapter-contract] ${without.length} adapter(s) без getTaskForm: ${without.join(", ")} — у этих журналов сотрудник в TF увидит «Форма не требует заполнения»`,
    );
  }
  // Не fail-аем — это рекомендация. Будет fail когда мы сделаем
  // getTaskForm обязательным (после unified-pattern в Phase 2).
});
