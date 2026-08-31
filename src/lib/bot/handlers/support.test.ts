/**
 * Тесты входящей поддержки бота.
 *
 * Grammy-контекст не мокаем: вся логика вынесена в `handleSupportText`,
 * который принимает снимок сообщения и подставные зависимости — так
 * проверяются именно решения (создать обращение, промолчать, ответить
 * подсказкой), а не обёртка над Telegram API.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSupportAdminMessage,
  describeSupportSender,
  extractFeedbackReportId,
  handleSupportText,
  telegramDisplayName,
  type SupportDeps,
  type SupportMessageInput,
} from "@/lib/bot/handlers/support";

type Calls = {
  reports: Array<Record<string, unknown>>;
  adminTexts: string[];
  adminEmails: number;
  statuses: Array<{ reportId: string; telegram: boolean; email: boolean }>;
  replies: Array<{ reportId: string; message: string }>;
};

function makeDeps(
  calls: Calls,
  overrides?: Partial<SupportDeps>
): Partial<SupportDeps> {
  return {
    isPlatformAdminChat: (chatId) => chatId === "999",
    allowMessage: () => true,
    findUserByChatId: async () => null,
    createReport: async (args) => {
      calls.reports.push(args);
      return { id: "rep_1", createdAt: new Date("2026-08-28T10:00:00Z") };
    },
    notifyAdminTelegram: async (text) => {
      calls.adminTexts.push(text);
      return true;
    },
    emailAdmin: async () => {
      calls.adminEmails += 1;
      return true;
    },
    markAdminNotified: async (args) => {
      calls.statuses.push(args);
    },
    replyToReport: async (args) => {
      calls.replies.push(args);
      return ["Telegram", "почта"];
    },
    ...overrides,
  };
}

function emptyCalls(): Calls {
  return {
    reports: [],
    adminTexts: [],
    adminEmails: 0,
    statuses: [],
    replies: [],
  };
}

const baseInput: SupportMessageInput = {
  chatType: "private",
  chatId: "111",
  fromId: "111",
  firstName: "Иван",
  lastName: "Иванов",
  username: "ivan",
  text: "Не открывается журнал уборки",
};

test("текст в личке создаёт обращение, уведомляет админа и подтверждает автору", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(baseInput, makeDeps(calls));

  assert.equal(outcome.action, "created");
  assert.equal(outcome.reportId, "rep_1");
  assert.match(outcome.reply ?? "", /передано в поддержку/);

  assert.equal(calls.reports.length, 1);
  assert.deepEqual(calls.reports[0].telegramChatId, "111");
  assert.deepEqual(calls.reports[0].message, "Не открывается журнал уборки");
  assert.deepEqual(calls.reports[0].userId, null);
  assert.deepEqual(calls.reports[0].userName, "Иван Иванов");

  assert.equal(calls.adminTexts.length, 1);
  assert.match(calls.adminTexts[0], /#fb_rep_1/);
  assert.match(calls.adminTexts[0], /Не открывается журнал уборки/);

  assert.equal(calls.adminEmails, 1);
  assert.deepEqual(calls.statuses, [
    { reportId: "rep_1", telegram: true, email: true },
  ]);
});

test("привязанный пользователь попадает в обращение вместе с организацией", async () => {
  const calls = emptyCalls();
  await handleSupportText(
    baseInput,
    makeDeps(calls, {
      findUserByChatId: async () => ({
        id: "user-1",
        name: "Мария Петрова",
        email: "maria@cafe.ru",
        organizationId: "org-1",
        organizationName: "Кафе «Ромашка»",
      }),
    })
  );

  assert.deepEqual(calls.reports[0].userId, "user-1");
  assert.deepEqual(calls.reports[0].userEmail, "maria@cafe.ru");
  assert.deepEqual(calls.reports[0].organizationId, "org-1");
  assert.match(calls.adminTexts[0], /Кафе «Ромашка»/);
});

test("групповые чаты игнорируются — там живут рабочие уведомления", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(
    { ...baseInput, chatType: "supergroup" },
    makeDeps(calls)
  );

  assert.equal(outcome.action, "ignored");
  assert.equal(outcome.reply, null);
  assert.equal(calls.reports.length, 0);
});

test("неизвестная команда — подсказка про /help, обращение не создаётся", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(
    { ...baseInput, text: "/nonsense" },
    makeDeps(calls)
  );

  assert.equal(outcome.action, "unknown-command");
  assert.match(outcome.reply ?? "", /\/help/);
  assert.equal(calls.reports.length, 0);
});

test("превышение лимита — молчим, чтобы не отвечать спамеру на каждое сообщение", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(
    baseInput,
    makeDeps(calls, { allowMessage: () => false })
  );

  assert.equal(outcome.action, "rate-limited");
  assert.equal(outcome.reply, null);
  assert.equal(calls.reports.length, 0);
});

test("реплай из админ-чата отправляет ответ по обращению из тега", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(
    {
      ...baseInput,
      chatId: "999",
      fromId: "999",
      text: "Починили, обновите страницу",
      replyToText: "💬 Сообщение боту\nтекст\n\n#fb_rep_42\nОтветить: свайп",
    },
    makeDeps(calls)
  );

  assert.equal(outcome.action, "admin-reply");
  assert.deepEqual(calls.replies, [
    { reportId: "rep_42", message: "Починили, обновите страницу" },
  ]);
  assert.match(outcome.reply ?? "", /Telegram · почта/);
  assert.equal(calls.reports.length, 0);
});

test("реплай без тега — просим ответить на сообщение с #fb_", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(
    {
      ...baseInput,
      chatId: "999",
      fromId: "999",
      text: "ок",
      replyToText: "Просто какое-то сообщение",
    },
    makeDeps(calls)
  );

  assert.equal(outcome.action, "admin-reply-no-tag");
  assert.match(outcome.reply ?? "", /#fb_/);
  assert.equal(calls.replies.length, 0);
});

test("ответ, не дошедший ни по одному каналу, честно об этом говорит", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(
    {
      ...baseInput,
      chatId: "999",
      fromId: "999",
      text: "ответ",
      replyToText: "#fb_rep_7",
    },
    makeDeps(calls, { replyToReport: async () => [] })
  );

  assert.equal(outcome.action, "admin-reply");
  assert.match(outcome.reply ?? "", /Не доставлено/);
});

test("падение БД не роняет обработчик — пользователь получает понятный ответ", async () => {
  const calls = emptyCalls();
  const outcome = await handleSupportText(
    baseInput,
    makeDeps(calls, {
      createReport: async () => {
        throw new Error("db down");
      },
    })
  );

  assert.equal(outcome.action, "error");
  assert.match(outcome.reply ?? "", /попробуйте ещё раз/);
});

test("extractFeedbackReportId достаёт id только из тега", () => {
  assert.equal(extractFeedbackReportId("хвост #fb_clx123 хвост"), "clx123");
  assert.equal(extractFeedbackReportId("без тега"), null);
  assert.equal(extractFeedbackReportId(null), null);
});

test("telegramDisplayName собирает имя из профиля Telegram", () => {
  assert.equal(
    telegramDisplayName({ firstName: "Иван", lastName: "Иванов" }),
    "Иван Иванов"
  );
  assert.equal(telegramDisplayName({ username: "ivan" }), "@ivan");
  assert.equal(telegramDisplayName({}), null);
});

test("describeSupportSender отмечает непривязанный аккаунт", () => {
  assert.equal(
    describeSupportSender({
      userName: "Иван",
      userEmail: "ivan@x.ru",
      linked: true,
    }),
    "Иван · ivan@x.ru"
  );
  assert.equal(
    describeSupportSender({ telegramUsername: "ivan", linked: false }),
    "@ivan · не привязан к аккаунту"
  );
  assert.equal(describeSupportSender({ linked: false }), "не привязан к аккаунту");
});

test("buildSupportAdminMessage экранирует пользовательский текст", () => {
  const text = buildSupportAdminMessage({
    reportId: "rep_1",
    message: "<script>alert(1)</script>",
    sender: "Иван & Ко",
  });

  assert.ok(!text.includes("<script>"));
  assert.match(text, /&lt;script&gt;/);
  assert.match(text, /Иван &amp; Ко/);
  assert.match(text, /#fb_rep_1/);
});

test("реплай на сообщение чата дописывает ответ оператора в переписку", async () => {
  const chatReplies: Array<{ threadId: string; message: string }> = [];
  const reportReplies: string[] = [];

  const outcome = await handleSupportText(
    {
      chatType: "private",
      chatId: "admin_1",
      fromId: "admin_1",
      text: "сейчас посмотрим",
      replyToText: "💬 Онлайн-чат\nвопрос\n\n#chat_thr_9\nОтветить: свайп",
    },
    {
      isPlatformAdminChat: () => true,
      replyToChat: async ({ threadId, message }) => {
        chatReplies.push({ threadId, message });
      },
      replyToReport: async ({ reportId }) => {
        reportReplies.push(reportId);
        return ["in-app"];
      },
    }
  );

  assert.equal(outcome.action, "admin-chat-reply");
  assert.equal(outcome.threadId, "thr_9");
  assert.deepEqual(chatReplies, [
    { threadId: "thr_9", message: "сейчас посмотрим" },
  ]);
  // Ветка чата не должна утечь в обращения: иначе один ответ попал бы и в
  // переписку, и отдельным письмом как ответ на обращение.
  assert.deepEqual(reportReplies, []);
});

test("реплай на обращение по-прежнему идёт в обращения, а не в чат", async () => {
  const chatReplies: string[] = [];
  const reportReplies: string[] = [];

  const outcome = await handleSupportText(
    {
      chatType: "private",
      chatId: "admin_1",
      fromId: "admin_1",
      text: "ответ",
      replyToText: "💬 Сообщение боту\nтекст\n\n#fb_rep_5",
    },
    {
      isPlatformAdminChat: () => true,
      replyToChat: async ({ threadId }) => {
        chatReplies.push(threadId);
      },
      replyToReport: async ({ reportId }) => {
        reportReplies.push(reportId);
        return ["email"];
      },
    }
  );

  assert.equal(outcome.action, "admin-reply");
  assert.deepEqual(reportReplies, ["rep_5"]);
  assert.deepEqual(chatReplies, []);
});
