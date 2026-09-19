import assert from "node:assert/strict";
import test from "node:test";

import {
  mintQrFillToken,
  verifyQrFillToken,
  verifyQrFillTokenFor,
} from "@/lib/qr-fill-token";
import { mintEquipmentQrToken, verifyEquipmentQrToken } from "@/lib/equipment-qr-token";

// Секрет читается при каждом вызове, поэтому достаточно задать его до тестов.
process.env.EQUIPMENT_QR_TOKEN_SECRET = "test-secret-for-qr-fill-tokens-0123456789";

const DAY = 24 * 60 * 60 * 1000;

test("помещение: токен выпускается и проверяется", () => {
  const token = mintQrFillToken("room", "room123");
  assert.match(token, /^room:room123\.\d+\.[\w-]+$/);
  const result = verifyQrFillToken(token);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.kind, "room");
    assert.equal(result.id, "room123");
  }
});

test("оборудование: формат старых наклеек не изменился и совместим в обе стороны", () => {
  const legacy = mintEquipmentQrToken("eq42");
  assert.match(legacy, /^eq42\.\d+\.[\w-]+$/);
  const viaNew = verifyQrFillToken(legacy);
  assert.ok(viaNew.ok && viaNew.kind === "equipment" && viaNew.id === "eq42");
  const minted = mintQrFillToken("equipment", "eq42");
  assert.deepEqual(verifyEquipmentQrToken(minted), { ok: true, equipmentId: "eq42" });
});

test("токен помещения не принимается как токен оборудования", () => {
  const roomToken = mintQrFillToken("room", "abc");
  const asEquipment = verifyEquipmentQrToken(roomToken);
  assert.equal(asEquipment.ok, false);
  assert.equal(verifyQrFillTokenFor(roomToken, "equipment", "abc").ok, false);
  assert.equal(verifyQrFillTokenFor(roomToken, "room", "other").ok, false);
  assert.equal(verifyQrFillTokenFor(roomToken, "room", "abc").ok, true);
});

test("испорченный токен и бессрочность", () => {
  const token = mintQrFillToken("room", "abc");
  const [subject, issued, sig] = token.split(".");
  assert.deepEqual(verifyQrFillToken(`${subject}.${issued}.${sig.slice(0, -2)}xx`), { ok: false, reason: "bad-sig" });
  assert.deepEqual(verifyQrFillToken(`room:other.${issued}.${sig}`), { ok: false, reason: "bad-sig" });
  assert.deepEqual(verifyQrFillToken("abc"), { ok: false, reason: "bad-format" });

  // Срока действия нет: расклеенные год и три года назад коды работают.
  const oldRoom = mintQrFillToken("room", "abc", Date.now() - 400 * DAY);
  assert.equal(verifyQrFillToken(oldRoom).ok, true);
  const oldEquipment = mintQrFillToken("equipment", "eq", Date.now() - 3 * 365 * DAY);
  assert.equal(verifyQrFillToken(oldEquipment).ok, true);
});

test("id с точкой или префиксом помещения для оборудования не выпускается", () => {
  assert.throws(() => mintQrFillToken("room", "a.b"));
  assert.throws(() => mintQrFillToken("equipment", "room:x"));
});
