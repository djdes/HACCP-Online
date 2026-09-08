import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RESUME_HOME_AFTER_MS,
  shouldReturnHome,
  type ResumeContext,
} from "@/app/mini/_lib/resume-home";

function ctx(over: Partial<ResumeContext> = {}): ResumeContext {
  return {
    hiddenMs: RESUME_HOME_AFTER_MS + 1000,
    pathname: "/mini/staff",
    hasDirtyInput: false,
    ...over,
  };
}

describe("shouldReturnHome", () => {
  it("после долгого перерыва возвращаем на главную", () => {
    // Ради этого всё и написано: утром открыть приложение и увидеть
    // вчерашний список сотрудников вместо задач на сегодня.
    assert.equal(shouldReturnHome(ctx()), true);
  });

  it("отвлёкся на пару минут — оставляем где был", () => {
    assert.equal(shouldReturnHome(ctx({ hiddenMs: 2 * 60 * 1000 })), false);
  });

  it("ровно на пороге уже уводим, чуть раньше — нет", () => {
    assert.equal(shouldReturnHome(ctx({ hiddenMs: RESUME_HOME_AFTER_MS })), true);
    assert.equal(
      shouldReturnHome(ctx({ hiddenMs: RESUME_HOME_AFTER_MS - 1 })),
      false,
    );
  });

  it("уже на главной — никуда не ведём", () => {
    assert.equal(shouldReturnHome(ctx({ pathname: "/mini" })), false);
  });

  describe("несохранённая работа сильнее любого таймера", () => {
    it("заполненное поле держит на месте", () => {
      assert.equal(
        shouldReturnHome(ctx({ hasDirtyInput: true, hiddenMs: 10 * 60 * 60 * 1000 })),
        false,
        "увести с наполовину заполненного журнала — потерять работу человека",
      );
    });

    it("экраны с формами не покидаем даже с пустыми полями", () => {
      // Там может лежать приложенное фото или выбранная строка —
      // пустота полей ввода ещё не значит, что делать нечего.
      for (const pathname of [
        "/mini/journals/hygiene/new",
        "/mini/journals/temp_control",
        "/mini/documents/abc123",
        "/mini/claim/42",
        "/mini/bonus/7",
        "/mini/shift-handover",
      ]) {
        assert.equal(
          shouldReturnHome(ctx({ pathname })),
          false,
          `не должны уводить с ${pathname}`,
        );
      }
    });

    it("со списков и отчётов уводим спокойно", () => {
      for (const pathname of [
        "/mini/staff",
        "/mini/reports",
        "/mini/equipment",
        "/mini/audit",
        "/mini/me",
        "/mini/today",
      ]) {
        assert.equal(
          shouldReturnHome(ctx({ pathname })),
          true,
          `${pathname} — читающий экран, уводить безопасно`,
        );
      }
    });
  });
});
