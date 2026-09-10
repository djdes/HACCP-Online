import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { JOURNAL_INFO } from "@/content/journal-info";
import { JOURNAL_SEO } from "@/content/journal-seo";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { journalHeadline } from "@/lib/journal-headline";

describe("journalHeadline", () => {
  it("отрезает уточнение после тире", () => {
    assert.equal(
      journalHeadline("Гигиенический журнал — образец для общепита", "x", "y"),
      "Гигиенический журнал"
    );
  });

  it("отрезает уточнение после двоеточия", () => {
    assert.equal(
      journalHeadline("Журнал уборки: как вести и кто заполняет", "x", "y"),
      "Журнал уборки"
    );
  });

  it("не режет дефис внутри слова", () => {
    assert.equal(
      journalHeadline("Чек-лист проветривания помещений", "x", "y"),
      "Чек-лист проветривания помещений"
    );
  });

  it("предпочитает seo-заголовок канцелярскому названию каталога", () => {
    // Каталог зовёт это «Акт забраковки», ищут — «журнал списания».
    assert.equal(
      journalHeadline("Журнал списания продукции", "Акт забраковки", "y"),
      "Журнал списания продукции"
    );
  });

  it("падает на каталог, потом на tagline, и убирает точку в конце", () => {
    assert.equal(journalHeadline(undefined, "Журнал уборки", "y"), "Журнал уборки");
    assert.equal(
      journalHeadline(undefined, undefined, "Акт списания продукции."),
      "Акт списания продукции"
    );
    assert.equal(journalHeadline("   ", "  ", "Запасной."), "Запасной");
  });

  it("на всём каталоге даёт непустой заголовок без точки в конце", () => {
    const names = new Map<string, string>(
      ACTIVE_JOURNAL_CATALOG.map((j) => [j.code, j.name])
    );
    for (const info of Object.values(JOURNAL_INFO)) {
      const h1 = journalHeadline(
        JOURNAL_SEO[info.code]?.title,
        names.get(info.code),
        info.tagline
      );
      assert.ok(h1.length > 0, `пустой h1 у ${info.code}`);
      assert.ok(!h1.endsWith("."), `точка в конце h1 у ${info.code}: ${h1}`);
    }
  });

  it("почти у всех журналов заголовок называет сущность словом-типом", () => {
    // Не жёсткое требование ко всем: часть журналов законно зовётся
    // «Перечень», «График», «Чек-лист», «Акт», «Протокол», «План».
    // «Бракераж» тоже входит: это самостоятельное название документа,
    // и по нему идут отдельные запросы («бракераж готовой продукции»).
    const names = new Map<string, string>(
      ACTIVE_JOURNAL_CATALOG.map((j) => [j.code, j.name])
    );
    const TYPE = /журнал|бланк|график|чек-лист|акт|перечень|протокол|план|отчёт|ведомост|карт|лист|реестр|программ|бракераж/i;
    const bad = Object.values(JOURNAL_INFO)
      .map((info) => ({
        code: info.code,
        h1: journalHeadline(
          JOURNAL_SEO[info.code]?.title,
          names.get(info.code),
          info.tagline
        ),
      }))
      .filter((x) => !TYPE.test(x.h1));
    assert.deepEqual(bad, [], `заголовок не называет тип документа: ${JSON.stringify(bad)}`);
  });
});
