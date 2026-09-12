import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INSTALL_PROMPT_AFTER_ENTRIES,
  INSTALL_PROMPT_SNOOZE_MS,
  shouldShowInstallPrompt,
  type InstallPromptInput,
} from "@/app/mini/_lib/install-prompt";

const NOW = Date.UTC(2026, 8, 12);

function input(over: Partial<InstallPromptInput> = {}): InstallPromptInput {
  return {
    isIos: true,
    isStandalone: false,
    entriesSaved: INSTALL_PROMPT_AFTER_ENTRIES,
    dismissedAt: null,
    now: NOW,
    ...over,
  };
}

describe("shouldShowInstallPrompt", () => {
  it("после второй записи — показываем", () => {
    assert.equal(shouldShowInstallPrompt(input()), true);
  });

  it("новичку на первом заходе не показываем", () => {
    // Он закроет не глядя, а отказ мы обязаны помнить месяц.
    assert.equal(shouldShowInstallPrompt(input({ entriesSaved: 1 })), false);
  });

  it("уже установлено — предлагать нечего", () => {
    assert.equal(shouldShowInstallPrompt(input({ isStandalone: true })), false);
  });

  it("не iOS — не показываем", () => {
    // На Android без установки ничего не ломается, а на iPhone Safari
    // чистит хранилище и запись из подвала может пропасть.
    assert.equal(shouldShowInstallPrompt(input({ isIos: false })), false);
  });

  it("свежий отказ уважаем", () => {
    assert.equal(
      shouldShowInstallPrompt(input({ dismissedAt: NOW - 1000 })),
      false
    );
  });

  it("через месяц спрашиваем снова", () => {
    assert.equal(
      shouldShowInstallPrompt(input({ dismissedAt: NOW - INSTALL_PROMPT_SNOOZE_MS })),
      true
    );
  });

  it("отказ «из будущего» не превращается в вечный показ", () => {
    // Часы на телефоне переводят; без этой ветки перевод даты назад
    // делал бы разницу отрицательной и предложение висело бы всегда.
    assert.equal(
      shouldShowInstallPrompt(input({ dismissedAt: NOW + 5 * 60_000 })),
      false
    );
  });
});
