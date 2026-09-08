import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  pushState,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from "@/app/mini/_lib/push-support";

function env(over: Partial<PushEnvironment> = {}): PushEnvironment {
  return {
    supported: true,
    permission: "default",
    isIos: false,
    isStandalone: false,
    subscribed: false,
    ...over,
  };
}

describe("pushState", () => {
  it("браузер не умеет — не предлагаем ничего", () => {
    assert.deepEqual(pushState(env({ supported: false })), {
      kind: "unsupported",
    });
  });

  it("Android во вкладке — можно включать", () => {
    assert.deepEqual(pushState(env()), { kind: "can_enable" });
  });

  it("включено и подписка есть — предлагаем выключить", () => {
    assert.deepEqual(
      pushState(env({ permission: "granted", subscribed: true })),
      { kind: "enabled" },
    );
  });

  it("разрешение есть, а подписки нет — подписываем заново", () => {
    // Так бывает после чистки данных сайта: разрешение осталось,
    // подписка пропала. Показать «включено» значило бы соврать.
    assert.deepEqual(
      pushState(env({ permission: "granted", subscribed: false })),
      { kind: "can_enable" },
    );
  });

  it("отказ необратим из кода — ведём в настройки, а не показываем кнопку", () => {
    assert.deepEqual(pushState(env({ permission: "denied" })), {
      kind: "blocked",
    });
  });

  describe("iOS", () => {
    it("во вкладке просим сначала добавить на экран «Домой»", () => {
      // Safari даёт push только установленному приложению. Кнопка
      // «включить» там молча не сработала бы, и человек решил бы, что
      // приложение сломано.
      assert.deepEqual(
        pushState(env({ isIos: true, isStandalone: false })),
        { kind: "needs_install" },
      );
    });

    it("во вкладке iOS Push API НЕТ — и это всё равно needs_install", () => {
      // Главный случай, и его легко проглядеть: Safari не отдаёт
      // window.PushManager в обычной вкладке, поэтому supported там
      // всегда false. Если проверять поддержку раньше iOS, на айфоне
      // раздел не отрисуется вовсе — то есть инструкция «добавьте на
      // экран Домой» не покажется ровно тому, кому предназначена.
      assert.deepEqual(
        pushState(env({ isIos: true, isStandalone: false, supported: false })),
        { kind: "needs_install" },
      );
    });

    it("проверка установки идёт раньше проверки разрешения", () => {
      // Во вкладке iOS отдаёт permission "default", и без порядка мы
      // предложили бы неработающую кнопку.
      assert.deepEqual(
        pushState(env({ isIos: true, isStandalone: false, permission: "default" })),
        { kind: "needs_install" },
      );
    });

    it("установленное приложение на слишком старой iOS — честно unsupported", () => {
      // До iOS 16.4 Push API нет и у установленного приложения.
      // Инструкция по установке тут не поможет, значит не показываем
      // ничего.
      assert.deepEqual(
        pushState(env({ isIos: true, isStandalone: true, supported: false })),
        { kind: "unsupported" },
      );
    });

    it("установленное приложение ведёт себя как все", () => {
      assert.deepEqual(
        pushState(env({ isIos: true, isStandalone: true })),
        { kind: "can_enable" },
      );
      assert.deepEqual(
        pushState(
          env({
            isIos: true,
            isStandalone: true,
            permission: "granted",
            subscribed: true,
          }),
        ),
        { kind: "enabled" },
      );
    });

    it("на iOS отказ всё равно остаётся отказом", () => {
      assert.deepEqual(
        pushState(env({ isIos: true, isStandalone: true, permission: "denied" })),
        { kind: "blocked" },
      );
    });
  });
});

describe("urlBase64ToUint8Array", () => {
  it("разбирает ключ VAPID без выравнивания", () => {
    // Ключи VAPID приходят в base64url без «=» на конце; без добивки
    // atob падает с InvalidCharacterError.
    const key = "BDZZcW27ECTXIS-SR4ttEG9yYtEPyp4bmH0isncioWU";
    const bytes = urlBase64ToUint8Array(key);
    assert.ok(bytes instanceof Uint8Array);
    assert.ok(bytes.length > 0);
  });

  it("минус и подчёркивание — это плюс и слэш", () => {
    // base64url отличается от base64 ровно этими двумя символами.
    assert.deepEqual(
      Array.from(urlBase64ToUint8Array("-_8=")),
      Array.from(urlBase64ToUint8Array("+/8=")),
    );
  });
});
