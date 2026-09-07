import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getAdapter } from "@/lib/tasksflow-adapters";
import { resolveJournalCodeAlias } from "@/lib/source-journal-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/journals/[code]/row-form?documentId=&rowKey=
 *
 * Отдаёт `TaskFormSchema` для конкретной строки журнала — тот же самый,
 * что видит работник TasksFlow на экране задачи.
 *
 * Зачем эндпоинт: мастер «одна строка — один экран» в проекте написан
 * трижды — на `/task-fill/[taskId]` (по адаптерам), в `/mini/claim/[id]`
 * (со своей захардкоженной картой форм на ~30 журналов) и россыпью в
 * карточках документных клиентов. При этом `getTaskForm()` реализуют ВСЕ
 * адаптеры без исключения, то есть источник схемы уже единый — не хватало
 * только способа спросить его изнутри Wesetup.
 *
 * Это чтение схемы формы внутри Wesetup: в TasksFlow ничего не уходит,
 * запись по-прежнему идёт в journal-модель и через outbox (П-12, П-15).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { code } = await ctx.params;
  const templateCode = resolveJournalCodeAlias(code);
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  const rowKey = searchParams.get("rowKey");

  if (!documentId || !rowKey) {
    return NextResponse.json(
      { error: "Нужны documentId и rowKey" },
      { status: 400 }
    );
  }

  // Документ обязан принадлежать текущей организации: rowKey приходит от
  // клиента, и без этой проверки чужой documentId отдал бы чужую схему.
  const organizationId = getActiveOrgId(session);
  const document = await db.journalDocument.findFirst({
    where: { id: documentId, organizationId },
    select: { id: true, template: { select: { code: true } } },
  });
  if (!document) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  const adapter = getAdapter(document.template.code || templateCode);
  if (!adapter?.getTaskForm) {
    return NextResponse.json({ form: null });
  }

  const form = await adapter.getTaskForm({ documentId, rowKey });
  return NextResponse.json({ form });
}
