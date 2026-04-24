import assert from "node:assert/strict";
import test from "node:test";

import { buildInlineQueryResults } from "@/lib/bot/inline-results";

test("buildInlineQueryResults uses web_app buttons and normalized mini urls", () => {
  const results = buildInlineQueryResults({
    miniAppBaseUrl: "https://wesetup.ru/mini",
    journals: [
      {
        code: "hygiene",
        name: "Гигиенический журнал",
        description: null,
      },
    ],
    equipment: [
      {
        id: "eq_1",
        name: "Холодильник",
        type: "Температура",
      },
    ],
  });

  assert.equal(results.length, 2);
  assert.deepEqual(results[0].reply_markup.inline_keyboard[0][0], {
    text: "Открыть в Mini App",
    web_app: { url: "https://wesetup.ru/mini/journals/hygiene" },
  });
  assert.deepEqual(results[1].reply_markup.inline_keyboard[0][0], {
    text: "Открыть в Mini App",
    web_app: { url: "https://wesetup.ru/mini/equipment" },
  });
});
