import assert from "node:assert/strict";
import test from "node:test";

import { buildTelegramWebAppKeyboard } from "@/lib/telegram-web-app";

test("buildTelegramWebAppKeyboard creates a Telegram web_app button", () => {
  assert.deepEqual(
    buildTelegramWebAppKeyboard({
      label: "Открыть кабинет",
      url: "https://wesetup.ru/mini",
    }),
    {
      inline_keyboard: [
        [
          {
            text: "Открыть кабинет",
            web_app: { url: "https://wesetup.ru/mini" },
          },
        ],
      ],
    }
  );
});
