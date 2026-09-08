/**
 * Правила автогашения.
 *
 * Тест закрепляет договорённость, ради которой он и написан: по
 * умолчанию мы НЕ гасим ВСД сами, и каждое ослабление этого правила
 * должно быть видно в диффе.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canAutoProcess,
  canUseMercury,
  normalizeAutoProcessMode,
} from "@/lib/mercury/access";

describe("canUseMercury", () => {
  it("старшие тарифы — да, младшие — нет", () => {
    assert.equal(canUseMercury({ plan: "pro" }), true);
    assert.equal(canUseMercury({ plan: "business" }), true);
    assert.equal(canUseMercury({ plan: "free" }), false);
    assert.equal(canUseMercury({ plan: null }), false);
  });

  it("демо-организации видят фичу целиком — это витрина", () => {
    assert.equal(canUseMercury({ plan: "free", isDemo: true }), true);
  });
});

describe("normalizeAutoProcessMode", () => {
  it("по умолчанию assisted, а не автогашение", () => {
    assert.equal(normalizeAutoProcessMode(undefined), "assisted");
    assert.equal(normalizeAutoProcessMode("что-то левое"), "assisted");
    assert.equal(normalizeAutoProcessMode("off"), "off");
    assert.equal(normalizeAutoProcessMode("auto_after_journal"), "auto_after_journal");
  });
});

describe("canAutoProcess", () => {
  const base = {
    mode: "auto_after_journal" as const,
    journalRowAccepted: true,
    volumeMatches: true,
    supplierInn: "504712345678",
    allowedSupplierInns: ["504712345678"],
  };

  it("все условия сошлись — можно", () => {
    assert.equal(canAutoProcess(base).allowed, true);
  });

  it("в режимах off и assisted не гасим никогда", () => {
    assert.equal(canAutoProcess({ ...base, mode: "off" }).allowed, false);
    assert.equal(canAutoProcess({ ...base, mode: "assisted" }).allowed, false);
  });

  it("без заполненной строки журнала — не гасим", () => {
    const r = canAutoProcess({ ...base, journalRowAccepted: false });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /входного контроля/);
  });

  it("расхождение по объёму возвращает решение человеку", () => {
    const r = canAutoProcess({ ...base, volumeMatches: false });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /объём/);
  });

  it("поставщик вне белого списка — не гасим", () => {
    assert.equal(
      canAutoProcess({ ...base, supplierInn: "7714345678" }).allowed,
      false,
    );
    assert.equal(canAutoProcess({ ...base, allowedSupplierInns: [] }).allowed, false);
    assert.equal(canAutoProcess({ ...base, supplierInn: null }).allowed, false);
  });
});
