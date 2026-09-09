import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BADGE_CODE_RE, badgeEmbedHtml, badgeTone, generateBadgeCode, renderBadgeSvg } from "@/lib/badge/render";

describe("generateBadgeCode", () => {
  it("10 символов из безопасного алфавита", () => {
    for (let i = 0; i < 30; i += 1) {
      const code = generateBadgeCode();
      assert.match(code, BADGE_CODE_RE);
      assert.doesNotMatch(code, /[lo01]/);
    }
  });
});

describe("badgeTone", () => {
  it("пороги 90 / 60 и «нет данных»", () => {
    assert.equal(badgeTone(96).kind, "ok");
    assert.equal(badgeTone(90).kind, "ok");
    assert.equal(badgeTone(75).kind, "warn");
    assert.equal(badgeTone(59).kind, "bad");
    assert.equal(badgeTone(null).kind, "none");
  });
});

describe("renderBadgeSvg", () => {
  it("валидный SVG с обеими подписями и цветом тона", () => {
    const svg = renderBadgeSvg({ percent: 96 });
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes(">ХАССП · WeSetup</text>"));
    assert.ok(svg.includes(">96% за 30 дней</text>"));
    assert.ok(svg.includes('fill="#2e9e5b"'));
    assert.ok(svg.includes('role="img"'));
    const none = renderBadgeSvg({ percent: null });
    assert.ok(none.includes(">нет данных</text>"));
  });
});

describe("badgeEmbedHtml", () => {
  it("ссылка на публичную страницу и картинка бейджа", () => {
    const html = badgeEmbedHtml("https://wesetup.ru/", "abc123defg");
    assert.ok(html.includes('href="https://wesetup.ru/b/abc123defg"'));
    assert.ok(html.includes('src="https://wesetup.ru/b/abc123defg/badge.svg"'));
  });
});
