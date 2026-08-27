/**
 * Правила «сфера → журналы» — юридический контент, который правят руками.
 * Тест ловит опечатку в коде журнала: она не сломает сборку, но тихо
 * выкинет обязательный журнал из набора новой организации.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { ALL_JOURNAL_CODES } from "@/lib/onboarding-presets";
import { ORG_SPHERES, type OrgSphere } from "@/lib/org-profile";
import {
  PAPER_JOURNALS,
  SPHERE_RULES,
  defaultDisabledCodesFor,
  paperJournalsFor,
  requiredCodesFor,
} from "@/lib/sphere-journal-rules";

const spheres = ORG_SPHERES.map((item) => item.value as OrgSphere);
const catalogCodes = new Set<string>(ACTIVE_JOURNAL_CATALOG.map((item) => item.code));
const paperIds = new Set<string>(PAPER_JOURNALS.map((journal) => journal.id));

test("у каждой сферы из словаря есть правила", () => {
  for (const sphere of spheres) {
    assert.ok(SPHERE_RULES[sphere], `нет правил для сферы ${sphere}`);
  }
});

test("все коды журналов существуют в каталоге", () => {
  for (const sphere of spheres) {
    const rules = SPHERE_RULES[sphere];
    for (const rule of rules.electronicRequired) {
      assert.ok(
        catalogCodes.has(rule.code),
        `${sphere}: обязательный код ${rule.code} отсутствует в каталоге`,
      );
    }
    for (const code of rules.electronicRecommended) {
      assert.ok(
        catalogCodes.has(code),
        `${sphere}: рекомендованный код ${code} отсутствует в каталоге`,
      );
    }
  }
});

test("бумажные журналы ссылаются на существующие бланки", () => {
  for (const sphere of spheres) {
    for (const id of SPHERE_RULES[sphere].paperRequired) {
      assert.ok(paperIds.has(id), `${sphere}: нет бланка ${id}`);
    }
    assert.equal(
      paperJournalsFor(sphere).length,
      SPHERE_RULES[sphere].paperRequired.length,
    );
  }
});

test("у каждой сферы есть хотя бы один обязательный журнал", () => {
  for (const sphere of spheres) {
    assert.ok(
      requiredCodesFor(sphere).length > 0,
      `${sphere}: пустой обязательный набор`,
    );
  }
});

test("выключаем всё, кроме обязательного", () => {
  for (const sphere of spheres) {
    const required = new Set(requiredCodesFor(sphere));
    const disabled = new Set(defaultDisabledCodesFor(sphere));
    for (const code of ALL_JOURNAL_CODES) {
      assert.equal(
        disabled.has(code),
        !required.has(code),
        `${sphere}: код ${code} попал не в ту группу`,
      );
    }
  }
});

test("у бумажного бланка есть закон, штраф и колонки", () => {
  for (const journal of PAPER_JOURNALS) {
    assert.ok(journal.law.url.startsWith("https://"), journal.id);
    assert.ok(journal.fineHint.length > 0, journal.id);
    assert.ok(journal.columns.length >= 3, journal.id);
  }
});
