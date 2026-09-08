/**
 * Вход сотрудника по телефону.
 *
 * Главное здесь — разбор коллизий. `User.phone` уникален только внутри
 * организации (`/api/join/[token]` следит именно за этим), и на проде
 * 2026-09-08 три номера действительно повторяются у разных людей с
 * паролями. Записи в журнале подписываются именем, поэтому «войти хоть
 * кем-нибудь из подходящих» — недопустимо.
 */
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { describe, it } from "node:test";

import { verifyPhonePassword, type UserFinder } from "@/lib/credentials";

/** Пользователь ровно в том виде, в каком его читает функция. */
function user(over: {
  id: string;
  passwordHash: string;
  name?: string;
  phone?: string;
}) {
  return {
    id: over.id,
    name: over.name ?? over.id,
    phone: over.phone ?? "+79851234567",
    passwordHash: over.passwordHash,
    isActive: true,
    archivedAt: null,
    organization: { id: "org-1", name: "Кафе" },
  } as never;
}

/** Заглушка Prisma: отдаёт заранее заданных кандидатов. */
function finderOf(rows: unknown[]): UserFinder & { lastArgs: unknown } {
  const stub = {
    lastArgs: undefined as unknown,
    user: {
      findMany: async (args: unknown) => {
        stub.lastArgs = args;
        return rows as never;
      },
    },
  };
  return stub;
}

const RIGHT = bcrypt.hashSync("verno123", 10);
const OTHER = bcrypt.hashSync("drugoi456", 10);

describe("verifyPhonePassword", () => {
  it("один кандидат с верным паролем — пускаем", async () => {
    const found = await verifyPhonePassword(
      "+7 985 123-45-67",
      "verno123",
      finderOf([user({ id: "u1", passwordHash: RIGHT })]),
    );
    assert.equal(found?.id, "u1");
  });

  it("номер в любом формате приводится к единому виду", async () => {
    const finder = finderOf([user({ id: "u1", passwordHash: RIGHT })]);
    await verifyPhonePassword("8 (985) 123-45-67", "verno123", finder);
    const where = (finder.lastArgs as { where: { phone: string } }).where;
    assert.equal(where.phone, "+79851234567");
  });

  it("неверный пароль — отказ", async () => {
    const found = await verifyPhonePassword(
      "+79851234567",
      "ne-tot",
      finderOf([user({ id: "u1", passwordHash: RIGHT })]),
    );
    assert.equal(found, null);
  });

  it("нет кандидатов — отказ, но без раннего выхода", async () => {
    // Ранний return выдал бы существование номера разницей во времени
    // ответа: «нет такого» за 5 мс против «не тот пароль» за 100 мс.
    const started = Date.now();
    const found = await verifyPhonePassword("+79851234567", "verno123", finderOf([]));
    assert.equal(found, null);
    assert.ok(
      Date.now() - started > 20,
      "сравнение с фиктивным хешем должно выполняться и когда кандидатов нет",
    );
  });

  it("мусор вместо номера — отказ, тоже не мгновенный", async () => {
    const started = Date.now();
    const found = await verifyPhonePassword("абв", "verno123", finderOf([]));
    assert.equal(found, null);
    assert.ok(Date.now() - started > 20);
  });

  describe("коллизии номера", () => {
    it("два человека на номере, пароль подошёл одному — пускаем именно его", async () => {
      const found = await verifyPhonePassword(
        "+79851234567",
        "drugoi456",
        finderOf([
          user({ id: "u1", passwordHash: RIGHT }),
          user({ id: "u2", passwordHash: OTHER }),
        ]),
      );
      assert.equal(found?.id, "u2", "пароль однозначно определяет человека");
    });

    it("совпали и номер, и пароль — отказ, угадывать нельзя", async () => {
      const found = await verifyPhonePassword(
        "+79851234567",
        "verno123",
        finderOf([
          user({ id: "u1", passwordHash: RIGHT }),
          user({ id: "u2", passwordHash: RIGHT }),
        ]),
      );
      assert.equal(
        found,
        null,
        "иначе журнал подписался бы именем случайного из двоих",
      );
    });
  });

  it("в выборку не попадают уволенные и те, кому вход закрыт", async () => {
    const finder = finderOf([user({ id: "u1", passwordHash: RIGHT })]);
    await verifyPhonePassword("+79851234567", "verno123", finder);
    const where = (finder.lastArgs as {
      where: Record<string, unknown>;
    }).where;

    assert.equal(where.isActive, true);
    assert.equal(where.archivedAt, null);
    // Пустой хеш ставят staff-create, импорт и Mini App — это явный
    // признак «войти нельзя», и такие строки не должны даже читаться.
    assert.deepEqual(where.passwordHash, { not: "" });
  });

  it("выборка кандидатов ограничена — сотня хешей на попытку положила бы сервер", async () => {
    const finder = finderOf([user({ id: "u1", passwordHash: RIGHT })]);
    await verifyPhonePassword("+79851234567", "verno123", finder);
    const take = (finder.lastArgs as { take: number }).take;
    assert.ok(take > 0 && take <= 5, `take=${take}`);
  });
});
