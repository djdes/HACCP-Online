import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import { raisePlatformAlert } from "@/lib/platform-alerts";
import { toDateKey } from "@/lib/hygiene-document";
import {
  ensureActiveDocument,
  ensureNextPeriodDocument,
} from "@/lib/journal-auto-create";
import {
  applyStaffJournalAutoFill,
  STAFF_JOURNAL_TEMPLATE_CODES,
} from "@/lib/staff-journal-autofill";
import {
  isAutomationSupported,
  listAutomationCodes,
} from "@/lib/journal-automation";
import { notifyOrganization, escapeTelegramHtml as esc } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/journal-automation?secret=$CRON_SECRET
 *
 * Единый ежедневный прогон «журнал ведётся сам» (INFRA: внешний cron
 * 06:00 MSK). Для каждой организации и каждого журнала с включённой
 * автоматикой (`Organization.journalAutomationJson`):
 *
 *   1. Документ на текущий период — создаём, если его нет
 *      (`ensureActiveDocument` с `autoFill: true`, чтобы созданный
 *      документ действительно заполнялся, а не ждал ручного тумблера).
 *   2. Документ на следующий период за 7 дней до конца текущего —
 *      чтобы 1-го числа не было провала.
 *   3. Автозаполнение ТОЛЬКО сегодняшнего дня: всем активным
 *      сотрудникам «Здоров, t < 37»; выходной/отпуск/больничный
 *      проставляются сами («В» / «Отп» / «Б/л») — правило выходных
 *      живёт в `isStaffDayOff` (недельное правило + исключения).
 *
 * Идемпотентность: заполняются только ПУСТЫЕ ячейки, строки создаются
 * через `createMany skipDuplicates`. Повторный запуск в тот же день —
 * no-op, ручные отметки не перетираются.
 *
 * Ошибки изолированы по организациям (`Promise.allSettled`): падение
 * одной компании не должно останавливать остальные.
 */

type OrgRow = {
  id: string;
  name: string;
  journalAutomationJson: unknown;
  autoJournalCodes: unknown;
};

type OrgResult = {
  organizationId: string;
  documentsCreated: number;
  nextPeriodCreated: number;
  entriesCreated: number;
  entriesUpdated: number;
  codes: string[];
  errors: string[];
};

async function runForOrganization(
  org: OrgRow,
  todayKey: string
): Promise<OrgResult> {
  const result: OrgResult = {
    organizationId: org.id,
    documentsCreated: 0,
    nextPeriodCreated: 0,
    entriesCreated: 0,
    entriesUpdated: 0,
    codes: [],
    errors: [],
  };

  const rows = listAutomationCodes(org).filter((row) => row.automation.autoCreate);
  if (rows.length === 0) return result;

  const todayDate = new Date(`${todayKey}T00:00:00.000Z`);

  // Уволенные (StaffDismissal с датой не позже сегодня) и неактивные в
  // автозаполнение не попадают — но их СТРОКИ в документе остаются:
  // журнал прошлых дней должен читаться так же, как его подписали.
  const employees = await db.user.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      archivedAt: null,
      OR: [{ dismissal: null }, { dismissal: { date: { gt: todayDate } } }],
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const employeeIds = employees.map((employee) => employee.id);

  for (const row of rows) {
    const { code, automation } = row;
    try {
      const current = await ensureActiveDocument(db, {
        organizationId: org.id,
        templateCode: code,
        autoFill: automation.autoFill,
      });
      if (current.created) result.documentsCreated += 1;

      const next = await ensureNextPeriodDocument(db, {
        organizationId: org.id,
        templateCode: code,
        lookaheadDays: 7,
        autoFill: automation.autoFill,
      });
      if (next.created) result.nextPeriodCreated += 1;

      if (!automation.autoFill || !isAutomationSupported(code)) continue;
      if (employeeIds.length === 0) continue;
      if (!current.documentId) continue;

      const document = await db.journalDocument.findFirst({
        where: {
          id: current.documentId,
          organizationId: org.id,
          status: "active",
          dateFrom: { lte: todayDate },
          dateTo: { gte: todayDate },
        },
        select: { id: true, autoFill: true },
      });
      if (!document) continue;

      // Выключенный в документе тумблер — это решение человека, и крон
      // его уважает. Раньше здесь стоял принудительный подъём флага:
      // выключил вечером — утром снова включилось, и выключатель
      // выглядел сломанным. Документы, которые крон создаёт сам,
      // получают autoFill=true при создании, так что «журнал ведётся
      // сам» продолжает работать без этой правки.
      if (!document.autoFill) continue;

      const entries = await db.journalDocumentEntry.findMany({
        where: { documentId: document.id, date: todayDate },
        select: { id: true, employeeId: true, date: true, data: true },
      });

      const filled = await applyStaffJournalAutoFill(db, {
        documentId: document.id,
        templateCode: code,
        employeeIds,
        dateKeys: [todayKey],
        entries,
      });
      result.entriesCreated += filled.created;
      result.entriesUpdated += filled.updated;
      if (filled.created > 0 || filled.updated > 0) result.codes.push(code);
    } catch (err) {
      result.errors.push(
        `code=${code}: ${(err as Error).message ?? "ошибка"}`
      );
    }
  }

  if (
    result.documentsCreated > 0 ||
    result.entriesCreated > 0 ||
    result.entriesUpdated > 0
  ) {
    await db.auditLog.create({
      data: {
        organizationId: org.id,
        action: "journal.automation.run",
        entity: "organization",
        entityId: org.id,
        details: {
          date: todayKey,
          documentsCreated: result.documentsCreated,
          nextPeriodCreated: result.nextPeriodCreated,
          entriesCreated: result.entriesCreated,
          entriesUpdated: result.entriesUpdated,
          codes: result.codes,
        },
      },
    });
  }

  // Сводка владельцу — только когда автоматика реально что-то сделала,
  // иначе бот превращается в ежедневный шум.
  if (result.documentsCreated > 0 || result.entriesCreated > 0) {
    const message =
      `🤖 <b>Журналы заполнены автоматически</b>\n\n` +
      `Дата: ${esc(todayKey)}\n` +
      `Создано документов: <b>${result.documentsCreated}</b>\n` +
      `Заполнено строк: <b>${result.entriesCreated + result.entriesUpdated}</b>\n\n` +
      `Если у кого-то температура или больничный — отметьте это сегодня: прошлые дни закрыты.`;
    await notifyOrganization(org.id, message, ["owner"]).catch(() => {
      /* Telegram недоступен — журнал всё равно заполнен */
    });
  }

  return result;
}

