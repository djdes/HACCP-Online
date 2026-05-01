import Link from "next/link";
import { Clock4, AlertTriangle, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { getJournalSpec } from "@/lib/journal-specs";

/**
 * Time-window alerts — для журналов у которых `spec.timeWindowHours`
 * задан (термоконтроль каждые 6ч, гигиена каждые 24ч и т.п.) проверяем
 * MAX(JournalEntry.createdAt) и сравниваем с now. Если просрочено —
 * рисуем alert «Срочно сейчас!» со ссылкой на /journals/<code>/new.
 *
 * Server-component — выполняется на каждом render'е dashboard'а
 * (force-dynamic). Один SQL group-by по organization, дёшево.
 *
 * Принцип «не паниковать без причины»:
 *   • Если просрочено < 1 hour → не показываем (юзер ещё не успел).
 *   • Если просрочено и time-window <= 24h → красная карточка
 *     «Срочно нужно».
 *   • Если просрочено и > 24h (например, недельный sanitary day) →
 *     жёлтая карточка «Скоро срок».
 */
export async function TimeWindowAlerts({
  organizationId,
}: {
  organizationId: string;
}) {
  const validCodes = ACTIVE_JOURNAL_CATALOG.map((j) => j.code);

  // 1. Список журналов с time-window.
  const watchedCodes = validCodes.filter((c) => {
    const spec = getJournalSpec(c);
    return spec.timeWindowHours !== null;
  });
  if (watchedCodes.length === 0) return null;

  // 2. Шаблоны → templateId для in-clause.
  const templates = await db.journalTemplate.findMany({
    where: { code: { in: watchedCodes } },
    select: { id: true, code: true, name: true },
  });
  const idToCode = new Map(templates.map((t) => [t.id, t.code]));
  const codeToName = new Map(templates.map((t) => [t.code, t.name]));

  if (templates.length === 0) return null;

  // 3. Для каждого journals находим MAX(createdAt) одной group-by-запросом.
  // Prisma не имеет groupBy с MAX без agregat, но findMany + reduce — OK
  // на ~30 templates × N entries; индекс на (orgId, templateId, createdAt).
  const lastEntries = await db.journalEntry.groupBy({
    by: ["templateId"],
    where: {
      organizationId,
      templateId: { in: templates.map((t) => t.id) },
    },
    _max: { createdAt: true },
  });
  const lastByCode = new Map<string, Date | null>();
  for (const code of watchedCodes) lastByCode.set(code, null);
  for (const row of lastEntries) {
    const code = idToCode.get(row.templateId);
    if (!code) continue;
    lastByCode.set(code, row._max.createdAt);
  }

  // 4. Считаем просрочки.
  const now = Date.now();
  type Alert = {
    code: string;
    name: string;
    hoursOverdue: number;
    severity: "urgent" | "warn";
    timeWindowHours: number;
    lastFilledLabel: string | null;
  };
  const alerts: Alert[] = [];
  for (const code of watchedCodes) {
    const spec = getJournalSpec(code);
    const tw = spec.timeWindowHours;
    if (!tw) continue;
    const last = lastByCode.get(code);
    const hoursAgo = last
      ? (now - last.getTime()) / 3_600_000
      : Number.POSITIVE_INFINITY;
    const overdue = hoursAgo - tw;
    if (overdue < 1) continue; // меньше 1 часа просрочки — не паникуем
    const severity: "urgent" | "warn" = tw <= 24 ? "urgent" : "warn";
    alerts.push({
      code,
      name: codeToName.get(code) ?? code,
      hoursOverdue: overdue,
      severity,
      timeWindowHours: tw,
      lastFilledLabel: last ? formatRelative(last) : null,
    });
  }

  if (alerts.length === 0) {
    return null;
  }

  // Сортируем: сначала urgent + бОльшая просрочка.
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === "urgent" ? -1 : 1;
    }
    return b.hoursOverdue - a.hoursOverdue;
  });

  const urgentCount = alerts.filter((a) => a.severity === "urgent").length;

  return (
    <div className="rounded-3xl border border-[#ffd2cd] bg-gradient-to-br from-[#fff4f2] to-white p-5 shadow-[0_10px_30px_-12px_rgba(161,58,50,0.2)]">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#a13a32] text-white shadow-[0_8px_20px_-8px_rgba(161,58,50,0.55)]">
          <Clock4 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
              Срочно нужно заполнить
            </h3>
            {urgentCount > 0 ? (
              <span className="rounded-full bg-[#a13a32] px-2 py-0.5 text-[11px] font-semibold text-white">
                {urgentCount} критичных
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-[#3c4053]">
            Журналы с нарушением периодичности по СанПиН — последняя запись
            была дольше нормы. Заполните как можно скорее.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {alerts.slice(0, 6).map((a) => {
          const isUrgent = a.severity === "urgent";
          return (
            <Link
              key={a.code}
              href={`/journals/${a.code}/new`}
              className={`group flex items-start gap-2.5 rounded-2xl border bg-white p-3 transition-all hover:translate-y-[-1px] ${
                isUrgent
                  ? "border-[#ffd2cd] hover:border-[#a13a32]/60 hover:shadow-[0_8px_20px_-12px_rgba(161,58,50,0.35)]"
                  : "border-[#ffe9b0] hover:border-[#a16d32]/60 hover:shadow-[0_8px_20px_-12px_rgba(161,109,50,0.25)]"
              }`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                  isUrgent
                    ? "bg-[#fff4f2] text-[#a13a32]"
                    : "bg-[#fff8eb] text-[#a16d32]"
                }`}
              >
                <AlertTriangle className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#0b1024]">
                  {a.name}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-[#6f7282]">
                  Просрочено на{" "}
                  <strong
                    className={
                      isUrgent ? "text-[#a13a32]" : "text-[#a16d32]"
                    }
                  >
                    {formatHoursOverdue(a.hoursOverdue)}
                  </strong>
                  {" · норма каждые "}
                  {formatHours(a.timeWindowHours)}
                  {a.lastFilledLabel ? `, заполнено ${a.lastFilledLabel}` : null}
                </div>
              </div>
              <span className="text-[11px] font-medium text-[#5566f6] opacity-0 transition-opacity group-hover:opacity-100">
                Заполнить →
              </span>
            </Link>
          );
        })}
      </div>

      {alerts.length > 6 ? (
        <div className="mt-3 text-center text-[12px] text-[#6f7282]">
          + ещё {alerts.length - 6}{" "}
          {alerts.length - 6 === 1 ? "журнал" : "журналов"} с просрочкой
        </div>
      ) : null}

      {alerts.every((a) => a.severity !== "urgent") ? (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          <CheckCircle2 className="size-3.5" />
          Критичных пропусков нет — только периодические журналы.
        </div>
      ) : null}
    </div>
  );
}

function formatHoursOverdue(hours: number): string {
  if (hours < 24) return `${Math.round(hours)} ч`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 день" : days < 5 ? `${days} дня` : `${days} дней`;
}

function formatHours(h: number): string {
  if (h <= 24) return `${h} ч`;
  const days = h / 24;
  return Number.isInteger(days)
    ? days === 1
      ? "сутки"
      : `${days} дней`
    : `${h} ч`;
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const hours = diffMs / 3_600_000;
  if (hours < 1) {
    const m = Math.round(diffMs / 60_000);
    return `${m} мин назад`;
  }
  if (hours < 24) {
    return `${Math.round(hours)} ч назад`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? "вчера" : `${days} д назад`;
}
