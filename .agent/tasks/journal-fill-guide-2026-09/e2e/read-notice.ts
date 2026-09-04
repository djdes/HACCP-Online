/* eslint-disable no-console */
// Verifier helper (read-only): print the throwaway e2e manager's seenNoticesJson.
//   node --env-file=.env.local --import tsx .agent/tasks/journal-fill-guide-2026-09/e2e/read-notice.ts
import { db } from "@/lib/db";

const EMAIL = "e2e-fill-guide@wesetup.local";

async function main() {
  const user = await db.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, seenNoticesJson: true },
  });
  console.log(JSON.stringify(user));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
