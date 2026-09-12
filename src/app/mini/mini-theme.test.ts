import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const CSS = readFileSync("src/app/mini/mini-theme.css", "utf8");

/**
 * Сторож для `mini-theme.css`.
 *
 * Проверяется не вкус, а две вещи, которые ломались молча и были видны
 * только на телефоне — то есть не в типах, не в тестах и не в dev на
 * ноутбуке. Связь здесь по тексту файла, а не по импортам, поэтому
 * обычный тест её не поймал бы.
 */
describe("mini-theme: позиционирование прямых детей", () => {
  it("возвращает position тем, кто задаёт его сам", () => {
    // `.mini-root > *` задаёт position всем детям и тем самым перебивает
    // утилиты `.fixed` и `.sticky` — вес одинаковый, решает порядок
    // файлов. Из-за этого нижняя навигация уезжала в конец документа, а
    // шапка переставала быть липкой: выглядело как отсутствие навигации.
    for (const selector of [
      ".mini-root > .fixed",
      ".mini-root > .sticky",
      ".mini-root > .absolute",
    ]) {
      assert.ok(
        CSS.includes(selector),
        `нет возврата позиционирования: ${selector}`
      );
    }
  });

  it("общее правило про стопку слоёв осталось", () => {
    // Без него содержимое уходит под фоновые слои свечения и зерна.
    assert.match(CSS, /\.mini-root > \*\s*\{[^}]*z-index:\s*1/);
  });
});

describe("mini-theme: токены", () => {
  it("держит безопасные поля, слои и движение в одном месте", () => {
    for (const token of [
      "--mini-safe-t",
      "--mini-safe-b",
      "--mini-z-topbar",
      "--mini-z-nav",
      "--mini-z-overlay",
      "--mini-ease",
      "--mini-dur-fast",
    ]) {
      assert.ok(CSS.includes(token), `пропал токен ${token}`);
    }
  });

  it("не запрещает выделять значения журналов", () => {
    // `user-select: none` можно вешать только на элементы управления:
    // температуру и номер партии человек должен уметь скопировать.
    // Разбираем файл по правилам вручную: флаг `s` недоступен в целевой
    // версии, а без него точка не перешагнёт перенос строки.
    const rules = CSS.split("}");
    const blocked = rules.filter((rule) => /user-select:\s*none/.test(rule));
    for (const rule of blocked) {
      const selector = rule.slice(rule.lastIndexOf("\n", rule.indexOf("{"))).split("{")[0];
      assert.ok(
        /mini-press|mini-nav-rail|mini-topbar|mini-pill/.test(selector),
        `user-select: none на слишком широком селекторе: ${selector.trim()}`
      );
    }
  });
});
