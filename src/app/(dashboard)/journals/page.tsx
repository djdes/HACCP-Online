import { JournalsBrowser } from "@/components/journals/journals-browser";
import { db } from "@/lib/db";

export default async function JournalsPage() {
  const templates = await db.journalTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return <JournalsBrowser templates={templates} />;
}
