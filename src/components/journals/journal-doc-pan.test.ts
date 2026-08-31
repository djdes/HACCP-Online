import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { JOURNAL_TABLE_VIEWPORT_CLASS } from "@/components/journals/journal-responsive";

/**
 * Инварианты сквозной горизонтальной прокрутки документа на мобильном.
 *
 * Механика держится на трёх файлах сразу, и связь между ними — по
 * селекторам, а не по импортам. Развалить её можно, ничего не сломав в
 * типах: убрать атрибут, вернуть blanket-правило, переименовать класс.
 * Эти проверки ловят такое до прода, где иначе всё увидит владелец.
 */

const CSS = readFileSync("src/app/globals.css", "utf8");
const LAYOUT = readFileSync(
  "src/app/(dashboard)/journals/[code]/documents/[docId]/layout.tsx",
  "utf8"
);
const PAGE = readFileSync(
  "src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx",
  "utf8"
);

test("layout marks the pan zone and makes it full-bleed", () => {
  assert.match(LAYOUT, /data-journal-doc-pan/);
  assert.match(LAYOUT, /max-sm:overflow-x-auto/);
  // -mx-4 гасит px-4 контейнера раздела: без него скроллер оказывается
  // узким окном внутри отступов, и таблица выглядит обрезанной.
  assert.match(LAYOUT, /max-sm:-mx-4/);
});

test("pan zone does not use w-screen", () => {
  // 100vw включает ширину полосы прокрутки и даёт лишние пиксели
  // переполнения. Родитель на мобильном и так во всю ширину.
  assert.doesNotMatch(LAYOUT, /max-sm:w-screen/);
});

test("breadcrumbs live in the layout, outside the pan zone", () => {
  // Пока крошки рендерила страница, они лежали внутри скроллера и
  // уезжали вместе с бланком.
  assert.match(LAYOUT, /JournalPageCrumbs/);
  assert.doesNotMatch(PAGE, /JournalPageCrumbs/);
});

test("the global wide-table hack skips the document page", () => {
  // Правило матчит КАЖДОГО предка таблицы и стоит с !important:
  // utility-классом его не перебить. Без исключения каждый div вокруг
  // бланка становится своим скроллером, и жест ловит внутренний.
  const hack = CSS.slice(CSS.indexOf('div:has(table[class*="min-w-"])') - 200);
  assert.match(hack, /main:not\(:has\(\[data-journal-doc-pan\]\)\)/);
});

test("the pan zone kills nested horizontal scrollers", () => {
  assert.match(
    CSS,
    /\[data-journal-doc-pan\] div\.overflow-x-auto:has\(table\)/,
    "зона гашения вложенных скроллеров пропала"
  );
  assert.match(CSS, /\[data-journal-doc-pan\] \.sticky\.left-0/);
});

test("the shared table token still carries the class the CSS zone targets", () => {
  // Зона ловит таблицы по литеральному `overflow-x-auto`. Переименуют
  // класс в токене — зона молча перестанет их накрывать.
  assert.match(JOURNAL_TABLE_VIEWPORT_CLASS, /overflow-x-auto/);
});

test("the pan zone rules are screen-only", () => {
  // Бланк печатают на бумагу: экранные правила прокрутки не должны
  // попасть в печать.
  const zoneStart = CSS.indexOf("[data-journal-doc-pan] div.overflow-x-auto");
  const mediaBefore = CSS.lastIndexOf("@media", zoneStart);
  assert.match(CSS.slice(mediaBefore, zoneStart), /screen and \(max-width/);
});
