import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SERVICES,
  formatServicePrice,
  groupServices,
  isInstantPayable,
  SERVICE_CATEGORY_ORDER,
} from "@/lib/services/catalog";

/**
 * `toLocaleString("ru-RU")` разделяет тысячи неразрывным пробелом
 * (U+00A0), а не обычным. В вёрстке это правильно — «15 000» не
 * разорвётся по строкам, — но сравнивать с литералом в тесте мешает.
 */
function normalizeSpaces(value: string): string {
  return value.replace(/ /g, " ");
}

test("стартовый каталог непротиворечив", () => {
  const keys = new Set<string>();
  for (const service of DEFAULT_SERVICES) {
    assert.equal(keys.has(service.key), false, `дубль ключа ${service.key}`);
    keys.add(service.key);
    assert.ok(service.title.length > 0);
    assert.ok(service.summary.length > 0, `${service.key}: нет краткого описания`);
    assert.ok(service.description.length > 0, `${service.key}: нет подробностей`);
    assert.ok(
      (SERVICE_CATEGORY_ORDER as string[]).includes(service.category),
      `${service.key}: неизвестная категория`
    );
    if (service.priceRub !== null) assert.ok(service.priceRub > 0);
  }
});

test("настройка журналов стоит 5000 ₽ фиксированно и платится баллами", () => {
  const setup = DEFAULT_SERVICES.find((item) => item.key === "journals-setup");
  assert.ok(setup);
  assert.equal(setup.priceRub, 5000);
  assert.equal(setup.priceFrom, false);
  assert.equal(isInstantPayable(setup), true);
  assert.equal(normalizeSpaces(formatServicePrice(setup)), "5 000 ₽ за услугу");
});

test("цена «от» и «по запросу» баллами не списывается", () => {
  const audit = DEFAULT_SERVICES.find((item) => item.key === "pre-inspection-audit");
  assert.ok(audit);
  assert.equal(audit.priceFrom, true);
  assert.equal(isInstantPayable(audit), false);
  assert.equal(normalizeSpaces(formatServicePrice(audit)), "от 15 000 ₽ за аудит");

  const layout = DEFAULT_SERVICES.find((item) => item.key === "layout-planning");
  assert.ok(layout);
  assert.equal(layout.priceRub, null);
  assert.equal(isInstantPayable(layout), false);
  assert.equal(normalizeSpaces(formatServicePrice(layout)), "Цена по запросу");
});

test("услуги, названные владельцем, есть в каталоге", () => {
  for (const key of ["journals-setup", "consulting", "site-visit", "supervision"]) {
    assert.ok(
      DEFAULT_SERVICES.some((item) => item.key === key),
      `нет услуги ${key}`
    );
  }
});

test("группировка не теряет и не дублирует услуги", () => {
  const groups = groupServices(DEFAULT_SERVICES);
  const flat = groups.flatMap((group) => group.items);
  assert.equal(flat.length, DEFAULT_SERVICES.length);
  assert.equal(new Set(flat.map((item) => item.key)).size, flat.length);
  // Пустые категории в вывод не попадают.
  assert.ok(groups.every((group) => group.items.length > 0));
});

test("нулевая цена не считается оплачиваемой", () => {
  assert.equal(isInstantPayable({ priceRub: 0, priceFrom: false }), false);
  assert.equal(isInstantPayable({ priceRub: null, priceFrom: false }), false);
});
