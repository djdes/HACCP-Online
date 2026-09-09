import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildIcs, escapeIcsText, foldIcsLine, isIsoDate } from "@/lib/calendar/ics";

const now = new Date("2026-09-10T09:00:00.000Z");

describe("escapeIcsText", () => {
  it("экранирует запятые, точки с запятой, переносы и обратные слэши", () => {
    assert.equal(escapeIcsText("a,b;c\nd\\e"), "a\\,b\\;c\\nd\\\\e");
  });
});

describe("foldIcsLine", () => {
  it("короткая строка не трогается, длинная режется по 75 байт с пробелом", () => {
    assert.equal(foldIcsLine("SUMMARY:x"), "SUMMARY:x");
    const long = "SUMMARY:" + "я".repeat(60); // кириллица — 2 байта на символ
    const folded = foldIcsLine(long);
    const parts = folded.split("\r\n");
    assert.ok(parts.length >= 2);
    for (const [i, part] of parts.entries()) {
      assert.ok(Buffer.byteLength(part, "utf8") <= 75, `part ${i} too long`);
      if (i > 0) assert.ok(part.startsWith(" "));
    }
    // Склейка обратно даёт исходную строку без потерь символов.
    assert.equal(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join(""), long);
  });
});

describe("isIsoDate", () => {
  it("принимает только реальные даты ГГГГ-ММ-ДД", () => {
    assert.equal(isIsoDate("2026-02-28"), true);
    assert.equal(isIsoDate("2026-02-30"), false);
    assert.equal(isIsoDate("2026-9-1"), false);
    assert.equal(isIsoDate("nope"), false);
  });
});

describe("buildIcs", () => {
  it("события на весь день, отсортированы по дате, UID с доменом, битые даты пропущены", () => {
    const ics = buildIcs(
      [
        { uid: "capa-2", kind: "capa", date: "2026-09-12", title: "CAPA: Течь, холодильник" },
        { uid: "sub-1", kind: "subscription", date: "2026-09-11", title: "Окончание подписки WeSetup", description: "Продлите заранее" },
        { uid: "bad-1", kind: "batch", date: "нет даты", title: "x" },
      ],
      { calendarName: "WeSetup — Кафе", now }
    );
    const lines = ics.split("\r\n");
    assert.equal(lines[0], "BEGIN:VCALENDAR");
    assert.ok(lines.includes("X-WR-CALNAME:WeSetup — Кафе"));
    const uids = lines.filter((l) => l.startsWith("UID:"));
    assert.deepEqual(uids, ["UID:sub-1@wesetup.ru", "UID:capa-2@wesetup.ru"]);
    assert.ok(lines.includes("DTSTART;VALUE=DATE:20260911"));
    assert.ok(lines.includes("DTEND;VALUE=DATE:20260912"));
    assert.ok(lines.includes("SUMMARY:CAPA: Течь\\, холодильник"));
    assert.ok(lines.includes("DESCRIPTION:Продлите заранее"));
    assert.ok(lines.includes("DTSTAMP:20260910T090000Z"));
    assert.equal(lines.filter((l) => l === "BEGIN:VEVENT").length, 2);
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  });
});
