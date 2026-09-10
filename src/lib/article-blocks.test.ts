import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isArticleBlockArray } from "@/lib/article-blocks";

describe("isArticleBlockArray — блок faq", () => {
  it("принимает корректный блок вопросов", () => {
    assert.equal(
      isArticleBlockArray([
        {
          type: "faq",
          items: [
            { q: "Сколько хранить журнал?", a: "Инспектор запрашивает год." },
          ],
        },
      ]),
      true
    );
  });

  it("отвергает пустой список вопросов", () => {
    // Пустой блок дал бы пустую разметку FAQPage — это хуже, чем её
    // отсутствие: поисковик считает такое ошибкой разметки.
    assert.equal(isArticleBlockArray([{ type: "faq", items: [] }]), false);
  });

  it("отвергает вопрос без ответа и ответ без вопроса", () => {
    assert.equal(
      isArticleBlockArray([{ type: "faq", items: [{ q: "Вопрос?" }] }]),
      false
    );
    assert.equal(
      isArticleBlockArray([{ type: "faq", items: [{ a: "Ответ." }] }]),
      false
    );
  });

  it("отвергает нестроковые вопрос и ответ", () => {
    assert.equal(
      isArticleBlockArray([{ type: "faq", items: [{ q: 1, a: 2 }] }]),
      false
    );
    assert.equal(
      isArticleBlockArray([{ type: "faq", items: [null] }]),
      false
    );
  });

  it("не ломает остальные типы блоков", () => {
    assert.equal(
      isArticleBlockArray([
        { type: "p", text: "Абзац" },
        { type: "h2", text: "Заголовок" },
        { type: "ul", items: ["раз", "два"] },
        { type: "quote", text: "Цитата", author: "Кто-то" },
        { type: "callout", tone: "warn", text: "Внимание" },
        { type: "faq", items: [{ q: "Вопрос?", a: "Ответ." }] },
      ]),
      true
    );
  });

  it("по-прежнему отвергает неизвестный тип", () => {
    assert.equal(isArticleBlockArray([{ type: "video", url: "x" }]), false);
  });
});
