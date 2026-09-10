import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clampOgText, ogImageUrl, ogImages } from "@/lib/og-image";

describe("og-image", () => {
  it("режет длинный текст с многоточием и схлопывает пробелы", () => {
    assert.equal(clampOgText("  а   б  ", 10), "а б");
    const long = clampOgText("x".repeat(100), 90);
    assert.equal(long.length, 90);
    assert.ok(long.endsWith("…"));
    assert.equal(clampOgText(null, 10), "");
  });
  it("собирает адрес /og с закодированными параметрами", () => {
    const url = ogImageUrl({ title: "Журнал здоровья", subtitle: "СанПиН", kind: "journal" });
    assert.ok(url.startsWith("https://wesetup.ru/og?"));
    const params = new URL(url).searchParams;
    assert.equal(params.get("t"), "Журнал здоровья");
    assert.equal(params.get("s"), "СанПиН");
    assert.equal(params.get("k"), "journal");
    assert.equal(new URL(ogImageUrl({ title: "x" })).searchParams.get("k"), null);
    assert.equal(ogImages({ title: "x" })[0].width, 1200);
  });
});
