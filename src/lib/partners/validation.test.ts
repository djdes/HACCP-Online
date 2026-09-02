import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ACCENT,
  checkAccent,
  checkLogoBytes,
  contrastRatio,
  darkenHex,
  isValidInn,
  isValidPartnerCode,
  normalizeHex,
  normalizePartnerCode,
  partnerCodeFromBytes,
  readPngSize,
  resolvePartnerSlugFromHost,
  suggestSlug,
  validateBrandName,
  validateSlug,
} from "@/lib/partners/validation";
import { sanitizeSvg } from "@/lib/partners/svg-sanitize";
import { buildCsv, csvCell, csvContentDisposition } from "@/lib/partners/csv";
import {
  evaluatePartnerRequest,
  parsePartnerAccessClaim,
} from "@/lib/partners/access-guard";

test("slug: латиница, дефис между словами, зарезервированные — нет", () => {
  assert.deepEqual(validateSlug(" Ivanov-Consult "), { ok: true, slug: "ivanov-consult" });
  assert.equal(validateSlug("ab").ok, false);
  assert.equal(validateSlug("-abc").ok, false);
  assert.equal(validateSlug("a--b").ok, false);
  assert.equal(validateSlug("иванов").ok, false);
  assert.equal(validateSlug("partner").ok, false);
  assert.equal(validateSlug("api").ok, false);
});

test("slug: транслит подсказки из названия компании", () => {
  assert.equal(suggestSlug("ООО «Иванов Консалт»"), "ooo-ivanov-konsalt");
  assert.equal(suggestSlug("ИП"), "");
});

test("код: 6 символов без похожих букв, нормализация регистра и пробелов", () => {
  assert.equal(normalizePartnerCode(" ab-c 23x "), "ABC23X");
  assert.equal(isValidPartnerCode("ABC23X"), true);
  assert.equal(isValidPartnerCode("ABC0IX"), false);
  assert.equal(isValidPartnerCode("ABCDE"), false);
  const code = partnerCodeFromBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]));
  assert.equal(code, "ABCDEF");
  assert.equal(isValidPartnerCode(code), true);
});

test("HEX: нормализация #rgb/#rrggbb, контраст WCAG", () => {
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("5566F6"), "#5566f6");
  assert.equal(normalizeHex("#12345"), null);
  assert.equal(contrastRatio("#000000", "#ffffff"), 21);
  assert.equal(contrastRatio("#ffffff", "#ffffff"), 1);
});

test("акцент: стандартный индиго проходит, светло-жёлтый — предупреждение и дефолт", () => {
  const ok = checkAccent("#5566f6");
  assert.equal(ok.ok, true);
  assert.equal(ok.effective, "#5566f6");
  assert.ok(ok.onWhite >= 4.5);
  assert.ok(ok.onDark >= 3);

  const bad = checkAccent("#ffee00");
  assert.equal(bad.ok, false);
  assert.equal(bad.effective, DEFAULT_ACCENT);
  assert.match(bad.warning ?? "", /WCAG/);

  const garbage = checkAccent("red");
  assert.equal(garbage.hex, null);
  assert.equal(garbage.effective, DEFAULT_ACCENT);
});

test("hover-цвет темнее на 8 %", () => {
  assert.equal(darkenHex("#ffffff"), "#ebebeb");
  assert.equal(darkenHex("#000000"), "#000000");
});

function pngBytes(width: number, height: number): Uint8Array {
  const out = new Uint8Array(24);
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  out.set([0, 0, 0, 13], 8);
  out.set([0x49, 0x48, 0x44, 0x52], 12);
  new DataView(out.buffer).setUint32(16, width);
  new DataView(out.buffer).setUint32(20, height);
  return out;
}

