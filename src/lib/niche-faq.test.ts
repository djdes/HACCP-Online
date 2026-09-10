import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NICHES } from "@/content/niches";
import { buildNicheFaq, nicheFaqJsonLd } from "@/lib/niche-faq";

describe("buildNicheFaq", () => {
  it("подставляет отрасль в вопросы", () => {
    const faq = buildNicheFaq(NICHES["dlya-pekarni"]);
    assert.ok(faq.some((i) => i.q.includes("пекарни")));
  });

  it("переносит набор журналов ниши в ответ", () => {
    const niche = NICHES["dlya-kafe"];
    const faq = buildNicheFaq(niche);
    const answer = faq.find((i) => i.q.startsWith("Какие журналы"))?.a ?? "";
    assert.ok(answer.includes(niche.journals[0]));
  });

  it("даёт разный текст разным нишам — иначе это дубль на 12 страниц", () => {
    const first = Object.values(NICHES).map((n) => buildNicheFaq(n)[0].a);
    assert.equal(new Set(first).size, first.length);
  });

  it("на каждой нише выдаёт непустые вопрос и ответ", () => {
    for (const [slug, niche] of Object.entries(NICHES)) {
      const faq = buildNicheFaq(niche);
      assert.ok(faq.length >= 3, `мало вопросов у ${slug}`);
      for (const item of faq) {
        assert.ok(item.q.trim().length > 10, `пустой вопрос у ${slug}`);
        assert.ok(item.a.trim().length > 40, `короткий ответ у ${slug}`);
      }
    }
  });

  it("не падает на нише без болей и журналов", () => {
    const bare = { ...NICHES["dlya-bara"], pains: [], journals: [] };
    const faq = buildNicheFaq(bare);
    assert.ok(faq.length >= 2);
  });
});

describe("nicheFaqJsonLd", () => {
  it("собирает FAQPage со всеми вопросами", () => {
    const faq = buildNicheFaq(NICHES["dlya-stolovoy"]);
    const ld = nicheFaqJsonLd(faq) as {
      "@type": string;
      mainEntity: Array<{ name: string }>;
    };
    assert.equal(ld["@type"], "FAQPage");
    assert.equal(ld.mainEntity.length, faq.length);
  });
});
