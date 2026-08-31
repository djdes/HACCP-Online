import assert from "node:assert/strict";
import test from "node:test";

import { findSessionCookieName } from "@/lib/session-token";

test("findSessionCookieName picks the cookie the browser actually sent", () => {
  // Прод: cookie с префиксом.
  assert.equal(
    findSessionCookieName((name) => name === "__Secure-haccp-online.session-token"),
    "__Secure-haccp-online.session-token"
  );
  // Локально: без префикса.
  assert.equal(
    findSessionCookieName((name) => name === "haccp-online.session-token"),
    "haccp-online.session-token"
  );
});

test("findSessionCookieName prefers the secure name when both are present", () => {
  // Такое бывает после смены схемы: остаётся старый cookie без префикса.
  // Переписать надо тот, которым пользуется браузер, — secure выигрывает.
  assert.equal(
    findSessionCookieName(() => true),
    "__Secure-haccp-online.session-token"
  );
});

test("findSessionCookieName returns null when there is no session cookie", () => {
  // Раньше в этом случае имя вычислялось из NEXTAUTH_URL и не совпадало с
  // тем, что выдал auth.ts, — «Войти как» молча падало.
  assert.equal(findSessionCookieName(() => false), null);
});
