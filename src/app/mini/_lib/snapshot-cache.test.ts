import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SNAPSHOT_MAX_AGE_MS,
  isSnapshotUsable,
  snapshotAgeLabel,
  type Snapshot,
} from "@/app/mini/_lib/snapshot-cache";

const NOW = Date.UTC(2026, 8, 12, 9, 0, 0);

function snap(over: Partial<Snapshot<string>> = {}): Snapshot<string> {
  return {
    userId: "u1",
    organizationId: "org1",
    savedAt: NOW - 60_000,
    data: "список",
    ...over,
  };
}

describe("isSnapshotUsable", () => {
  it("свой свежий снимок годится", () => {
    assert.equal(
      isSnapshotUsable(snap(), { userId: "u1", organizationId: "org1" }, NOW),
      true
    );
  });

  it("чужой снимок не показываем", () => {
    // «Одна трубка на три смены»: список повара А, показанный повару Б,
    // читается как его собственный.
    assert.equal(
      isSnapshotUsable(snap(), { userId: "u2", organizationId: "org1" }, NOW),
      false
    );
  });

  it("снимок другой организации не показываем", () => {
    // ROOT смотрит чужие кабинеты — снимок одной не годится другой.
    assert.equal(
      isSnapshotUsable(snap(), { userId: "u1", organizationId: "org2" }, NOW),
      false
    );
  });

  it("без сессии не показываем ничего", () => {
    assert.equal(
      isSnapshotUsable(snap(), { userId: null, organizationId: null }, NOW),
      false
    );
  });

  it("вчерашний снимок — уже не данные", () => {
    assert.equal(
      isSnapshotUsable(
        snap({ savedAt: NOW - SNAPSHOT_MAX_AGE_MS - 1 }),
        { userId: "u1", organizationId: "org1" },
        NOW
      ),
      false
    );
  });

  it("снимок «из будущего» не показываем", () => {
    // Часы на телефоне перевели — возраст посчитать нечем.
    assert.equal(
      isSnapshotUsable(
        snap({ savedAt: NOW + 60_000 }),
        { userId: "u1", organizationId: "org1" },
        NOW
      ),
      false
    );
  });

  it("пустого снимка нет — и это не ошибка", () => {
    assert.equal(
      isSnapshotUsable(null, { userId: "u1", organizationId: "org1" }, NOW),
      false
    );
  });
});

describe("snapshotAgeLabel", () => {
  it("только что — без времени", () => {
    assert.equal(snapshotAgeLabel(NOW - 5_000, NOW), "данные только что");
  });

  it("иначе показывает время снимка", () => {
    const label = snapshotAgeLabel(NOW - 30 * 60_000, NOW);
    assert.ok(label.startsWith("данные на "), label);
  });
});
