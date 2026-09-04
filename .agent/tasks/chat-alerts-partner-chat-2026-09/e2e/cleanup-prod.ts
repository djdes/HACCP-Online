import "dotenv/config";
import { db } from "@/lib/db";

/**
 * Уборка тестовых данных e2e/смоук из боевой БД (5433 оказался туннелем в прод).
 * DRY_RUN=1 — только посчитать и показать, ничего не менять.
 */
const DRY = process.env.DRY_RUN !== "0";
const SINCE = new Date("2026-09-03T15:00:00Z");
const TEST_BODY = [
  { body: { contains: "e2e" } },
  { body: { contains: "debug " } },
  { body: { contains: "Смоук-тест" } },
];

async function main() {
  const msgs = await db.supportMessage.findMany({
    where: { createdAt: { gte: SINCE }, OR: TEST_BODY },
    select: { id: true, threadId: true, author: true },
  });
  const msgIds = new Set(msgs.map((m) => m.id));
  const threadIds = Array.from(new Set(msgs.map((m) => m.threadId)));
  const threads = await db.supportThread.findMany({
    where: { id: { in: threadIds } },
    select: { id: true, key: true, organizationName: true, unreadForClient: true, createdAt: true, messages: { select: { id: true, author: true } } },
  });
  const onlyTest = threads.filter((t) => t.messages.every((m) => msgIds.has(m.id)));
  const mixed = threads.filter((t) => !onlyTest.includes(t));

  // Колокольчики «support.reply», собранные только из моих сообщений.
  const notifs = await db.notification.findMany({
    where: { kind: "support.reply", createdAt: { gte: SINCE } },
    select: { id: true, items: true },
  });
  const notifToDelete = notifs.filter((n) => {
    const items = Array.isArray(n.items) ? (n.items as Array<{ id?: string }>) : [];
    return items.length > 0 && items.every((it) => it.id && msgIds.has(it.id));
  });

  const partner = await db.partner.findUnique({ where: { slug: "e2e-partner" }, select: { id: true } });

  console.log(JSON.stringify({
    dryRun: DRY,
    messagesToDelete: msgs.length,
    threadsOnlyTestToDelete: onlyTest.length,
    threadsMixedToFix: mixed.map((t) => ({
      id: t.id, org: t.organizationName, unreadForClient: t.unreadForClient,
      testOperatorMsgs: t.messages.filter((m) => msgIds.has(m.id) && m.author === "operator").length,
      testMsgs: t.messages.filter((m) => msgIds.has(m.id)).length,
    })),
    notificationsToDelete: notifToDelete.length,
    e2ePartner: partner?.id ?? null,
  }, null, 1));
  if (DRY) return;

  await db.$transaction(async (tx) => {
    // Сначала поправить непрочитанное в смешанных ветках.
    for (const t of mixed) {
      const removedOps = t.messages.filter((m) => msgIds.has(m.id) && m.author === "operator").length;
      const removedClient = t.messages.filter((m) => msgIds.has(m.id) && m.author === "client").length;
      const rest = await tx.supportMessage.findFirst({
        where: { threadId: t.id, id: { notIn: Array.from(msgIds) } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      await tx.supportThread.update({
        where: { id: t.id },
        data: {
          unreadForClient: Math.max(0, t.unreadForClient - removedOps),
          unreadForStaff: removedClient > 0 ? { decrement: 0 } : undefined,
          lastMessageAt: rest?.createdAt ?? t.createdAt,
        },
      });
    }
    await tx.notification.deleteMany({ where: { id: { in: notifToDelete.map((n) => n.id) } } });
    await tx.supportMessage.deleteMany({ where: { id: { in: Array.from(msgIds) } } });
    await tx.supportThread.deleteMany({ where: { id: { in: onlyTest.map((t) => t.id) } } });
    if (partner) {
      await tx.partnerClient.deleteMany({ where: { partnerId: partner.id } });
      await tx.partnerUser.deleteMany({ where: { partnerId: partner.id } });
      await tx.partner.delete({ where: { id: partner.id } });
    }
  });
  console.log("cleanup done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
