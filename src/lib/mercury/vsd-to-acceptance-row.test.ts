/**
 * Маппинг ВСД → строка журнала приёмки.
 *
 * Половина теста проверяет, что данные перенеслись. Вторая, более
 * важная, — что физический контроль НЕ перенёсся: температура,
 * органолептика и решение о приёмке обязаны остаться пустыми, пока их
 * не введёт человек. Если этот тест когда-нибудь «починят», журнал
 * входного контроля перестанет быть доказательством приёмки.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyPhysicalCheck,
  buildAccompanyingDocs,
  buildBatchInfo,
  vsdToAcceptanceRow,
} from "@/lib/mercury/vsd-to-acceptance-row";
import type { VetDocument } from "@/lib/mercury/types";

const VSD: VetDocument = {
  uuid: "1a2b3c4d-0000-4000-a000-000000000001",
  number: "2600000001",
  docType: "TRANSPORT",
  status: "CONFIRMED",
  issueDate: "2026-09-08",
  deliveryDate: "2026-09-08",
  consigneeEnterpriseGuid: "ent-0001",
  consignorEnterpriseGuid: "ent-9999",
  consignorName: "ИП Смирнов А. В.",
  consignorInn: "504712345678",
  manufacturerName: "ООО «Молочный комбинат «Ополье»",
  productName: "Творог 9 %",
  productType: "Молоко и молочные продукты",
  volume: 24,
  unit: "кг",
  batchNumber: "007",
  productionDate: "2026-09-06",
  expiryDate: "2026-09-15",
  transportInfo: "Автотранспорт А101ВС777",
  accompanyingDocs: "ТТН №260908-1",
  raw: {},
};

describe("vsdToAcceptanceRow", () => {
  it("переносит из ВСД то, что Меркурий действительно знает", () => {
    const row = vsdToAcceptanceRow({
      vsd: VSD,
      responsibleTitle: "Кладовщик",
      responsibleUserId: "user-1",
    });

    assert.equal(row.deliveryDate, "2026-09-08");
    assert.equal(row.productName, "Творог 9 %");
    assert.equal(row.manufacturerSupplier, "ООО «Молочный комбинат «Ополье» / ИП Смирнов А. В.");
    assert.equal(row.shelfLifeDate, "2026-09-15");
    assert.equal(row.responsibleTitle, "Кладовщик");
    assert.equal(row.responsibleUserId, "user-1");
    assert.equal(row.mercuryVsdUuid, VSD.uuid);
    assert.equal(row.mercuryVsdNumber, "2600000001");
  });

  it("физический контроль НЕ заполняется из ВСД", () => {
    const row = vsdToAcceptanceRow({ vsd: VSD });

    assert.equal(row.productTemperature, "", "температуру измеряет человек");
    assert.equal(row.acceptanceDecision, "", "решение о приёмке принимает человек");
    assert.equal(row.deliveryHour, "", "час приёмки Меркурий не знает");
    assert.equal(row.deliveryMinute, "");
  });

  it("номер партии остаётся строкой — «007» не превращается в 7", () => {
    const row = vsdToAcceptanceRow({ vsd: VSD });
    assert.match(row.batchInfo, /партия 007/);
  });

  it("объём, партия и дата выработки собираются в одну колонку", () => {
    assert.equal(buildBatchInfo(VSD), "24 кг, партия 007, изгот. 06.09.2026");
    assert.equal(buildBatchInfo({ ...VSD, volume: null, batchNumber: null, productionDate: null }), "");
  });

  it("в сопроводительных документах виден источник — Меркурий", () => {
    assert.equal(
      buildAccompanyingDocs(VSD),
      "ВСД № 2600000001 (Меркурий); ТТН №260908-1",
    );
    assert.match(
      buildAccompanyingDocs({ ...VSD, number: null, accompanyingDocs: null }),
      /^ВСД 1a2b3c4d \(Меркурий\)$/,
    );
  });

  it("производитель и поставщик не дублируются, когда это одно лицо", () => {
    const row = vsdToAcceptanceRow({
      vsd: { ...VSD, manufacturerName: "ООО «Агропродукт»", consignorName: "ООО «Агропродукт»" },
    });
    assert.equal(row.manufacturerSupplier, "ООО «Агропродукт»");
  });

  it("нет даты поставки — берём дату оформления", () => {
    const row = vsdToAcceptanceRow({ vsd: { ...VSD, deliveryDate: null } });
    assert.equal(row.deliveryDate, "2026-09-08");
  });
});

describe("applyPhysicalCheck", () => {
  it("добавляет к строке ровно то, что наблюдал человек", () => {
    const row = applyPhysicalCheck(vsdToAcceptanceRow({ vsd: VSD }), {
      deliveryHour: "08",
      deliveryMinute: "40",
      transportConditionOk: true,
      packagingOk: true,
      organolepticOk: true,
      documentsOk: true,
      productTemperature: "+4",
      decision: "accept",
    });

    assert.equal(row.deliveryHour, "08");
    assert.equal(row.productTemperature, "+4");
    assert.equal(row.acceptanceDecision, "accept");
    assert.equal(row.transportCondition, "satisfactory");
    assert.equal(row.documentCompliance, "Соответствует");
    // Данные ВСД при этом не потерялись.
    assert.equal(row.mercuryVsdUuid, VSD.uuid);
  });

  it("отказ фиксируется вместе с корректирующим действием", () => {
    const row = applyPhysicalCheck(vsdToAcceptanceRow({ vsd: VSD }), {
      transportConditionOk: false,
      packagingOk: false,
      organolepticOk: false,
      documentsOk: true,
      decision: "reject",
      correctiveActions: "Партия возвращена поставщику, составлен акт",
    });

    assert.equal(row.acceptanceDecision, "reject");
    assert.equal(row.organolepticResult, "unsatisfactory");
    assert.match(row.correctiveActions, /возвращена поставщику/);
  });
});
