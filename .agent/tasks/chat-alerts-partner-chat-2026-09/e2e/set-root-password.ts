import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
/** Локальная dev-БД: задаём ROOT известный пароль для e2e. */
async function main() {
  const password = process.env.E2E_ROOT_PASSWORD!;
  const root = await db.user.findFirst({ where: { isRoot: true }, select: { id: true, email: true } });
  if (!root) throw new Error("no root");
  await db.user.update({ where: { id: root.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  console.log("root password set for", root.email);
}
main().finally(() => db.$disconnect());
