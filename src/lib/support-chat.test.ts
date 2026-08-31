import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupportChatTag,
  composeSupportChatAdminMessage,
  extractSupportThreadId,
} from "@/lib/support-chat";

// Тот же приём, что и в escapeTelegramHtml — тест не должен быть мягче.
const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

test("extractSupportThreadId reads the anchor out of a replied message", () => {
  const text = composeSupportChatAdminMessage({
    threadId: "thr_1",
    body: "не открывается журнал",
    userName: "Иван",
    userEmail: "ivan@x.ru",
    organizationName: "ООО БФС",
    phone: "+79263740794",
    previousMessages: 0,
    escape,
    appUrl: "https://wesetup.ru",
  });

  assert.equal(extractSupportThreadId(text), "thr_1");
});

test("extractSupportThreadId ignores feedback anchors", () => {
  // У обращений свой тег #fb_. Если чат начнёт его подхватывать, ответ на
  // обращение улетит в чужую ветку переписки.
  assert.equal(extractSupportThreadId("хвост #fb_abc123 хвост"), null);
  assert.equal(extractSupportThreadId(buildSupportChatTag("abc123")), "abc123");
  assert.equal(extractSupportThreadId(null), null);
  assert.equal(extractSupportThreadId("без тега"), null);
});

test("composeSupportChatAdminMessage carries who is writing", () => {
  const text = composeSupportChatAdminMessage({
    threadId: "thr_2",
    body: "вопрос",
    userName: "Анна",
    userEmail: "anna@x.ru",
    organizationName: "Кафе",
    phone: null,
    previousMessages: 4,
    escape,
    appUrl: "https://wesetup.ru",
  });

  // Оператор отвечает свайпом из Telegram — весь контекст обязан быть в
  // самом сообщении, иначе он не поймёт, кому отвечает.
  assert.match(text, /Анна · anna@x\.ru/);
  assert.match(text, /Кафе/);
  assert.match(text, /реплик в ветке: 4/);
  assert.doesNotMatch(text, /📞/);
});

test("composeSupportChatAdminMessage escapes the body", () => {
  const text = composeSupportChatAdminMessage({
    threadId: "thr_3",
    body: "<b>жирный</b>",
    previousMessages: 0,
    escape,
    appUrl: "https://wesetup.ru",
  });

  // parse_mode HTML: неэкранированный тег из пользовательского текста
  // ломает сообщение, и Telegram отвечает 400 — обращение не дойдёт.
  assert.match(text, /&lt;b&gt;жирный/);
});
