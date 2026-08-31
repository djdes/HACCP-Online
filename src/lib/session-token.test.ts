import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOM_SESSION_COOKIE,
  LEGACY_SESSION_COOKIES,
} from "@/lib/auth-cookies";
import {
  findSessionCookieName,
  listPresentSessionCookies,
} from "@/lib/session-token";

/** Как выглядят cookie после обычного входа: токен во всех именах сразу. */
const AFTER_LOGIN = new Set([CUSTOM_SESSION_COOKIE, ...LEGACY_SESSION_COOKIES]);

test("findSessionCookieName matches the reader order", () => {
  // `server-session.ts` и middleware берут первое существующее имя в
  // порядке CUSTOM → LEGACY. Если здесь порядок другой, правка claim'а
  // уйдёт не в ту cookie и просто не подействует.
  assert.equal(
    findSessionCookieName((name) => AFTER_LOGIN.has(name)),
    CUSTOM_SESSION_COOKIE
  );
});

test("findSessionCookieName falls back to a legacy cookie", () => {
  // Старая вкладка или мобильный клиент: основной cookie нет.
  assert.equal(
    findSessionCookieName((name) => name === "__Secure-haccp-online.session-token"),
    "__Secure-haccp-online.session-token"
  );
});

test("findSessionCookieName returns null without a session", () => {
  assert.equal(findSessionCookieName(() => false), null);
});

test("listPresentSessionCookies returns every cookie the login wrote", () => {
  // Ровно тот баг, из-за которого «Войти как» не работало: правилась
  // одна cookie, а читатель брал другую — она оставалась со старым
  // токеном и отменяла правку. Переписать нужно все присутствующие.
  const present = listPresentSessionCookies((name) => AFTER_LOGIN.has(name));

  assert.ok(present.includes(CUSTOM_SESSION_COOKIE));
  for (const legacy of LEGACY_SESSION_COOKIES) {
    assert.ok(present.includes(legacy), `не переписывается ${legacy}`);
  }
});

test("listPresentSessionCookies ignores cookies that are absent", () => {
  const present = listPresentSessionCookies(
    (name) => name === CUSTOM_SESSION_COOKIE
  );

  assert.deepEqual(present, [CUSTOM_SESSION_COOKIE]);
});
