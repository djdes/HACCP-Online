import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitBranch, Package, Clock, User as UserIcon } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Просмотр истории партии (ХАССП traceability).
 *
 * URL: /journals/traceability/<batchKey>
 *
 * Показывает все JournalEntry с этим batchKey в текущей организации.
 * Сортировка хронологическая — приёмка наверху, списание/отпуск внизу.
 */
export default async function TraceabilityPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key: rawKey } = await params;
  const batchKey = decodeURIComponent(rawKey).trim();
  if (!batchKey || batchKey.length > 100) notFound();

  const session = await requireAuth();
  const organizationId = getActiveOrgId(session);

  const entries = await db.journalEntry.findMany({
    where: {
      organizationId,
      batchKey,
    },
    select: {
      id: true,
      data: true,
      createdAt: true,
      filledBy: { select: { name: true } },
      template: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-1 sm:space-y-6">
      <Link
        href="/journals"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6f7282] transition-colors hover:text-[#0b1024]"
      >
        <ArrowLeft className="size-4" />
        К журналам
      </Link>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[340px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-28 -right-28 size-[380px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 flex items-start gap-3 p-5 sm:gap-4 sm:p-8 md:p-10">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <GitBranch className="size-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              ХАССП · Прослеживаемость партии
            </div>
            <h1 className="mt-3 text-[24px] font-semibold leading-tight tracking-[-0.02em] sm:text-[28px]">
              Партия{" "}
              <span className="font-mono text-white/90">{batchKey}</span>
            </h1>
            <p className="mt-2 max-w-[560px] text-[13px] leading-[1.5] text-white/70 sm:text-[14px]">
              {entries.length === 0
                ? "Записи с этим ключом не найдены. Проверь правильность ключа или зайди через запись приёмки."
                : `Найдено ${entries.length} ${
                    entries.length === 1
                      ? "запись"
                      : entries.length < 5
                        ? "записи"
                        : "записей"
                  } по этой партии. Хронологический порядок — от приёмки до отпуска.`}
            </p>
          </div>
        </div>
      </section>

      {entries.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-8 text-center text-[14px] text-[#6f7282]">
          Записи с ключом партии «{batchKey}» не найдены в текущей
          организации. Проверь правильность ключа или зайди через запись
          приёмки в журнале «Приёмка и входной контроль».
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e, i) => {
            const data = (e.data ?? {}) as Record<string, unknown>;
            const productName =
              typeof data.productName === "string"
                ? data.productName
                : typeof data.product === "string"
                  ? data.product
                  : null;
            const supplier =
              typeof data.supplier === "string" ? data.supplier : null;
            const dateLabel = new Date(e.createdAt).toLocaleString("ru-RU", {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <Link
                key={e.id}
                href={`/journals/${e.template.code}`}
                className="flex items-stretch gap-3 rounded-2xl border border-[#ececf4] bg-white p-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:border-[#5566f6]/40 hover:shadow-[0_8px_20px_-12px_rgba(85,102,246,0.25)]"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#eef1ff] text-[#3848c7]">
                    <Package className="size-4" />
                  </span>
                  {i < entries.length - 1 ? (
                    <div className="h-full min-h-[20px] w-px flex-1 bg-[#dcdfed]" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3848c7]">
                      Шаг {i + 1}
                    </span>
                    <span className="text-[15px] font-semibold leading-tight text-[#0b1024]">
                      {e.template.name}
                    </span>
                  </div>
                  {productName ? (
                    <div className="mt-1 text-[13px] text-[#3c4053]">
                      {productName}
                      {supplier ? (
                        <span className="text-[#9b9fb3]">
                          {" "}
                          · поставщик: {supplier}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11.5px] text-[#9b9fb3]">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" />
                      {dateLabel}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="size-3.5" />
                      {e.filledBy.name}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-[#5566f6]/15 bg-[#f5f6ff]/50 p-4 text-[12.5px] leading-relaxed text-[#3848c7]">
        <strong>ХАССП-прослеживаемость:</strong> по ТР ТС 021/2011 за минуту
        нужно восстановить путь любой партии. Этот экран показывает все
        записи с одним ключом — приёмка → бракераж → отпуск/списание.
        Партия автоматически связывается, если ключ записан в поле
        «batchNumber» или «batchKey» при заполнении.
      </div>
    </div>
  );
}