async function handle(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;

  const todayKey = toDateKey(new Date());
  const orgs = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      journalAutomationJson: true,
      autoJournalCodes: true,
    },
  });

  const settled = await Promise.allSettled(
    orgs.map((org) => runForOrganization(org, todayKey))
  );

  let documentsCreated = 0;
  let nextPeriodCreated = 0;
  let entriesCreated = 0;
  let entriesUpdated = 0;
  let organizationsTouched = 0;
  const errors: string[] = [];

  settled.forEach((item, index) => {
    if (item.status === "rejected") {
      errors.push(
        `org=${orgs[index]?.id}: ${(item.reason as Error)?.message ?? "ошибка"}`
      );
      return;
    }
    const value = item.value;
    documentsCreated += value.documentsCreated;
    nextPeriodCreated += value.nextPeriodCreated;
    entriesCreated += value.entriesCreated;
    entriesUpdated += value.entriesUpdated;
    if (
      value.documentsCreated > 0 ||
      value.entriesCreated > 0 ||
      value.entriesUpdated > 0
    ) {
      organizationsTouched += 1;
    }
    value.errors.forEach((error) => errors.push(`org=${value.organizationId} ${error}`));
  });

  // Ночная автоматика — единственный шанс создать журналы на день: она
  // ходит раз в сутки, и если упала, то до завтра никто ничего не создаст,
  // а сотрудники утром увидят пустой список. Поэтому будим сразу, без
  // серии провалов — второго запуска, который «сам починится», не будет.
  //
  // dedupeKey с датой: одна новость в сутки, но завтрашняя поломка не
  // будет заглушена сегодняшним кулдауном.
  if (errors.length > 0) {
    await raisePlatformAlert({
      kind: "journal-automation",
      dedupeKey: `failed:${todayKey}`,
      text:
        `<b>Автосоздание журналов: ошибки</b>
` +
        `Дата ${todayKey}, организаций затронуто ${organizationsTouched} из ${orgs.length}.
` +
        `Ошибок: ${errors.length}
` +
        `Первая: ${errors[0]}
` +
        `Журналы за день могли не создаться.`,
    });
  }

  return NextResponse.json({
    ok: true,
    date: todayKey,
    supportedCodes: [...STAFF_JOURNAL_TEMPLATE_CODES],
    organizationsScanned: orgs.length,
    organizationsTouched,
    documentsCreated,
    nextPeriodCreated,
    entriesCreated,
    entriesUpdated,
    errors: errors.slice(0, 10),
  });
}

export const GET = handle;
export const POST = handle;
