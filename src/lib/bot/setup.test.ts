import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTelegramMenuButton,
  WESETUP_BOT_PROFILE,
} from "@/lib/bot/setup";

test("buildTelegramMenuButton points to the Mini App root", () => {
  assert.deepEqual(buildTelegramMenuButton("https://wesetup.ru"), {
    menu_button: {
      type: "web_app",
      text: WESETUP_BOT_PROFILE.menuButtonText,
      web_app: { url: "https://wesetup.ru/mini" },
    },
  });
});
