import "dotenv/config";
import { db } from "@/lib/db";
async function main() {
  const rows = await db.supportThread.findMany({
    where: { id: { in: ["cmtlwu17k007xrg9mqz15fnr4", "cmtgxxh160000rqtsuvumn46j"] } },
    select: { id: true, key: true, organizationName: true, unreadForClient: true, unreadForStaff: true, _count: { select: { messages: true } } },
  });
  console.log(JSON.stringify(rows));
}
main().finally(() => db.$disconnect());
