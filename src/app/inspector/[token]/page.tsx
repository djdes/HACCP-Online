import { notFound } from "next/navigation";
import Link from "next/link";
import { ClipboardCheck, Download, Calendar, Building2, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { hashInspectorToken } from "@/lib/inspector-tokens";
import { getDisabledJournalCodes } from "@/lib/disabled-journals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public inspector portal — read-only viewer of organization's journals
 * during a planned SES / Роспотребнадзор audit. No NextAuth session;
 * auth is the URL token (sha256 in DB). Period is fixed at creation.
 *
 * Layout:
 *   - Hero with org name + period + "Скачать PDF за период" button
 *   - Grid of journal templates with their active doc count за период
 *   - Each card → /inspector/<token>/[templateCode] with read-only entries
 *
 * Token side-effects: every successful resolve bumps lastAccessedAt and
 * accessCount — admin sees usage in /settings/inspector-portal.
 */
export default async function InspectorLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashInspectorToken(token);
  const record = await db.inspectorToken.findUnique({
    where: { tokenHash },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  if (!record) notFound();
  if (record.revokedAt) {
    return (
      <ErrorShell
        title="Доступ отозван"
        message="Администратор отозвал эту ссылку. Запросите новую."
      />
    );
  }
  if (record.expiresAt < new Date()) {
    return (
      <ErrorShell
        title="Срок действия истёк"
        message={`Ссылка действовала до ${record.expiresAt.toLocaleString("ru-RU")}. Запросите новую.`}
      />
    );
  }

  // Bump access stats. Best-effort — don't block render on failure.
  await db.inspectorToken
    .update({
      where: { id: record.id },
      data: {
        lastAccessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    })
    .catch(() => null);

  const periodFrom = record.periodFrom;
  const periodTo = record.periodTo;
  const periodToInclusive = new Date(periodTo);
  periodToInclusive.setUTCHours(23, 59, 59, 999);

  // Journals available — only templates that have at least one document
  // within the period. Aperiodic ones may have no entries — we still show
  // the card with «нет записей» so inspector understands what's expected.
  //
  // Раньше показывали ВСЕ active templates: org, отключившая «темп.
  // режим» в /settings/journals (потому что вообще нет холодильников),
  // выглядела для инспектора как нарушитель — пустая карточка с
  // «0 документов». Теперь скрываем отключённые: инспектор видит
  // только то, что org обязалась вести.
  const disabledCodes = await getDisabledJournalCodes(record.organizationId);
  const allTemplates = await db.journalTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      isMandatorySanpin: true,
      isMandatoryHaccp: true,
    },
  });
  const templates = allTemplates.filter((t) => !disabledCodes.has(t.code));

  const documents = await db.journalDocument.findMany({
    where: {
      organizationId: record.organizationId,
      OR: [
        { dateFrom: { gte: periodFrom, lte: periodToInclusive } },
        { dateTo: { gte: periodFrom, lte: periodToInclusive } },
        { AND: [{ dateFrom: { lte: periodFrom } }, { dateTo: { gte: periodToInclusive } }] },
      ],
    },
    select: {
      id: true,
      title: true,
      templateId: true,
    },
  });

  const docsByTemplate = new Map<string, number>();
  for (const d of documents) {
    docsByTemplate.set(d.templateId, (docsByTemplate.get(d.templateId) ?? 0) + 1);
  }

  return (
    <main className="min-h-screen bg-[#fafbff]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0b1024] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ShieldCheck className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                  Портал инспектора · только просмотр
                </div>
                <h1 className="mt-1 text-[clamp(1.5rem,2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
                  {record.organization.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-[14px] text-white/80">
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="size-4" />
                    {formatRange(periodFrom, periodTo)}
                  </span>
                  {record.label ? (
                    <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/85 ring-1 ring-white/15">
                      {record.label}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <a
              href={`/api/inspector/${token}/pdf`}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] hover:bg-[#4a5bf0]"
            >
              <Download className="size-4" />
              Скачать PDF за период
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-12">
        <div className="mb-6 rounded-2xl border border-[#dcdfed] bg-white p-5 text-[14px] leading-relaxed text-[#3c4053]">
          <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold text-[#0b1024]">
            <Building2 className="size-4" />
            Об этом доступе
          </div>
          Это страница только для просмотра. Записи в журналах отсюда нельзя
          изменить. Доступ действует до{" "}
          <span className="font-semibold text-[#0b1024]">
            {record.expiresAt.toLocaleString("ru-RU", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          .
        </div>

        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
          Журналы за период
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => {
            const docCount = docsByTemplate.get(tpl.id) ?? 0;
            return (
              <Link
                key={tpl.id}
                href={`/inspector/${token}/${tpl.code}`}
                className="group flex flex-col gap-2 rounded-2xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:border-[#d6d9ee] hover:shadow-[0_8px_24px_-12px_rgba(85,102,246,0.18)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#3848c7]">
                    <ClipboardCheck className="size-5" />
                  </div>
                  <div className="flex gap-1.5">
                    {tpl.isMandatorySanpin ? (
                      <span className="rounded-full bg-[#fff4f2] px-2 py-0.5 text-[10px] font-medium text-[#a13a32]">
                        СанПиН
                      </span>
                    ) : null}
                    {tpl.isMandatoryHaccp ? (
                      <span className="rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[10px] font-medium text-[#3848c7]">
                        ХАССП
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <div className="text-[15px] font-semibold leading-tight text-[#0b1024]">
                    {tpl.name}
                  </div>
                  <div className="mt-1 text-[12px] text-[#6f7282]">
                    {docCount === 0
                      ? "Нет документов за период"
                      : `${docCount} документ(ов) за период`}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function formatRange(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  return `${fmt(from)} — ${fmt(to)}`;
}

function ErrorShell({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-[#fafbff] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-[#ececf4] bg-white p-8 text-center shadow-[0_20px_60px_-30px_rgba(11,16,36,0.2)]">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#fff4f2] text-[#a13a32] text-2xl">
          !
        </div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          {title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6f7282]">{message}</p>
      </div>
    </main>
  );
}
