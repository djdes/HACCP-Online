import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LiveEvent } from "@/lib/live-events";
import {
  extractJournalWriteHints,
  isJournalWriteOperation,
  queueJournalChange,
  resetJournalChangeCache,
  resolveJournalChange,
  type JournalLookupClient,
} from "@/lib/journal-change-events";

describe("isJournalWriteOperation", () => {
  it("чтение — нет, запись любого вида — да", () => {
    assert.equal(isJournalWriteOperation("findMany"), false);
    assert.equal(isJournalWriteOperation("count"), false);
    for (const op of ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"]) {
      assert.equal(isJournalWriteOperation(op), true, op);
    }
  });
});

describe("extractJournalWriteHints", () => {
  it("create записи: организация и шаблон из результата", () => {
    const hints = extractJournalWriteHints(
      "journalEntry",
      { data: { organizationId: "org1", templateId: "tpl1", data: {} } },
      { id: "e1", organizationId: "org1", templateId: "tpl1" }
    );
    assert.deepEqual(hints, [{ organizationId: "org1", templateId: "tpl1" }]);
  });

  it("upsert клетки по составному ключу: documentId из where", () => {
    const hints = extractJournalWriteHints(
      "journalDocumentEntry",
      {
        where: { documentId_employeeId_date: { documentId: "doc1", employeeId: "u1", date: new Date() } },
        create: { documentId: "doc1", employeeId: "u1", date: new Date() },
        update: { value: "x" },
      },
      undefined
    );
    assert.deepEqual(hints, [{ documentId: "doc1" }]);
  });

  it("updateMany с { in } — подсказка на каждый документ", () => {
    const hints = extractJournalWriteHints(
      "journalDocumentEntry",
      { where: { documentId: { in: ["a", "b"] } }, data: { value: null } },
      { count: 2 }
    );
    assert.deepEqual(hints, [{ documentId: "a" }, { documentId: "b" }]);
  });

  it("createMany: массив data, дубли схлопываются", () => {
    const hints = extractJournalWriteHints(
      "journalDocumentEntry",
      { data: [{ documentId: "d" }, { documentId: "d" }, { documentId: "d" }] },
      { count: 3 }
    );
    assert.deepEqual(hints, [{ documentId: "d" }]);
  });

  it("сам документ: его id — это documentId", () => {
    const hints = extractJournalWriteHints(
      "journalDocument",
      { data: { organizationId: "org1", templateId: "tpl1" } },
      { id: "doc9", organizationId: "org1", templateId: "tpl1" }
    );
    assert.deepEqual(hints, [{ organizationId: "org1", templateId: "tpl1", documentId: "doc9" }]);
  });

  it("связь через connect и фильтр по document", () => {
    assert.deepEqual(
      extractJournalWriteHints(
        "journalDocumentEntry",
        { data: { document: { connect: { id: "d7" } }, employeeId: "u" } },
        undefined
      ),
      [{ documentId: "d7" }]
    );
    assert.deepEqual(
      extractJournalWriteHints(
        "journalDocumentEntry",
        { where: { document: { organizationId: "org3" } } },
        { count: 1 }
      ),
      [{ organizationId: "org3" }]
    );
  });

  it("ничего не понятно — пусто, событие не уйдёт", () => {
    assert.deepEqual(
      extractJournalWriteHints("journalDocumentEntry", { where: { id: "x" } }, { count: 1 }),
      []
    );
  });
});

describe("resolveJournalChange", () => {
  it("организация известна: код из шаблона, второй раз из кеша", async () => {
    resetJournalChangeCache();
    let calls = 0;
    const client = {
      journalTemplate: {
        findUnique: async () => {
          calls += 1;
          return { code: "hygiene" };
        },
      },
      journalDocument: { findUnique: async () => null },
    } as unknown as JournalLookupClient;

    const first = await resolveJournalChange(client, { organizationId: "org1", templateId: "t1" });
    const second = await resolveJournalChange(client, { organizationId: "org1", templateId: "t1" });
    assert.deepEqual(first, { organizationId: "org1", code: "hygiene", documentId: null });
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  });

  it("только документ: организация и код из документа, с кешем", async () => {
    resetJournalChangeCache();
    let calls = 0;
    const client = {
      journalTemplate: { findUnique: async () => null },
      journalDocument: {
        findUnique: async () => {
          calls += 1;
          return { organizationId: "org2", template: { code: "cleaning" } };
        },
      },
    } as unknown as JournalLookupClient;

    const first = await resolveJournalChange(client, { documentId: "d1" });
    await resolveJournalChange(client, { documentId: "d1" });
    assert.deepEqual(first, { organizationId: "org2", code: "cleaning", documentId: "d1" });
    assert.equal(calls, 1);
  });

  it("документа нет (удалён или ещё не закоммичен) — null", async () => {
    resetJournalChangeCache();
    const client = {
      journalTemplate: { findUnique: async () => null },
      journalDocument: { findUnique: async () => null },
    } as unknown as JournalLookupClient;
    assert.equal(await resolveJournalChange(client, { documentId: "gone" }), null);
    assert.equal(await resolveJournalChange(client, {}), null);
  });
});

describe("queueJournalChange", () => {
  it("несколько изменений за окно — одно событие на организацию", async () => {
    const published: Array<[string, Omit<LiveEvent, "at">]> = [];
    const publish = (organizationId: string, event: Omit<LiveEvent, "at">) => {
      published.push([organizationId, event]);
      return 1;
    };
    const options = { publish, delayMs: 5 };
    queueJournalChange({ organizationId: "org1", code: "hygiene", documentId: "d1" }, options);
    queueJournalChange({ organizationId: "org1", code: "cleaning", documentId: null }, options);
    queueJournalChange({ organizationId: "org1", code: "hygiene", documentId: "d1" }, options);
    queueJournalChange({ organizationId: "org2", code: null, documentId: "d2" }, options);

    await new Promise((resolve) => setTimeout(resolve, 40));

    assert.equal(published.length, 2);
    const org1 = published.find(([id]) => id === "org1")?.[1];
    const org2 = published.find(([id]) => id === "org2")?.[1];
    assert.deepEqual(org1, {
      type: "journal",
      kind: "changed",
      data: { codes: ["hygiene", "cleaning"], documentIds: ["d1"] },
    });
    assert.deepEqual(org2, {
      type: "journal",
      kind: "changed",
      data: { codes: [], documentIds: ["d2"] },
    });
  });
});
