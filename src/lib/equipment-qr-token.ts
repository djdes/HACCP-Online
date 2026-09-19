/**
 * Long-lived HMAC token for physical QR stickers on equipment.
 * Format: `<equipmentId>.<issuedAtMs>.<sig>`.
 *
 * Signed with `EQUIPMENT_QR_TOKEN_SECRET` — separate from the
 * short-lived task-fill secret because the threat model is different:
 *
 *   • task-fill tokens live 30 minutes and gate a single task
 *   • equipment QR tokens are printed on a sticker, need to survive
 *     30+ days, and gate writing a temperature reading (low blast
 *     radius even if leaked — attacker could only add plausible
 *     temperature rows that are trivially distinguishable in the audit
 *     log).
 *
 * Без срока действия (2026-09-19). Отзыв — только сменой секрета.
 *
 * Реализация общая с плакатами помещений — `src/lib/qr-fill-token.ts`.
 * Здесь обёртки со старыми именами: токен помещения (`room:<id>…`)
 * этой проверкой не принимается.
 */

import { mintQrFillToken, verifyQrFillToken } from "@/lib/qr-fill-token";

export function mintEquipmentQrToken(equipmentId: string): string {
  return mintQrFillToken("equipment", equipmentId);
}

export type EquipmentTokenVerification =
  | { ok: true; equipmentId: string }
  | { ok: false; reason: "bad-format" | "bad-sig" };

export function verifyEquipmentQrToken(token: string): EquipmentTokenVerification {
  const result = verifyQrFillToken(token);
  if (!result.ok) return result;
  if (result.kind !== "equipment") return { ok: false, reason: "bad-sig" };
  return { ok: true, equipmentId: result.id };
}
