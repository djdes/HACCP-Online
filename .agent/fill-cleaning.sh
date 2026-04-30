#!/bin/bash
cd /var/www/wesetupru/data/www/wesetup.ru/app
set -a
. ./.env
set +a
cat > scripts/_fill-cleaning.ts <<'TS'
import { db } from "@/lib/db";

async function main() {
  const orgId = "cmoeqzj5e0001ljtso1o1q3fi";
  const todayKey = new Date().toISOString().slice(0, 10);

  const docs = await db.journalDocument.findMany({
    where: {
      organizationId: orgId,
      status: "active",
      template: { code: "cleaning" },
    },
    select: { id: true, config: true },
  });

  for (const doc of docs) {
    const cfg = (doc.config ?? {}) as Record<string, unknown>;
    let rooms = Array.isArray(cfg.rooms) ? [...(cfg.rooms as Array<{id:string;name:string}>)] : [];
    if (rooms.length === 0) {
      // Создаём минимальную room чтобы было куда писать checkmark.
      rooms = [{ id: "qa-room-1", name: "Кухня" }];
    }
    const matrix =
      cfg.matrix && typeof cfg.matrix === "object"
        ? { ...(cfg.matrix as Record<string, Record<string, unknown>>) }
        : {};
    for (const room of rooms) {
      const roomId = (room as { id?: string })?.id;
      if (!roomId) continue;
      const cell = { ...(matrix[roomId] ?? {}) };
      cell[todayKey] = "✓ qa";
      matrix[roomId] = cell;
    }
    const nextCfg = { ...cfg, rooms, matrix };
    await db.journalDocument.update({
      where: { id: doc.id },
      data: { config: nextCfg },
    });
    console.log(`Updated doc ${doc.id}, rooms=${rooms.length}`);
  }

  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
TS
npx tsx scripts/_fill-cleaning.ts
rm scripts/_fill-cleaning.ts
