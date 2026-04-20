import assert from "node:assert/strict";
import test from "node:test";

import {
  TELEGRAM_COMMANDS,
  buildTelegramLinkedStartReply,
  buildTelegramUnlinkedStartReply,
} from "@/lib/bot/start-response";

test("buildTelegramLinkedStartReply mentions the next action for staff", () => {
  const reply = buildTelegramLinkedStartReply(
    {
      name: "Иван",
      role: "cook",
      isRoot: false,
      kind: "staff",
      nextActionLabel: "Входной контроль",
    },
    "https://wesetup.ru/mini/o/obl_1"
  );

  assert.match(reply.text, /Следующее действие: Входной контроль/);
  assert.equal(reply.buttonLabel, "Открыть задачу");
  assert.equal(reply.buttonUrl, "https://wesetup.ru/mini/o/obl_1");
});

test("buildTelegramLinkedStartReply returns completed-today copy for staff without next action", () => {
  const reply = buildTelegramLinkedStartReply(
    {
      name: "Анна",
      role: "waiter",
      isRoot: false,
      kind: "staff",
      nextActionLabel: null,
    },
    "https://wesetup.ru/mini"
  );

  assert.match(reply.text, /На сегодня обязательные журналы уже закрыты/);
  assert.equal(reply.buttonLabel, "Открыть журналы");
  assert.equal(reply.buttonUrl, "https://wesetup.ru/mini");
});

test("buildTelegramLinkedStartReply includes a manager summary", () => {
  const reply = buildTelegramLinkedStartReply(
    {
      name: "Ольга",
      role: "manager",
      isRoot: false,
      kind: "manager",
      pendingCount: 4,
      employeesWithPending: 2,
    },
    "https://wesetup.ru/mini"
  );

  assert.match(reply.text, /Открыто задач: 4/);
  assert.match(reply.text, /Сотрудников с открытыми задачами: 2/);
  assert.equal(reply.buttonLabel, "Открыть кабинет");
  assert.equal(reply.buttonUrl, "https://wesetup.ru/mini");
});

test("buildTelegramLinkedStartReply falls back when mini app is unavailable", () => {
  const reply = buildTelegramLinkedStartReply(
    {
      name: "Анна",
      role: "waiter",
      isRoot: false,
      kind: "staff",
      nextActionLabel: "Гигиена",
    },
    null
  );

  assert.equal(
    reply.text,
    "Готово, Анна. Мини-приложение пока не настроено, свяжитесь с руководителем."
  );
  assert.equal(reply.buttonLabel, undefined);
  assert.equal(reply.buttonUrl, undefined);
});

test("buildTelegramUnlinkedStartReply keeps start guidance short", () => {
  const reply = buildTelegramUnlinkedStartReply();

  assert.equal(
    reply.text,
    "Аккаунт пока не привязан. Откройте персональную ссылку из приглашения руководителя."
  );
});

test("TELEGRAM_COMMANDS registers a single start entry", () => {
  assert.deepEqual(TELEGRAM_COMMANDS, [
    {
      command: "start",
      description: "Открыть Wesetup",
    },
  ]);
});
