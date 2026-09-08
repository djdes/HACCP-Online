import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  MINI_CACHE_PREFIX,
  isMiniCacheName,
  isMiniServiceWorkerScope,
} from "@/lib/service-worker-scope";

describe("isMiniServiceWorkerScope", () => {
  it("своя регистрация кабинета не сносится", () => {
    assert.equal(isMiniServiceWorkerScope("https://wesetup.ru/mini"), true);
    assert.equal(isMiniServiceWorkerScope("https://wesetup.ru/mini/"), true);
    assert.equal(
      isMiniServiceWorkerScope("https://wesetup.ru/mini/journals"),
      true,
    );
  });

  it("корневой воркер — исторический, его сносим", () => {
    // Именно он раньше регистрировался и его чистит public/sw.js.
    assert.equal(isMiniServiceWorkerScope("https://wesetup.ru/"), false);
  });

  it("похожий путь не считается своим", () => {
    // Строковое `scope.includes("/mini")` пропустило бы это и оставило
    // чужой воркер жить.
    assert.equal(
      isMiniServiceWorkerScope("https://wesetup.ru/miniature/"),
      false,
    );
    assert.equal(
      isMiniServiceWorkerScope("https://wesetup.ru/admin/mini"),
      false,
    );
  });

  it("чужой домен со словом mini не наш", () => {
    assert.equal(isMiniServiceWorkerScope("https://mini.example.com/"), false);
  });

  it("мусор вместо URL — сносим, а не падаем", () => {
    assert.equal(isMiniServiceWorkerScope(""), false);
    assert.equal(isMiniServiceWorkerScope("/mini"), false);
  });
});

describe("isMiniCacheName", () => {
  it("кеши кабинета переживают заход на дашборд", () => {
    assert.equal(isMiniCacheName("wesetup-mini-static-v1"), true);
  });

  it("всё остальное — чистится", () => {
    assert.equal(isMiniCacheName("workbox-precache"), false);
    assert.equal(isMiniCacheName("next-image"), false);
    assert.equal(isMiniCacheName(""), false);
  });
});

describe("синхронность с public/mini-sw.js", () => {
  it("воркер называет кеши тем же префиксом, что знает страница", () => {
    // Воркер — обычный файл в public/, импортировать его нельзя, а
    // разъехавшийся префикс означал бы вечно растущий кеш: страница
    // считала бы его чужим и чистила, воркер — создавал заново.
    const sw = readFileSync("public/mini-sw.js", "utf8");
    assert.ok(
      sw.includes(`"${MINI_CACHE_PREFIX}`),
      `в public/mini-sw.js нет имени кеша с префиксом ${MINI_CACHE_PREFIX}`,
    );
  });

  it("воркер не применяет обновление сам", () => {
    // skipWaiting допустим ровно один раз и только по сообщению со
    // страницы: самовольный вызов перезагрузил бы форму посреди
    // заполнения журнала.
    const code = readFileSync("public/mini-sw.js", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    const calls = code.match(/self\.skipWaiting\(\)/g) ?? [];
    assert.equal(calls.length, 1, "ожидался ровно один вызов skipWaiting");

    const at = code.indexOf("self.skipWaiting()");
    const before = code.slice(0, at);
    assert.ok(
      before.lastIndexOf("SKIP_WAITING") > before.lastIndexOf("addEventListener"),
      "skipWaiting вызывается не из обработчика сообщения SKIP_WAITING",
    );
  });
});
