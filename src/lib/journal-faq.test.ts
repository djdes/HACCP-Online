import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { JOURNAL_INFO } from "@/content/journal-info";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { buildJournalFaq, journalFaqJsonLd } from "@/lib/journal-faq";

const hygiene = JOURNAL_INFO.hygiene;

describe("buildJournalFaq", () => {
  it("подставляет название журнала в вопросы", () => {
    const faq = buildJournalFaq(hygiene, "Гигиенический журнал");
    assert.ok(faq.some((i) => i.q.includes("гигиенический журнал")));
  });

  it("переносит графы журнала в ответ", () => {
    const faq = buildJournalFaq(hygiene, "Гигиенический журнал");
    const fields = faq.find((i) => i.q.startsWith("Что писать"));
    assert.ok(fields);
    assert.match(fields.a, /ФИО сотрудника/);
  });

  it("даёт разную периодичность ежедневным и периодическим журналам", () => {
    const daily = buildJournalFaq(hygiene, "Гигиенический журнал");
    const periodic = buildJournalFaq(
      { ...hygiene, category: "sanpin_periodic" },
      "Журнал уборки"
    );
    const q = (list: typeof daily) =>
      list.find((i) => i.q.startsWith("Как часто"))?.a;
    assert.notEqual(q(daily), q(periodic));
  });

  it("не падает на журнале без граф и норматива", () => {
    const bare = { ...hygiene, whatToFill: [], normative: [] };
    const faq = buildJournalFaq(bare, "Журнал X");
    assert.ok(faq.length >= 3);
    assert.ok(faq.every((i) => i.q && i.a));
  });

  it("склоняет названия разных форм без «Журнал» в начале", () => {
    for (const [name, expected] of [
      ["Акт списания продукции", "акт списания продукции"],
      ["График и учет генеральных уборок", "график и учет генеральных уборок"],
      ["Чек-лист уборки", "чек-лист уборки"],
    ] as const) {
      const faq = buildJournalFaq(hygiene, name);
      assert.ok(
        faq.some((i) => i.q.includes(expected)),
        `не склонилось: ${name}`
      );
    }
  });

  it("даёт разный текст разным журналам — иначе это дубль на 35 страниц", () => {
    const journals = Object.values(JOURNAL_INFO).slice(0, 12);
    // Явный тип ключа: коды каталога — литеральный union, а
    // JournalInfo.code просто string, и Map.get не сошёлся бы по типам.
    const names = new Map<string, string>(
      ACTIVE_JOURNAL_CATALOG.map((j) => [j.code, j.name])
    );
    const firstAnswers = journals.map((journal) => {
      const faq = buildJournalFaq(
        journal,
        names.get(journal.code) ?? journal.tagline
      );
      return faq[0].a;
    });
    assert.equal(new Set(firstAnswers).size, firstAnswers.length);
  });
});

describe("journalFaqJsonLd", () => {
  it("собирает FAQPage со всеми вопросами", () => {
    const faq = buildJournalFaq(hygiene, "Гигиенический журнал");
    const ld = journalFaqJsonLd(faq) as {
      "@type": string;
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    };
    assert.equal(ld["@type"], "FAQPage");
    assert.equal(ld.mainEntity.length, faq.length);
    assert.equal(ld.mainEntity[0].name, faq[0].q);
    assert.ok(ld.mainEntity[0].acceptedAnswer.text.length > 20);
  });
});
