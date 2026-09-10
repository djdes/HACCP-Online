import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { findDrops, formatDropsMessage } from "@/lib/seo-position-alerts";
import { buildMatrix } from "@/lib/topvisor";

/** Собирает матрицу из пар «вчера → сегодня» в тех же ключах, что API. */
function matrixOf(pairs: Array<[string, string | null, string | null]>) {
  return buildMatrix({
    headers: { dates: ["2026-09-10", "2026-09-03"] },
    keywords: pairs.map(([phrase, before, after]) => ({
      name: phrase,
      positionsData: {
        ...(before
          ? { "2026-09-03:1:1": { position: before, relevant_url: "https://wesetup.ru/x" } }
          : {}),
        ...(after ? { "2026-09-10:1:1": { position: after } } : {}),
      },
    })),
  });
}

describe("findDrops", () => {
  it("ловит вылет из ТОП-10 даже при небольшой просадке", () => {
    const { drops } = findDrops(matrixOf([["хассп", "9", "12"]]));
    assert.equal(drops.length, 1);
    assert.equal(drops[0].reason, "out-of-top10");
    assert.equal(drops[0].delta, -3);
  });

  it("молчит про мелкое дрожание внутри ТОП-10", () => {
    // 3 → 6 неприятно, но это шум выдачи, а не повод для алерта.
    assert.deepEqual(findDrops(matrixOf([["хассп", "3", "6"]])).drops, []);
  });

  it("ловит просадку на 5+ пунктов вне ТОП-10", () => {
    const { drops } = findDrops(matrixOf([["хассп", "40", "52"]]));
    assert.equal(drops[0].reason, "dropped");
    assert.equal(drops[0].delta, -12);
  });

  it("ловит пропажу из выдачи", () => {
    const { drops } = findDrops(matrixOf([["хассп", "14", null]]));
    assert.equal(drops[0].reason, "lost");
    assert.equal(drops[0].to, null);
  });

  it("не считает падением рост и новые фразы", () => {
    const { drops } = findDrops(
      matrixOf([
        ["выросла", "30", "8"],
        ["новая", null, "44"],
        ["на месте", "12", "12"],
      ])
    );
    assert.deepEqual(drops, []);
  });

  it("ставит вылет из ТОП-10 выше крупной просадки в хвосте", () => {
    const { drops } = findDrops(
      matrixOf([
        ["хвост", "60", "95"],
        ["важная", "8", "11"],
      ])
    );
    assert.deepEqual(
      drops.map((d) => d.phrase),
      ["важная", "хвост"]
    );
  });

  it("ничего не выдаёт, когда срез всего один", () => {
    const single = findDrops(
      buildMatrix({
        headers: { dates: ["2026-09-10"] },
        keywords: [{ name: "х", positionsData: { "2026-09-10:1:1": { position: "5" } } }],
      })
    );
    assert.equal(single.previousDate, null);
    assert.deepEqual(single.drops, []);
  });
});

describe("formatDropsMessage", () => {
  it("перечисляет падения и обрезает длинный хвост", () => {
    const result = findDrops(
      matrixOf(
        Array.from({ length: 12 }, (_, i) => [`фраза ${i}`, "8", "40"] as [string, string, string])
      )
    );
    const text = formatDropsMessage(result, "Яндекс · Москва", 10);
    assert.match(text, /Позиции Яндекс · Москва/);
    assert.match(text, /8 → 40/);
    assert.match(text, /…и ещё 2/);
    assert.match(text, /root\/seo\/positions/);
  });
});
