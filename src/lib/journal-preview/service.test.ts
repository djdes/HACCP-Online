import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planPreviewRun } from "./service";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const D = (iso: string) => new Date(iso);

function doc(id: string, org: string, code: string, updatedAt: string, dateFrom = "2026-09-01") {
  return { id, organizationId: org, updatedAt: D(updatedAt), dateFrom: D(dateFrom), template: { code } };
}

function preview(
  id: string,
  org: string,
  code: string,
  documentId: string,
  sourceUpdatedAt: string,
  renderedAt: string,
) {
  return { id, organizationId: org, code, documentId, sourceUpdatedAt: D(sourceUpdatedAt), renderedAt: D(renderedAt) };
}

describe("planPreviewRun", () => {
  it("renders missing previews first, then stale ones oldest-first", () => {
    const plan = planPreviewRun({
      now: NOW,
      activeDocs: [
        doc("d1", "org1", "hygiene", "2026-09-04T09:00:00Z"),
        doc("d2", "org1", "cleaning", "2026-09-04T09:00:00Z"),
        doc("d3", "org2", "hygiene", "2026-09-04T09:00:00Z"),
      ],
      previews: [
        preview("p1", "org1", "hygiene", "d1", "2026-09-04T08:00:00Z", "2026-09-03T00:00:00Z"),
        preview("p3", "org2", "hygiene", "d3", "2026-09-04T08:00:00Z", "2026-09-02T00:00:00Z"),
      ],
      disabledByOrg: new Map(),
    });
    assert.deepEqual(
      plan.toRender.map((c) => `${c.organizationId}/${c.code}`),
      ["org1/cleaning", "org2/hygiene", "org1/hygiene"],
    );
    assert.deepEqual(plan.toDelete, []);
  });

  it("skips previews that are up to date and re-renders when the document changed", () => {
    const plan = planPreviewRun({
      now: NOW,
      activeDocs: [
        doc("d1", "org1", "hygiene", "2026-09-04T08:00:00Z"),
        doc("d9", "org1", "cleaning", "2026-09-01T08:00:00Z"),
      ],
      previews: [
        preview("p1", "org1", "hygiene", "d1", "2026-09-04T08:00:00Z", "2026-09-04T08:05:00Z"),
        preview("p2", "org1", "cleaning", "d2-old", "2026-09-01T08:00:00Z", "2026-09-01T08:05:00Z"),
      ],
      disabledByOrg: new Map(),
    });
    assert.deepEqual(plan.toRender.map((c) => c.documentId), ["d9"]);
  });

  it("uses the newest active document when several periods overlap", () => {
    const plan = planPreviewRun({
      now: NOW,
      activeDocs: [
        doc("old", "org1", "hygiene", "2026-09-04T08:00:00Z", "2026-08-01"),
        doc("new", "org1", "hygiene", "2026-09-04T08:00:00Z", "2026-09-01"),
      ],
      previews: [],
      disabledByOrg: new Map(),
    });
    assert.deepEqual(plan.toRender.map((c) => c.documentId), ["new"]);
  });

  it("deletes previews of disabled journals and stale previews without an active document", () => {
    const plan = planPreviewRun({
      now: NOW,
      activeDocs: [doc("d1", "org1", "hygiene", "2026-09-04T08:00:00Z")],
      previews: [
        preview("p-disabled", "org1", "hygiene", "d1", "2026-09-04T08:00:00Z", "2026-09-04T08:05:00Z"),
        preview("p-stale", "org1", "cleaning", "gone", "2026-07-01T00:00:00Z", "2026-07-01T00:00:00Z"),
        preview("p-fresh", "org1", "fryer_oil", "gone2", "2026-09-01T00:00:00Z", "2026-09-01T00:00:00Z"),
      ],
      disabledByOrg: new Map([["org1", new Set(["hygiene"])]]),
    });
    assert.deepEqual(plan.toDelete.sort(), ["p-disabled", "p-stale"]);
    // Отключённый журнал не перерисовываем.
    assert.deepEqual(plan.toRender, []);
  });
});
