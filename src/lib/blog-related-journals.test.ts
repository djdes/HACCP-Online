import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { JOURNAL_INFO } from "@/content/journal-info";
import {
  BLOG_RELATED_JOURNALS,
  MAX_RELATED_JOURNALS,
  relatedJournalCodes,
} from "@/lib/blog-related-journals";

describe("BLOG_RELATED_JOURNALS", () => {
  it("все коды существуют в каталоге — иначе это битая ссылка", () => {
    const unknown: Array<[string, string]> = [];
    for (const [slug, codes] of Object.entries(BLOG_RELATED_JOURNALS)) {
      for (const code of codes) {
        if (!JOURNAL_INFO[code]) unknown.push([slug, code]);
      }
    }
    assert.deepEqual(unknown, []);
  });

  it("внутри статьи нет повторов", () => {
    for (const [slug, codes] of Object.entries(BLOG_RELATED_JOURNALS)) {
      assert.equal(new Set(codes).size, codes.length, `повтор в ${slug}`);
    }
  });

  it("у каждой статьи есть хотя бы одна ссылка", () => {
    for (const [slug, codes] of Object.entries(BLOG_RELATED_JOURNALS)) {
      assert.ok(codes.length > 0, `пусто у ${slug}`);
    }
  });
});

describe("relatedJournalCodes", () => {
  it("обрезает список до предела", () => {
    const codes = relatedJournalCodes("obyazatelnyie-zhurnaly-dlya-obshchepita");
    assert.equal(codes.length, MAX_RELATED_JOURNALS);
  });

  it("возвращает пустой список для незнакомой статьи", () => {
    assert.deepEqual(relatedJournalCodes("нет-такой-статьи"), []);
  });
});
