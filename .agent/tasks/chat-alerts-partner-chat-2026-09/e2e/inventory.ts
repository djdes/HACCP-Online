import "dotenv/config";
import { db } from "@/lib/db";
async function main() {
  const testMsgs = await db.supportMessage.findMany({
    where: { OR: [{ body: { contains: "e2e" } }, { body: { contains: "debug " } }, { body: { contains: "Смоук-тест" } }] },
    select: { id: true, threadId: true, author: true, body: true, broadcastId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  const byBroadcast = new Map<string, number>();
  for (const m of testMsgs) if (m.broadcastId) byBroadcast.set(m.broadcastId, (byBroadcast.get(m.broadcastId) ?? 0) + 1);
  const threadIds = Array.from(new Set(testMsgs.map((m) => m.threadId)));
  const threads = await db.supportThread.findMany({
    where: { id: { in: threadIds } },
    select: { id: true, key: true, organizationName: true, unreadForClient: true, unreadForStaff: true, _count: { select: { messages: true } } },
  });
  const onlyTest = threads.filter((t) => t._count.messages === testMsgs.filter((m) => m.threadId === t.id).length);
  const partner = await db.partner.findUnique({ where: { slug: "e2e-partner" }, select: { id: true, clients: { select: { id: true, organizationId: true, detachedAt: true } }, members: { select: { userId: true } } } });
  const detachedByMe = await db.partnerClient.findMany({ where: { organizationId: "cmtjt28h20000t49mvzncgpte", detachedBy: "admin", detachedAt: { gte: new Date("2026-09-03T00:00:00Z") } }, select: { id: true, partnerId: true, detachedAt: true } });
  const notifs = await db.notification.count({ where: { kind: "support.reply", createdAt: { gte: new Date("2026-09-03T15:00:00Z") } } });
  const tg = await db.telegramLog.count({ where: { createdAt: { gte: new Date("2026-09-03T15:00:00Z") }, kind: { contains: "support" } } }).catch(() => -1);
  console.log(JSON.stringify({
    testMessages: testMsgs.length,
    broadcasts: Object.fromEntries(byBroadcast),
    threadsTouched: threads.length,
    threadsOnlyTest: onlyTest.map((t) => ({ id: t.id, key: t.key, org: t.organizationName })),
    threadsMixed: threads.filter((t) => !onlyTest.includes(t)).map((t) => ({ id: t.id, key: t.key, org: t.organizationName, unreadForClient: t.unreadForClient, total: t._count.messages, test: testMsgs.filter((m) => m.threadId === t.id).length })).slice(0, 10),
    threadsMixedCount: threads.length - onlyTest.length,
    partner,
    detachedByMe,
    supportReplyNotificationsSince: notifs,
    telegramSupportLogsSince: tg,
  }, null, 1));
}
main().finally(() => db.$disconnect());
