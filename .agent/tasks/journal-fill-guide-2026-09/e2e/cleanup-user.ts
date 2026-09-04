/* eslint-disable no-console */
// Removes the throwaway e2e manager. Documents it created stay in the test org.
//   node --env-file=.env.local --import tsx .agent/tasks/journal-fill-guide-2026-09/e2e/cleanup-user.ts
import { db } from "@/lib/db";

const EMAIL = "e2e-fill-guide@wesetup.local";

async function main() {
  const user = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
  if (!user) {
    console.log("nothing to clean");
    return;
  }
  try {
    await db.user.delete({ where: { id: user.id } });
    console.log("deleted", user.id);
  } catch (e) {
    await db.user.update({
      where: { id: user.id },
      data: { isActive: false, archivedAt: new Date() },
    });
    console.log("archived instead of deleted:", (e as Error).message.split("\n")[0]);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
