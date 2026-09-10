import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRss, escapeXml } from "@/lib/rss";

describe("rss", () => {
  it("экранирует спецсимволы", () => {
    assert.equal(escapeXml('a & <b> "c"'), "a &amp; &lt;b&gt; &quot;c&quot;");
  });
  it("валидный RSS 2.0, элементы по убыванию даты", () => {
    const xml = buildRss({
      title: "Блог",
      link: "https://wesetup.ru/blog",
      description: "Статьи",
      selfUrl: "https://wesetup.ru/blog/feed.xml",
      items: [
        { title: "Старая", link: "https://wesetup.ru/blog/old", description: "x", pubDate: new Date("2026-01-01T00:00:00Z") },
        { title: "Новая & свежая", link: "https://wesetup.ru/blog/new", description: "y", pubDate: new Date("2026-09-01T00:00:00Z"), categories: ["ХАССП"] },
      ],
    });
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"'));
    assert.ok(xml.indexOf("Новая &amp; свежая") < xml.indexOf("Старая"));
    assert.ok(xml.includes("<category>ХАССП</category>"));
    assert.ok(xml.includes('rel="self"'));
    assert.ok(xml.trimEnd().endsWith("</rss>"));
  });
});
