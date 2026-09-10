import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractFacts, findIssues } from "@/lib/seo/health";

const html = `<html><head><title>Электронные журналы СанПиН и ХАССП — WeSetup</title>
<meta name="description" content="Описание страницы достаточной длины, чтобы пройти проверку минимальной длины описания."/>
<link rel="canonical" href="https://wesetup.ru/x"/><meta property="og:image" content="https://wesetup.ru/og?t=x"/>
<script type="application/ld+json">{}</script></head>
<body><h1>Заголовок</h1><a href="/blog">Блог</a><a href="/blog?x=1#y">Блог</a><a href="/_next/static/a.js">x</a><a href="/dead">d</a></body></html>`;

describe("extractFacts", () => {
  it("вытаскивает title, description, canonical, h1, ссылки без query и служебных", () => {
    const f = extractFacts("https://wesetup.ru/x", 200, html, 120);
    assert.equal(f.title, "Электронные журналы СанПиН и ХАССП — WeSetup");
    assert.ok(f.description?.startsWith("Описание"));
    assert.equal(f.canonical, "https://wesetup.ru/x");
    assert.equal(f.h1Count, 1);
    assert.equal(f.hasOgImage, true);
    assert.equal(f.hasJsonLd, true);
    assert.deepEqual(f.internalLinks.sort(), ["/blog", "/dead"]);
  });
});

describe("findIssues", () => {
  it("находит битые ссылки, дубли title, пустые описания и лишние h1", () => {
    const a = extractFacts("https://wesetup.ru/x", 200, html, 120);
    const b = { ...extractFacts("https://wesetup.ru/y", 200, html, 5000), canonical: "https://wesetup.ru/y", description: null, h1Count: 2 };
    const issues = findIssues([a, b, { ...a, url: "https://wesetup.ru/z", status: 404 }], { "/dead": 404, "/blog": 200 });
    const kinds = issues.map((i) => `${i.kind}@${i.url.slice(-1)}`);
    assert.ok(kinds.includes("broken-link@x") && kinds.includes("description@y") && kinds.includes("h1@y") && kinds.includes("slow@y") && kinds.includes("status@z"));
    assert.ok(issues.some((i) => i.kind === "duplicate-title"));
    assert.ok(!issues.some((i) => i.kind === "canonical" && i.url.endsWith("/x")));
  });
});
