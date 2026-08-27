/**
 * Backfill `User.emailVerifiedAt` для тех, кто подтвердил почту ДО того,
 * как у нас появился флаг.
 *
 * Предыстория: старый `POST /api/profile/complete` требовал шестизначный
 * код из письма, проверял его и УДАЛЯЛ `EmailVerification`, нигде не
 * фиксируя факт подтверждения — колонки в `User` тогда просто не было.
 * Новая карточка «Подтвердите почту» на `/settings` читает
 * `emailVerifiedAt`, поэтому у всех старых аккаунтов она висит, хотя
 * почту они подтверждали.
 *
 * Критерий «этот человек код вводил»: у него заполнен телефон ИЛИ имя
 * отличается от почты. И то и другое проставляла только старая анкета
 * (или полная регистрация через `register/confirm`), а туда нельзя было
 * попасть без кода. Аккаунты из мгновенной регистрации, которые анкету
 * не проходили (`name === email`, телефона нет), остаются
 * неподтверждёнными — им карточка показывается по праву.
 *
 * Скрипт идемпотентный: трогает только строки с `emailVerifiedAt IS NULL`.
 * По умолчанию dry-run.
 *
 * Usage:
 *   tsx scripts/backfill-email-verified.ts                 # dry-run
 *   tsx scripts/backfill-email-verified.ts --apply         # запись
 *   tsx scripts/backfill-email-verified.ts --apply --before 2026-08-27
 */
import { db } from "../src/lib/db";

function parseBefore(argv: string[]): Date {
  const idx = argv.indexOf("--before");
  if (idx === -1 || !argv[idx + 1]) {
    // Дефолт — «сейчас»: код, который пишет флаг, уже задеплоен, поэтому
    // новые аккаунты и так получают отметку честным путём, а всё, что
    // создано раньше запуска скрипта, — это ровно легаси.
    return new Date();
  }
  const parsed = new Date(argv[idx + 1]);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`--before: не дата — ${argv[idx + 1]}`);
  }
  return parsed;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const before = parseBefore(process.argv);

  // «Имя не равно почте» выражаем через NOT name = email; Prisma не умеет
  // сравнивать две колонки, поэтому фильтруем в памяти по выборке —
  // пользователей немного, а условие важно не размазывать по сырому SQL.
  const candidates = await db.user.findMany({
    where: {
      emailVerifiedAt: null,
      createdAt: { lt: before },
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      createdAt: true,
    },
  });

  const targets = candidates.filter(
    (u) =>
      Boolean(u.phone?.trim()) ||
      (Boolean(u.name?.trim()) && u.name?.trim() !== u.email),
  );

  const totalNull = candidates.length;
  console.log(`Без отметки о подтверждении: ${totalNull}`);
  console.log(`Подходят под backfill:       ${targets.length}`);
  console.log(`Останутся неподтверждёнными: ${totalNull - targets.length}`);

  if (!apply) {
    console.log("\nDry-run. Запустите с --apply, чтобы записать.");
    for (const u of targets.slice(0, 20)) {
      console.log(`  ${u.email} · ${u.name ?? "—"} · ${u.phone ?? "без телефона"}`);
    }
    if (targets.length > 20) console.log(`  … ещё ${targets.length - 20}`);
    return;
  }

  let updated = 0;
  for (const user of targets) {
    // Ставим `createdAt`, а не «сейчас»: отметка должна отражать момент,
    // когда человек реально подтверждал почту, иначе в аудите все старые
    // аккаунты выглядят подтверждёнными в день миграции.
    const res = await db.user.updateMany({
      where: { id: user.id, emailVerifiedAt: null },
      data: { emailVerifiedAt: user.createdAt },
    });
    updated += res.count;
  }

  const leftNull = await db.user.count({ where: { emailVerifiedAt: null } });
  const leftNullWithPhone = await db.user.count({
    where: { emailVerifiedAt: null, phone: { not: null } },
  });
  console.log(`\nОбновлено: ${updated}`);
  console.log(`Осталось без отметки: ${leftNull} (из них с телефоном: ${leftNullWithPhone})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
