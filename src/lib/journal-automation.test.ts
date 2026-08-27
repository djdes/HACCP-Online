/**
 * Тесты автоматизации журналов:
 *   - чтение/запись `Organization.journalAutomationJson` с fallback на
 *     легаси-список `autoJournalCodes`;
 *   - `isEntryDataEmpty({_autoSeeded:true}) === true` — без этого
 *     автосозданный документ никогда не автозаполняется;
 *   - матрица `isCellLocked` / `canEditAutomationCell`
 *     (вчера/сегодня/завтра × роль × autoFill).
 *
 * Запуск: node --import tsx --test --test-reporter=spec "src/lib/journal-automation.test.ts"
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTOMATION_DEFAULT_ON_CODES,
  defaultJournalAutomationJson,
  getJournalAutomation,
  isAutomationDefaultOn,
  isAutomationSupported,
  isJournalAutomationEnabled,
  listAutomationCodes,
  listAutomationOwnedCodes,
  parseJournalAutomationJson,
  withJournalAutomation,
} from "@/lib/journal-automation";
import { isEntryDataEmpty } from "@/lib/hygiene-document";
import {
  canEditAutomationCell,
  isCellLocked,
  type AutomationLockContext,
} from "@/lib/closed-day";

test("parseJournalAutomationJson выбрасывает мусор", () => {
  assert.deepEqual(parseJournalAutomationJson(null), {});
  assert.deepEqual(parseJournalAutomationJson([1, 2]), {});
  assert.deepEqual(
    parseJournalAutomationJson({ hygiene: { autoCreate: true, autoFill: "да" } }),
    { hygiene: { autoCreate: true, autoFill: false } }
  );
});

test("getJournalAutomation падает на легаси autoJournalCodes", () => {
  const org = { journalAutomationJson: {}, autoJournalCodes: ["cleaning"] };
  assert.deepEqual(getJournalAutomation(org, "cleaning"), {
    autoCreate: true,
    autoFill: false,
  });
  assert.deepEqual(getJournalAutomation(org, "hygiene"), {
    autoCreate: false,
    autoFill: false,
  });
});

test("явная настройка побеждает легаси-список", () => {
  const org = {
    journalAutomationJson: { hygiene: { autoCreate: false, autoFill: false } },
    autoJournalCodes: ["hygiene"],
  };
  assert.equal(getJournalAutomation(org, "hygiene").autoCreate, false);
  assert.equal(isJournalAutomationEnabled(org, "hygiene"), false);
});

test("isJournalAutomationEnabled требует ОБА флага", () => {
  const half = { journalAutomationJson: { hygiene: { autoCreate: true, autoFill: false } } };
  const full = { journalAutomationJson: { hygiene: { autoCreate: true, autoFill: true } } };
  assert.equal(isJournalAutomationEnabled(half, "hygiene"), false);
  assert.equal(isJournalAutomationEnabled(full, "hygiene"), true);
});

test("withJournalAutomation не мутирует исходную карту", () => {
  const current = { hygiene: { autoCreate: true, autoFill: true } };
  const next = withJournalAutomation(current, "health_check", {
    autoCreate: true,
    autoFill: false,
  });
  assert.deepEqual(Object.keys(current), ["hygiene"]);
  assert.deepEqual(next.health_check, { autoCreate: true, autoFill: false });
});

test("дефолты новой организации включают журналы из AUTOMATION_DEFAULT_ON_CODES", () => {
  const defaults = defaultJournalAutomationJson();
  for (const code of AUTOMATION_DEFAULT_ON_CODES) {
    assert.equal(isAutomationDefaultOn(code), true);
    assert.equal(isAutomationSupported(code), true);
    assert.deepEqual(defaults[code], { autoCreate: true, autoFill: true });
  }
  assert.equal(isAutomationDefaultOn("cleaning"), false);
});

test("listAutomationCodes объединяет карту и легаси-список", () => {
  const org = {
    journalAutomationJson: { hygiene: { autoCreate: true, autoFill: true } },
    autoJournalCodes: ["cleaning", "hygiene"],
  };
  assert.deepEqual(
    listAutomationCodes(org).map((row) => row.code),
    ["cleaning", "hygiene"]
  );
  // «Владеет» cron автоматизации только теми, где включены оба флага.
  assert.deepEqual(listAutomationOwnedCodes(org), ["hygiene"]);
});

test("isEntryDataEmpty считает _autoSeeded-болванку пустой", () => {
  assert.equal(isEntryDataEmpty({ _autoSeeded: true }), true);
  assert.equal(isEntryDataEmpty({}), true);
  assert.equal(isEntryDataEmpty(null), true);
  assert.equal(isEntryDataEmpty({ status: "healthy" }), false);
  assert.equal(
    isEntryDataEmpty({ _autoSeeded: true, status: "healthy" }),
    false
  );
});

const NOW = new Date("2026-08-27T09:00:00.000Z");
const YESTERDAY = "2026-08-26";
const TODAY = "2026-08-27";
const TOMORROW = "2026-08-28";

const AUTO: AutomationLockContext = {
  documentAutoFill: true,
  automationEnabled: true,
  shiftEndHour: 0,
};
const MANUAL: AutomationLockContext = { ...AUTO, documentAutoFill: false };
const OFF: AutomationLockContext = { ...AUTO, automationEnabled: false };

test("isCellLocked запирает только прошлые дни автодокумента", () => {
  assert.equal(isCellLocked(YESTERDAY, AUTO, NOW), true);
  assert.equal(isCellLocked(TODAY, AUTO, NOW), false);
  assert.equal(isCellLocked(TOMORROW, AUTO, NOW), false);
  // Ручной документ и выключенная автоматика — правило не действует.
  assert.equal(isCellLocked(YESTERDAY, MANUAL, NOW), false);
  assert.equal(isCellLocked(YESTERDAY, OFF, NOW), false);
});

test("canEditAutomationCell: прошлый день закрыт для всех, ROOT — override", () => {
  const cases: Array<[string, boolean, boolean, boolean]> = [
    // role, isRoot, ожидаемый allowed, ожидаемый isOverride
    ["cook", false, false, false],
    ["manager", false, false, false],
    ["head_chef", false, false, false],
    ["owner", false, false, false],
    ["manager", true, true, true],
  ];
  for (const [role, isRoot, allowed, isOverride] of cases) {
    const decision = canEditAutomationCell(YESTERDAY, { role, isRoot }, AUTO, NOW);
    assert.equal(decision.allowed, allowed, `${role}/${isRoot}`);
    assert.equal(decision.isOverride, isOverride, `${role}/${isRoot}`);
  }

  // Сегодня — свободно всем.
  const today = canEditAutomationCell(TODAY, { role: "cook", isRoot: false }, AUTO, NOW);
  assert.deepEqual(today, { allowed: true, reason: "ok", isOverride: false });
});

test("shiftEndHour сдвигает границу «сегодня»", () => {
  // Смена заканчивается в 06:00; сейчас 03:00 UTC ⇒ «сегодня» — это ещё
  // 26-е, и вчерашняя (25-е) ячейка заперта, а 26-я нет.
  const nightNow = new Date("2026-08-27T03:00:00.000Z");
  const ctx: AutomationLockContext = { ...AUTO, shiftEndHour: 6 };
  assert.equal(isCellLocked("2026-08-26", ctx, nightNow), false);
  assert.equal(isCellLocked("2026-08-25", ctx, nightNow), true);
});
