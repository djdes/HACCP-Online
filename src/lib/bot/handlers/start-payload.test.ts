import assert from "node:assert/strict";
import test from "node:test";

// Секрет нужен до импорта: `telegram.ts` читает его при подписи токена.
process.env.TELEGRAM_LINK_TOKEN_SECRET ??= "test-secret-for-link-tokens";

import {
  generateBotInviteRaw,
  stripBotInvitePrefix,
} from "@/lib/bot-invite-tokens";
import { generateLinkToken, parseLinkToken } from "@/lib/telegram";

/**
 * У `/start` два вида payload: приглашение сотрудника (`inv_…`) и токен
 * привязки собственного аккаунта из настроек. Обработчик различает их по
 * префиксу, поэтому важно, чтобы один не опознавался как другой: иначе
 * человек снова получит «Ссылка-приглашение некорректна».
 */

test("invite payload is recognised as an invite and not as a link token", () => {
  const invite = generateBotInviteRaw();

  assert.ok(stripBotInvitePrefix(invite), "приглашение должно опознаваться");
  assert.equal(
    parseLinkToken(invite),
    null,
    "приглашение не должно проходить как токен привязки"
  );
});

test("self-link token is recognised as a link token and not as an invite", () => {
  const token = generateLinkToken("user_1");

  assert.equal(
    stripBotInvitePrefix(token),
    null,
    "токен привязки не должен опознаваться как приглашение"
  );
  assert.deepEqual(parseLinkToken(token), { userId: "user_1" });
});

test("garbage payload matches neither", () => {
  assert.equal(stripBotInvitePrefix("привет"), null);
  assert.equal(parseLinkToken("привет"), null);
});

test("tampered link token is rejected", () => {
  // Подпись HMAC — иначе чужой id в ссылке привязал бы чужой аккаунт.
  const token = generateLinkToken("user_1");
  const decoded = Buffer.from(token, "base64url").toString("utf8");
  const forged = Buffer.from(
    decoded.replace("user_1", "user_2"),
    "utf8"
  ).toString("base64url");

  assert.equal(parseLinkToken(forged), null);
});
