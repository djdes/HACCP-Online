/* eslint-disable no-console */
// Verifier helper: clear ONE seen-notice key on the throwaway e2e manager so the
// first-visit auto-open (AC5) can be re-proven. Does not create/delete users.
//   node --env-file=.env.local --import tsx .agent/tasks/journal-fill-guide-2026-09/e2e/reset-notice.ts
import { db } from "@/lib/db";

const EMAIL = "e2e-fill-guide@wesetup.local";
const KEY = process.env.KEY ?? "fill-guide:climate_control";

async function main() {
  const user = await db.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, seenNoticesJson: true },
  });
  if (!user) throw new Error("e2e user not found");
  const raw = user.seenNoticesJson;
  const seen =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const before = seen[KEY];
  delete seen[KEY];
  await db.user.update({
    where: { id: user.id },
    data: { seenNoticesJson: seen as never },
  });
  console.log(JSON.stringify({ id: user.id, key: KEY, before: before ?? null, after: seen }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
