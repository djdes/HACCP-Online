import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeIdeaStatusChange,
  filterIdeas,
  isIdeaStatus,
  sortIdeas,
  validateIdeaInput,
} from "@/lib/ideas/rules";

describe("validateIdeaInput", () => {
  it("схлопывает пробелы, режет по длине, пустое описание → null", () => {
    const ok = validateIdeaInput({ title: "  Экспорт   в Excel ", description: "  " });
    assert.deepEqual(ok, { ok: true, title: "Экспорт в Excel", description: null });
    assert.equal(validateIdeaInput({ title: "Эй", description: "" }).ok, false);
    assert.equal(validateIdeaInput({ title: "x".repeat(121), description: "" }).ok, false);
    assert.equal(validateIdeaInput({ title: "Нормальная идея", description: "y".repeat(2001) }).ok, false);
    assert.equal(validateIdeaInput({ title: 42, description: null }).ok, false);
  });
});

describe("sortIdeas / filterIdeas", () => {
  const ideas = [
    { id: "a", votes: 3, createdAt: "2026-09-01T00:00:00Z", status: "new" },
    { id: "b", votes: 9, createdAt: "2026-08-01T00:00:00Z", status: "planned" },
    { id: "c", votes: 3, createdAt: "2026-09-05T00:00:00Z", status: "done" },
    { id: "d", votes: 0, createdAt: "2026-09-06T00:00:00Z", status: "declined" },
  ];
  it("популярные: по голосам, при равенстве — новее выше; новые: по дате", () => {
    assert.deepEqual(sortIdeas(ideas, "top").map((i) => i.id), ["b", "c", "a", "d"]);
    assert.deepEqual(sortIdeas(ideas, "new").map((i) => i.id), ["d", "c", "a", "b"]);
  });
  it("фильтры: открытые, сделанные, все", () => {
    assert.deepEqual(filterIdeas(ideas, "open").map((i) => i.id), ["a", "b"]);
    assert.deepEqual(filterIdeas(ideas, "done").map((i) => i.id), ["c"]);
    assert.equal(filterIdeas(ideas, "all").length, 4);
  });
});

describe("statuses", () => {
  it("isIdeaStatus и текст уведомления", () => {
    assert.equal(isIdeaStatus("planned"), true);
    assert.equal(isIdeaStatus("wip"), false);
    assert.equal(describeIdeaStatusChange("Экспорт в Excel", "planned"), "Идея «Экспорт в Excel» — в планах");
    assert.match(describeIdeaStatusChange("x".repeat(80), "done"), /^Идея «x{57}…» — сделано$/);
  });
});
