import assert from "node:assert/strict";
import test from "node:test";

import {
  ageLabel,
  orgThreadKey,
  previewOf,
  shouldAlert,
  threadKindOf,
  type SupportStatus,
} from "@/lib/support-threads-shared";

test("threadKindOf distinguishes org, guest and legacy keys", () => {
  assert.equal(threadKindOf(orgThreadKey("org_1")), "org");
  assert.equal(threadKindOf("guest:9b2a7c6e-1111-4222-8333-444455556666"), "guest");
  assert.equal(threadKindOf("clx0userid"), "legacy");
});

test("previewOf flattens whitespace, trims and falls back to attachment mark", () => {
  assert.equal(previewOf("  Привет,\n\n как   дела?  "), "Привет, как дела?");
  assert.equal(previewOf("", 2), "📎 Вложение");
  assert.equal(previewOf("", 0), "");
  const long = "а".repeat(200);
  const cut = previewOf(long, 0, 20);
  assert.equal(cut.length, 20);
  assert.ok(cut.endsWith("…"));
});

function status(overrides: Partial<SupportStatus> = {}): SupportStatus {
  return {
    threadId: "t1",
    unreadForClient: 1,
    latest: {
      id: "m1",
      author: "operator",
      preview: "Ответ",
      operatorName: "Поддержка WeSetup",
      createdAt: "2026-09-03T10:00:00.000Z",
    },
    ...overrides,
  };
}

test("shouldAlert fires once per operator reply while unread", () => {
  assert.equal(shouldAlert(status(), null), true);
  assert.equal(shouldAlert(status(), "m0"), true);
  // Уже сигналили именно об этой реплике — молчим.
  assert.equal(shouldAlert(status(), "m1"), false);
  // Клиент прочитал — бейдж 0, всплывашка не нужна.
  assert.equal(shouldAlert(status({ unreadForClient: 0 }), null), false);
  // Последняя реплика — своя же.
  assert.equal(
    shouldAlert(status({ latest: { ...status().latest!, author: "client" } }), null),
    false
  );
  assert.equal(shouldAlert(status({ latest: null }), null), false);
});

test("ageLabel renders minutes, hours and days", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");
  assert.equal(ageLabel(new Date("2026-09-03T11:59:40.000Z"), now), "только что");
  assert.equal(ageLabel(new Date("2026-09-03T11:35:00.000Z"), now), "25 мин");
  assert.equal(ageLabel(new Date("2026-09-03T09:00:00.000Z"), now), "3 ч");
  assert.equal(ageLabel(new Date("2026-09-01T09:00:00.000Z"), now), "2 дн");
  assert.equal(ageLabel("2026-09-03T11:00:00.000Z", now), "1 ч");
});
