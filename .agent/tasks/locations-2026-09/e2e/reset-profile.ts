import fs from "node:fs";
import { db } from "@/lib/db";
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
(async () => {
  await db.user.update({ where: { id: creds.id }, data: { phone: null, name: creds.email } });
  console.log("profile marked incomplete");
  await db.$disconnect();
})();