test("PNG: размеры из IHDR, лимит 480×128, вес 500 КБ", () => {
  assert.deepEqual(readPngSize(pngBytes(480, 128)), { width: 480, height: 128 });
  assert.equal(readPngSize(new TextEncoder().encode("<svg></svg>")), null);
  const okPng = checkLogoBytes(pngBytes(240, 64), "image/png");
  assert.equal(okPng.ok, true);
  const bigPng = checkLogoBytes(pngBytes(1000, 300), "image/png");
  assert.equal(bigPng.ok, false);
  const heavy = new Uint8Array(500 * 1024 + 1);
  heavy.set(pngBytes(10, 10));
  assert.equal(checkLogoBytes(heavy, "image/png").ok, false);
  const svg = checkLogoBytes(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'), "application/octet-stream");
  assert.equal(svg.ok && svg.mime, "image/svg+xml");
  assert.equal(checkLogoBytes(new TextEncoder().encode("GIF89a"), "image/gif").ok, false);
});

test("бренд ≤ 40 символов, ИНН 10 или 12 цифр", () => {
  assert.deepEqual(validateBrandName("  Иванов   Консалт "), { ok: true, value: "Иванов Консалт" });
  assert.equal(validateBrandName("x".repeat(41)).ok, false);
  assert.equal(validateBrandName("   ").ok, false);
  assert.equal(isValidInn("7707083893"), true);
  assert.equal(isValidInn("770708389312"), true);
  assert.equal(isValidInn("77070838931"), false);
});

test("субдомен → slug (резерв под <slug>.wesetup.ru)", () => {
  assert.equal(resolvePartnerSlugFromHost("ivanov.wesetup.ru:443"), "ivanov");
  assert.equal(resolvePartnerSlugFromHost("wesetup.ru"), null);
  assert.equal(resolvePartnerSlugFromHost("www.wesetup.ru"), null);
  assert.equal(resolvePartnerSlugFromHost("a.b.wesetup.ru"), null);
  assert.equal(resolvePartnerSlugFromHost("ivanov.evil.ru"), null);
});

test("SVG: чистый проходит, скрипты/обработчики/внешние ссылки — нет", () => {
  const clean = sanitizeSvg(
    '<?xml version="1.0"?><!-- logo --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.a{fill:#5566f6}</style><rect class="a" width="10" height="10"/></svg>',
  );
  assert.equal(clean.ok, true);
  assert.ok(clean.ok && clean.svg.startsWith("<svg"));
  assert.ok(clean.ok && !clean.svg.includes("<!--"));
  assert.equal(sanitizeSvg("<svg><script>alert(1)</script></svg>").ok, false);
  assert.equal(sanitizeSvg('<svg onload="alert(1)"></svg>').ok, false);
  assert.equal(sanitizeSvg('<svg><a href="javascript:alert(1)"><text>x</text></a></svg>').ok, false);
  assert.equal(sanitizeSvg('<svg><image href="https://evil/x.png"/></svg>').ok, false);
  assert.equal(sanitizeSvg('<svg><foreignObject><div/></foreignObject></svg>').ok, false);
  assert.equal(sanitizeSvg('<!DOCTYPE svg [<!ENTITY x "y">]><svg>&x;</svg>').ok, false);
  assert.equal(sanitizeSvg("<div>not svg</div>").ok, false);
  assert.equal(sanitizeSvg('<svg><style>@import url(x.css)</style></svg>').ok, false);
});

test("CSV: BOM, разделитель `;`, кириллица, экранирование, запятая в числах", () => {
  const csv = buildCsv(["Дата", "Клиент", "Сумма"], [["2026-09-01", 'ООО "Ромашка"; Москва', 2662.5]]);
  assert.ok(csv.startsWith("﻿"));
  assert.ok(csv.includes("Дата;Клиент;Сумма\r\n"));
  assert.ok(csv.includes('"ООО ""Ромашка""; Москва"'));
  assert.ok(csv.includes(";2662,50\r\n"));
  assert.equal(csvCell(null), "");
  assert.match(csvContentDisposition("вознаграждение.csv"), /filename\*=UTF-8''/);
});

test("доступ партнёра: view — только чтение, edit — без денег и настроек консультанта", () => {
  const view = { partnerId: "p", organizationId: "o", level: "view" as const };
  const edit = { partnerId: "p", organizationId: "o", level: "edit" as const };
  assert.equal(evaluatePartnerRequest({ method: "GET", pathname: "/api/journals", claim: view }).allow, true);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/journals", claim: view }).allow, false);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/journals", claim: edit }).allow, true);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/settings/inspector-tokens", claim: view }).allow, false);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/settings/inspector-tokens", claim: edit }).allow, true);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/inspector/abc/sign", claim: edit }).allow, true);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/settings/consultant", claim: edit }).allow, false);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/payments/robokassa/create", claim: edit }).allow, false);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/partner/clients/o/exit", claim: view }).allow, true);
  assert.equal(evaluatePartnerRequest({ method: "POST", pathname: "/api/me/active-organization", claim: view }).allow, true);
  assert.equal(evaluatePartnerRequest({ method: "DELETE", pathname: "/api/organizations/o", claim: edit }).allow, false);
});

test("claim из JWT парсится строго", () => {
  assert.deepEqual(parsePartnerAccessClaim({ partnerId: "p", organizationId: "o", level: "view" }), {
    partnerId: "p",
    organizationId: "o",
    level: "view",
  });
  assert.equal(parsePartnerAccessClaim({ partnerId: "p", organizationId: "o", level: "admin" }), null);
  assert.equal(parsePartnerAccessClaim(null), null);
  assert.equal(parsePartnerAccessClaim("x"), null);
});
