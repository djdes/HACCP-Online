import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Coins,
  FileDown,
  GraduationCap,
  Hand,
  Inbox,
  ListChecks,
  Medal,
  Package,
  Send,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  ThermometerSun,
  TrendingDown,
  Trophy,
  User as UserIcon,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NOT_AUTO_SEEDED } from "@/lib/journal-entry-filters";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { hasCapability } from "@/lib/permission-presets";
import { TemperatureChart } from "@/components/charts/temperature-chart";
import { CloseDayCard } from "@/components/dashboard/close-day-card";
import { AnomaliesCard } from "@/components/dashboard/anomalies-card";
import { LiveClaimsCard } from "@/components/dashboard/live-claims-card";
import { MedBooksExpiryCard } from "@/components/dashboard/med-books-expiry-card";
import { TimeWindowAlerts } from "@/components/dashboard/time-window-alerts";
import { BulkAssignPreviewCard } from "@/components/dashboard/bulk-assign-preview-card";
import {
  DashboardSection,
  DashboardSectionPersistScript,
} from "@/components/dashboard/dashboard-section";
import { StaffTrainingCard } from "@/components/dashboard/staff-training-card";
import { StaleCapaNag } from "@/components/dashboard/stale-capa-nag";
import { SuperUserDevTools } from "@/components/dashboard/super-user-dev-tools";
import { isSuperUser } from "@/lib/super-user";
import { OrgHealthWidget } from "@/components/dashboard/org-health-widget";
import { runOrgHealthCheck } from "@/lib/org-health-check";
import { getTemplatesFilledToday } from "@/lib/today-compliance";
import { getStrugglingWorkers, getWorkerLeaderboard } from "@/lib/worker-leaderboard";
import { getWeeklyTails } from "@/lib/weekly-tails";
import { parseDisabledCodes } from "@/lib/disabled-journals";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(date: Date): string {
  const diff = new Date().getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} д назад`;
}

/**
 * Time-of-day greeting for the hero. Keeps it warm + respectful regardless
 * of whether the user is a manager or a line cook.
 */
function timeBasedGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Доброе утро";
  if (hour >= 12 && hour < 18) return "Добрый день";
  if (hour >= 18 && hour < 23) return "Добрый вечер";
  return "Доброй ночи";
}

/**
 * From a full name "Крылов Денис Сергеевич" returns "Денис Сергеевич"
 * (formal but not distant — works for both 20-year-old cook and a grandma
 * who grew up with Имя + Отчество). Falls back to the raw string if only
 * one or two words are present.
 */
function addressedName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return `${parts[1]} ${parts[2]}`;
  if (parts.length === 2) return parts[1];
  return parts[0] ?? "";
}

type EntryData = Record<string, unknown>;
function getEntryData(data: unknown): EntryData {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as EntryData;
  }
  return {};
}

export default async function DashboardPage() {
  const session = await requireAuth();
  // Заведующая (head_chef) и не-admin'ы не должны видеть «журналы» —
  // редирект на control-board или mini-app.
  if (!hasCapability(session.user, "journals.view")) {
    if (hasCapability(session.user, "tasks.verify")) {
      redirect("/control-board");
    }
    redirect("/mini/today");
  }
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/journals");
  }
  const organizationId = getActiveOrgId(session);

  const now = new Date();
  // UTC-midnight — matches how `JournalDocumentEntry.date` is stored
  // (midnight UTC of the day the row represents) and how the
  // today-compliance helper derives `todayKey`. Keeping everything on
  // the same clock means the «записей сегодня» counter and the
  // compliance ring never disagree about what "today" means.
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [
    todayEntries,
    todayDocumentEntries,
    pendingApproval,
    activeUsers,
    activeTemplates,
    recentEntries,
    openCapaCount,
    weekLossCount,
    expiringBatches,
    iotEquipment,
    templates,
    org,
  ] = await Promise.all([
    db.journalEntry.count({
      where: { organizationId, createdAt: { gte: todayStart } },
    }),
    db.journalDocumentEntry.count({
      where: {
        date: { gte: todayStart },
        document: { organizationId },
        ...NOT_AUTO_SEEDED,
      },
    }),
    db.journalEntry.count({
      where: { organizationId, status: "submitted" },
    }),
    db.user.count({
      where: { organizationId, isActive: true, archivedAt: null },
    }),
    db.journalTemplate.count({ where: { isActive: true } }),
    db.journalEntry.findMany({
      where: { organizationId, createdAt: { gte: cutoff48h } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        template: { select: { name: true, code: true } },
        filledBy: { select: { name: true } },
        area: { select: { name: true } },
        equipment: { select: { name: true } },
      },
    }),
    db.capaTicket.count({
      where: { organizationId, status: { not: "closed" } },
    }),
    db.lossRecord.count({
      where: {
        organizationId,
        date: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
    db.batch.count({
      where: {
        organizationId,
        expiryDate: { lte: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
        status: { notIn: ["expired", "written_off", "shipped"] },
      },
    }),
    db.equipment.findMany({
      where: { area: { organizationId }, tuyaDeviceId: { not: null } },
      select: { id: true, name: true, tuyaDeviceId: true },
    }),
    db.journalTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { disabledJournalCodes: true },
    }),
  ]);

  // Show the «заполнить всё» one-click only if there's an enabled
  // TasksFlow integration to fan out into.
  const tfIntegration = await db.tasksFlowIntegration.findFirst({
    where: { organizationId, enabled: true },
    select: { id: true },
  });
  const hasTasksflowIntegration = Boolean(tfIntegration);

  // Selected journal set comes from organization settings:
  // active templates minus disabled journal codes.
  const disabledCodes = parseDisabledCodes(org?.disabledJournalCodes);

  // Soft-block: количество CAPA, которые открыты > 7 дней — это
  // знак что менеджер забыл их закрыть. Показываем nag-модалку на
  // dashboard. Dismissable per-session, появляется снова после
  // следующей перезагрузки.
  const staleCapaCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [staleCapaCount, healthCheck] = await Promise.all([
    db.capaTicket.count({
      where: {
        organizationId,
        status: { not: "closed" },
        createdAt: { lt: staleCapaCutoff },
      },
    }),
    runOrgHealthCheck(organizationId),
  ]);

  const [filledTodayIds, weeklyTails, leaderboard, strugglers] =
    await Promise.all([
      getTemplatesFilledToday(
        organizationId,
        now,
        templates.map((t) => ({ id: t.id, code: t.code })),
        disabledCodes,
        { treatAperiodicAsFilled: false }
      ),
      getWeeklyTails(organizationId, now, 3),
      getWorkerLeaderboard(organizationId, 3, 30),
      getStrugglingWorkers(organizationId, 3, 30),
    ]);

  const totalTodayEntries = todayEntries + todayDocumentEntries;

  // Treat every enabled journal as required for today. This keeps the
  // dashboard and the TasksFlow fan-out on the same selected count.
  const selectedEnabledTemplates = templates.filter(
    (t) => !disabledCodes.has(t.code)
  );
  const complianceItems = selectedEnabledTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    code: t.code,
    filled: filledTodayIds.has(t.id),
    isSanpin: t.isMandatorySanpin,
    isHaccp: t.isMandatoryHaccp,
  }));
  const unfilledCount = complianceItems.filter((c) => !c.filled).length;
  const filledCount = complianceItems.length - unfilledCount;
  const compliancePercent = complianceItems.length
    ? Math.round((filledCount / complianceItems.length) * 100)
    : 100;
  const complianceTone =
    compliancePercent >= 90
      ? {
          bgClass: "bg-[#ecfdf5] text-[#136b2a]",
          fgClass: "text-[#136b2a]",
          ring: "#7cf5c0",
          label: "всё в порядке",
        }
      : compliancePercent >= 60
        ? {
            bgClass: "bg-[#fff8eb] text-[#b25f00]",
            fgClass: "text-[#b25f00]",
            ring: "#ffd466",
            label: "почти готово",
          }
        : {
            bgClass: "bg-[#fff4f2] text-[#d2453d]",
            fgClass: "text-[#d2453d]",
            ring: "#ffb0a6",
            label: "требует внимания",
          };

  const greetingName = addressedName(session.user.name ?? "");
  const greeting = timeBasedGreeting(now.getHours());

  return (
    <div className="space-y-6">
      {/* Persist для DashboardSection (collapsible-блоки): inline-script
          читает localStorage и настраивает initial open state. */}
      <DashboardSectionPersistScript />
      {/* Soft-block: nag-modal для админа когда CAPA открыты > 7 дней.
          Dismissable per-session, появляется снова после reload. */}
      <StaleCapaNag count={staleCapaCount} />

      {/* Super-user dev-tools (видны ТОЛЬКО специальному dev-аккаунту,
          см. src/lib/super-user.ts). Очистка журналов + force-bulk-assign
          в TF без time-фильтра — для итеративного тестирования. */}
      <SuperUserDevTools enabled={isSuperUser(session)} />

      {/* Dark hero with greeting + stat pills */}
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
          <div className="absolute left-1/3 top-1/2 size-[280px] rounded-full bg-[#3d4efc] opacity-25 blur-[100px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at 30% 40%, black 40%, transparent 70%)",
          }}
        />
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <Hand className="size-6" />
              </div>
              <div>
                <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                  {greeting}
                  {greetingName ? `, ${greetingName}` : ""}
                </h1>
                <p className="mt-1 text-[15px] text-white/70">
                  {formatDayLabel(now).charAt(0).toUpperCase() + formatDayLabel(now).slice(1)} · {session.user.organizationName || "ваша организация"}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  compliancePercent >= 90
                    ? "bg-[#7cf5c0]"
                    : compliancePercent >= 60
                      ? "bg-[#ffd466]"
                      : "bg-[#ffb0a6]"
                )}
              />
              Готовность сегодня: {compliancePercent}%
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <StatPill
              label="Записей сегодня"
              value={totalTodayEntries}
              hint={totalTodayEntries === 0 ? "пока пусто" : undefined}
            />
            <StatPill
              label="На проверке"
              value={pendingApproval}
              hint={pendingApproval > 0 ? "нужно подтвердить" : undefined}
              alert={pendingApproval > 0}
            />
            <StatPill label="Сотрудников" value={activeUsers} />
            <StatPill label="Журналов" value={activeTemplates} />
          </div>
        </div>
      </section>

      {/* Action-first: what the user needs to do TODAY.
          Карточка получает мягкий gradient-фон в зависимости от
          compliance-tone (зелёный 100%, жёлтый частично, красный
          ничего) — сразу понятно как дела с заполнением. */}
      <section
        className={`relative overflow-hidden rounded-3xl border bg-white p-5 shadow-[0_10px_30px_-15px_rgba(11,16,36,0.1)] sm:p-6 ${
          complianceItems.length === 0
            ? "border-[#ececf4]"
            : unfilledCount === 0
              ? "border-emerald-200"
              : compliancePercent >= 50
                ? "border-amber-200"
                : "border-rose-200"
        }`}
      >
        {/* Subtle gradient accent sweep — лёгкий цвет «настроения» */}
        <div
          className={`pointer-events-none absolute -right-32 -top-32 size-[400px] rounded-full opacity-30 blur-3xl ${
            complianceItems.length === 0
              ? "bg-[#5566f6]/20"
              : unfilledCount === 0
                ? "bg-emerald-300"
                : compliancePercent >= 50
                  ? "bg-amber-300"
                  : "bg-rose-300"
          }`}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <span
              className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${complianceTone.bgClass}`}
            >
              {unfilledCount === 0 ? (
                <CheckCircle2 className="size-6" />
              ) : (
                <ClipboardList className="size-6" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024] sm:text-[22px]">
                {complianceItems.length === 0 ? (
                  "Журналы ещё не настроены"
                ) : unfilledCount === 0 ? (
                  "Все журналы начаты сегодня"
                ) : (
                  <>
                    Нужно начать{" "}
                    <span
                      className={
                        compliancePercent >= 50
                          ? "text-amber-700"
                          : "text-rose-700"
                      }
                    >
                      {unfilledCount}{" "}
                      {unfilledCount === 1
                        ? "журнал"
                        : unfilledCount < 5
                          ? "журнала"
                          : "журналов"}
                    </span>
                  </>
                )}
              </h2>
              <p className="mt-1 text-[13px] leading-snug text-[#6f7282] sm:text-[14px]">
                {complianceItems.length === 0
                  ? "Создайте первый документ в журналах — после этого журнал попадёт в готовность сегодня."
                  : unfilledCount === 0
                    ? "Отличная работа — в каждом журнале есть хотя бы одна запись за сегодня."
                    : "Нажмите на карточку ниже, чтобы открыть журнал и внести первую запись."}
              </p>
              {/* Inline-stat: filled / total с прогресс-баром */}
              {complianceItems.length > 0 ? (
                <div className="mt-3">
                  <div className="flex items-end justify-between gap-2 text-[11.5px] text-[#6f7282]">
                    <span>
                      <strong className="text-[#0b1024]">{filledCount}</strong>
                      {" из "}
                      <strong className="text-[#0b1024]">
                        {complianceItems.length}
                      </strong>
                      {" заполнено"}
                    </span>
                    <span className={`font-semibold ${complianceTone.fgClass}`}>
                      {compliancePercent}% · {complianceTone.label}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#ececf4]">
                    <div
                      className={`h-full transition-all ${
                        unfilledCount === 0
                          ? "bg-emerald-500"
                          : compliancePercent >= 50
                            ? "bg-amber-500"
                            : "bg-rose-500"
                      }`}
                      style={{ width: `${compliancePercent}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          <ComplianceRing percent={compliancePercent} />
        </div>

        {/* Раскрывающиеся секции — каждая помнит state в localStorage.
            По умолчанию открыты только самые важные «Закрыть день» и
            «Превью отправки задач»; остальные свёрнуты чтобы дашборд
            не выглядел как лендинг. Юзер открывает то что ему нужно.
            mt-6 + border-t — визуальный divider между hero и секциями,
            раньше прогресс-бар «склеивался» с первой секцией. */}
        <div className="mt-6 space-y-3 border-t border-[#ececf4] pt-5 sm:mt-7 sm:pt-6">
          <DashboardSection
            storageKey="close-day"
            title="Закрыть день"
            subtitle="Незаполненные журналы за сегодня и быстрая отчётность."
            icon={CheckCircle2}
            defaultOpen={true}
            badge={
              unfilledCount > 0
                ? { text: `${unfilledCount} осталось`, tone: "warn" }
                : { text: "всё закрыто", tone: "ok" }
            }
          >
            <CloseDayCard unfilledCount={unfilledCount} />
          </DashboardSection>

          {/* TimeWindowAlerts — server-async. Server-component
              DashboardSection (native <details>) поддерживает
              async children без Suspense boundary. */}
          <DashboardSection
            storageKey="time-window-alerts"
            title="Срочно нужно заполнить"
            subtitle="Журналы с нарушением периодичности по СанПиН."
            icon={AlertCircle}
            defaultOpen={true}
          >
            <TimeWindowAlerts organizationId={organizationId} />
          </DashboardSection>

          {/* Compliance audit shortcut */}
          <Link
            href="/dashboard/compliance-audit"
            className="group flex items-center gap-3 rounded-3xl border border-[#5566f6]/20 bg-gradient-to-br from-[#f5f6ff] to-white p-4 transition-all hover:translate-y-[-1px] hover:border-[#5566f6]/40 hover:shadow-[0_8px_20px_-12px_rgba(85,102,246,0.35)]"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#5566f6] text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-semibold leading-tight text-[#0b1024]">
                Готовность к проверке Роспотребнадзора
              </div>
              <div className="mt-0.5 text-[12px] text-[#6f7282]">
                12 проверок · score 0-100 · конкретные «починить» по каждому пункту
              </div>
            </div>
            <ArrowRight className="size-4 shrink-0 text-[#5566f6] transition-transform group-hover:translate-x-1" />
          </Link>

          <DashboardSection
            storageKey="bulk-assign-preview"
            title="Превью отправки задач TasksFlow"
            subtitle="Что и кому уйдёт при отправке — без реальной отправки. Управление задачами в одном месте."
            icon={Send}
            defaultOpen={true}
          >
            <BulkAssignPreviewCard />
          </DashboardSection>

          <DashboardSection
            storageKey="anomalies"
            title="Аномалии и отклонения"
            subtitle="Что выбивается из нормы — температура, бракераж, ЧП за последние дни."
            icon={AlertCircle}
            defaultOpen={false}
          >
            <AnomaliesCard />
          </DashboardSection>

          <DashboardSection
            storageKey="live-claims"
            title="Лента заполнений в реальном времени"
            subtitle="Кто что заполнил сегодня — обновляется каждые 15 секунд."
            icon={Inbox}
            defaultOpen={false}
          >
            <LiveClaimsCard />
          </DashboardSection>

          <DashboardSection
            storageKey="med-books-expiry"
            title="Медицинские книжки"
            subtitle="Сроки действия и истекающие в ближайшие 30 дней."
            icon={Stethoscope}
            defaultOpen={false}
          >
            <MedBooksExpiryCard />
          </DashboardSection>

          <DashboardSection
            storageKey="staff-training"
            title="Обучение и инструктажи"
            subtitle="Кому пора пройти повторный инструктаж по СанПиН."
            icon={GraduationCap}
            defaultOpen={false}
          >
            <StaffTrainingCard />
          </DashboardSection>

          {complianceItems.length > 0 && (
            <DashboardSection
              storageKey="compliance-grid"
              title="Compliance — все журналы за сегодня"
              subtitle="Карточный обзор: зелёные заполнены, красные нет. Клик ведёт на журнал."
              icon={ListChecks}
              defaultOpen={false}
              badge={
                unfilledCount > 0
                  ? {
                      text: `${filledCount}/${complianceItems.length}`,
                      tone: unfilledCount === complianceItems.length ? "danger" : "warn",
                    }
                  : { text: "все ✓", tone: "ok" }
              }
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {complianceItems.map((item) => (
              <Link
                key={item.id}
                href={`/journals/${item.code}`}
                className={cn(
                  "group flex w-full min-w-0 items-start gap-3 rounded-2xl border px-4 py-3 text-[14px] transition-all sm:items-center",
                  item.filled
                    ? "border-[#c8f0d5] bg-[#effaf1] hover:border-[#7cf5c0] hover:shadow-[0_6px_20px_-12px_rgba(19,107,42,0.25)]"
                    : "border-[#ffd2cd] bg-[#fff4f2] hover:border-[#ff8d7d] hover:shadow-[0_6px_20px_-12px_rgba(210,69,61,0.25)]"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-xl",
                    item.filled ? "bg-[#d9f4e1] text-[#136b2a]" : "bg-[#ffe1dc] text-[#d2453d]"
                  )}
                >
                  {item.filled ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 font-medium leading-snug line-clamp-2 sm:truncate",
                    item.filled ? "text-[#136b2a]" : "text-[#d2453d]"
                  )}
                >
                  {item.name}
                </span>
                <ArrowRight
                  className={cn(
                    "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
                    item.filled ? "text-[#7cf5c0]" : "text-[#ffb0a6]"
                  )}
                />
              </Link>
            ))}
              </div>
            </DashboardSection>
          )}
        </div>
      </section>

      {/* Weekly tails — «просрочено за последние 7 дней», shortcut to
          the exact date inside the document viewer */}
      {weeklyTails.length > 0 && (
        <section className="rounded-3xl border border-[#ffd2cd] bg-[#fff4f2] p-6 shadow-[0_0_0_1px_rgba(255,195,185,0.35)]">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#ffe1dc] text-[#a13a32]">
              <AlertTriangle className="size-5" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] font-semibold text-[#0b1024]">
                Хвосты за неделю
              </h2>
              <p className="mt-0.5 text-[13px] text-[#6f7282]">
                За последние 7 дней остались незаполненные записи. Клик —
                открывает журнал на самом старом пропуске.
              </p>
              <ul className="mt-4 space-y-2">
                {weeklyTails.map((tail) => {
                  const badgeLabel =
                    tail.missingDays.length === 1
                      ? "1 пропуск"
                      : `${tail.missingDays.length} пропуска`;
                  const oldestPretty = new Date(
                    tail.oldestMissing + "T00:00:00Z"
                  ).toLocaleDateString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                  });
                  return (
                    <li key={tail.documentId}>
                      <Link
                        href={`/journals/${tail.templateCode}/documents/${tail.documentId}?focus=${tail.oldestMissing}`}
                        className="group flex items-start gap-3 rounded-2xl border border-[#ffd2cd] bg-white px-4 py-3 text-[14px] transition-colors hover:border-[#ff8d7d] hover:shadow-[0_6px_20px_-12px_rgba(210,69,61,0.25)] sm:items-center"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#ffe1dc] text-[#d2453d]">
                          <XCircle className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium leading-snug text-[#0b1024] line-clamp-2 sm:truncate">
                            {tail.templateName}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-[#6f7282]">
                            {tail.documentTitle}
                          </span>
                        </span>
                        <span className="hidden shrink-0 flex-col items-end text-right sm:flex">
                          <span className="text-[12px] font-medium text-[#a13a32]">
                            {badgeLabel}
                          </span>
                          <span className="text-[11px] text-[#9b9fb3]">
                            с {oldestPretty}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-[#ffb0a6] transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Health-check виджет — self-audit конфигурации (кратко в свёрнутом
          виде, разворачивается по клику). Не показываем когда score=100%
          — пустой шум на готовой настройке. */}
      {healthCheck.scorePercent < 100 ? (
        <OrgHealthWidget
          checks={healthCheck.checks}
          scorePercent={healthCheck.scorePercent}
          okCount={healthCheck.okCount}
          totalCount={healthCheck.totalCount}
        />
      ) : null}

      {/* Worker leaderboard — топ-3 за месяц по числу записей. Показываем
          только когда есть хотя бы 1 человек с записями (на пустой
          компании не выглядит странно). Геймификация для команды. */}
      {leaderboard.length > 0 && (
        <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff8eb] text-[#b25f00]">
              <Trophy className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[18px] font-semibold text-[#0b1024]">
                Топ за месяц
              </h2>
              <p className="mt-0.5 text-[13px] text-[#6f7282]">
                Кто заполнял журналы чаще всех за последние 30 дней.
              </p>
              <ol className="mt-4 space-y-2">
                {leaderboard.map((row, idx) => {
                  const medalColor =
                    idx === 0
                      ? { bg: "#fff8eb", fg: "#b25f00", emoji: "🥇" }
                      : idx === 1
                        ? { bg: "#f3f4f6", fg: "#52525b", emoji: "🥈" }
                        : { bg: "#fef3c7", fg: "#92400e", emoji: "🥉" };
                  return (
                    <li
                      key={row.userId}
                      className="flex items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3"
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[18px]"
                        style={{
                          backgroundColor: medalColor.bg,
                          color: medalColor.fg,
                        }}
                      >
                        {medalColor.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[#0b1024]">
                          {row.userName}
                        </span>
                        {row.positionTitle ? (
                          <span className="block truncate text-[12px] text-[#6f7282]">
                            {row.positionTitle}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end text-right">
                        <span className="text-[14px] font-semibold tabular-nums text-[#0b1024]">
                          {row.entryCount}
                          <span className="ml-1 text-[12px] font-normal text-[#6f7282]">
                            записей
                          </span>
                        </span>
                        {row.bonusKopecks > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-[#116b2a]">
                            <Coins className="size-3" />
                            +{(row.bonusKopecks / 100).toFixed(0)} ₽
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>
      )}

      {/* Strugglers — bottom-3 за месяц. Показываем только если есть
          разрыв (топ-1 хотя бы вдвое впереди отстающих) — иначе шум. */}
      {strugglers.length > 0 &&
        leaderboard[0] &&
        leaderboard[0].entryCount > strugglers[0].entryCount * 2 && (
          <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff4f2] text-[#a13a32]">
                <UserIcon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-semibold text-[#0b1024]">
                  Кому помочь
                </h2>
                <p className="mt-0.5 text-[13px] text-[#6f7282]">
                  Сотрудники с наименьшим числом записей за 30 дней —
                  поддержите их или проверьте загрузку.
                </p>
                <ol className="mt-4 space-y-2">
                  {strugglers.map((row) => (
                    <li
                      key={row.userId}
                      className="flex items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#fff4f2] text-[#a13a32]">
                        <UserIcon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-[#0b1024]">
                          {row.userName}
                        </span>
                        {row.positionTitle ? (
                          <span className="block truncate text-[12px] text-[#6f7282]">
                            {row.positionTitle}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-right text-[14px] font-semibold tabular-nums text-[#0b1024]">
                        {row.entryCount}
                        <span className="ml-1 text-[12px] font-normal text-[#6f7282]">
                          записей
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        )}

      {/* Alerts — shown only when something's off */}
      {(openCapaCount > 0 || expiringBatches > 0 || weekLossCount > 0 || pendingApproval > 0) && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pendingApproval > 0 && (
            <AlertPill
              href="/journals"
              tone="indigo"
              icon={AlertTriangle}
              value={pendingApproval}
              label="записей ждут проверки"
            />
          )}
          {openCapaCount > 0 && (
            <AlertPill
              href="/capa"
              tone="red"
              icon={AlertTriangle}
              value={openCapaCount}
              label="открытых CAPA"
            />
          )}
          {expiringBatches > 0 && (
            <AlertPill
              href="/batches?status=received"
              tone="amber"
              icon={Package}
              value={expiringBatches}
              label="партий скоро истекут"
            />
          )}
          {weekLossCount > 0 && (
            <AlertPill
              href="/losses"
              tone="orange"
              icon={TrendingDown}
              value={weekLossCount}
              label="потерь за неделю"
            />
          )}
        </section>
      )}

      {/* Quick actions — big tappable buttons */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAction
          href="/journals"
          icon={ClipboardList}
          title="Журналы"
          subtitle="Все журналы и записи"
          primary
        />
        <QuickAction
          href="/settings/users"
          icon={Users}
          title="Сотрудники"
          subtitle="Должности, графики"
        />
        <QuickAction
          href="/reports"
          icon={FileDown}
          title="Отчёты"
          subtitle="Сводки за период"
        />
        <QuickAction
          href="/sanpin"
          icon={BookOpen}
          title="Справочник"
          subtitle="Нормативы СанПиН"
        />
      </section>

      {/* Temperature from IoT sensors */}
      {iotEquipment.length > 0 && (
        <section className="overflow-hidden rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
              <ThermometerSun className="size-5" />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold text-[#0b1024]">
                Температура с датчиков
              </h2>
              <p className="mt-0.5 text-[13px] text-[#6f7282]">
                Показания за последние сутки. Клик по линии — подробнее.
              </p>
            </div>
          </div>
          <TemperatureChart equipmentList={iotEquipment} />
        </section>
      )}

      {/* Recent activity table */}
      <section className="overflow-hidden rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececf4] px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#f5f6ff] text-[#5566f6]">
              <Activity className="size-5" />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold text-[#0b1024]">
                Последние записи
              </h2>
              <p className="mt-0.5 text-[13px] text-[#6f7282]">
                Что сделано за 48 часов — {recentEntries.length}{" "}
                {recentEntries.length === 1 ? "запись" : "записей"}
              </p>
            </div>
          </div>
          <Link
            href="/journals"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium text-[#5566f6] transition-colors hover:bg-[#f5f6ff]"
          >
            Все журналы
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {recentEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#f5f6ff] text-[#9b9fb3]">
              <Sparkles className="size-7" />
            </span>
            <p className="mt-2 text-[15px] font-medium text-[#0b1024]">
              Записей пока нет
            </p>
            <p className="text-[13px] text-[#6f7282]">
              Как только кто-то внесёт первую запись, она появится здесь.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="bg-[#fafbff] text-[12px] uppercase tracking-wider text-[#9b9fb3]">
                  <th className="px-5 py-3 text-left font-medium">Когда</th>
                  <th className="px-5 py-3 text-left font-medium">Журнал</th>
                  <th className="px-5 py-3 text-left font-medium">Детали</th>
                  <th className="px-5 py-3 text-left font-medium">Участок</th>
                  <th className="px-5 py-3 text-left font-medium">Кто</th>
                  <th className="px-5 py-3 text-left font-medium">Источник</th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.slice(0, 12).map((entry) => {
                  const data = getEntryData(entry.data);
                  const source = data.source as string | undefined;
                  const isIoT = source === "tuya_auto" || source === "tuya_sensor";
                  const temp = data.temperature as number | undefined;
                  const isTempControl = entry.template.code === "temp_control";
                  return (
                    <tr key={entry.id} className="border-t border-[#ececf4]">
                      <td className="whitespace-nowrap px-5 py-3">
                        <div className="font-medium text-[#0b1024]">
                          {formatTime(entry.createdAt)}
                        </div>
                        <div className="text-[11px] text-[#9b9fb3]">
                          {formatRelativeTime(entry.createdAt)}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/journals/${entry.template.code}`}
                          className="font-medium text-[#5566f6] hover:underline"
                        >
                          {entry.template.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        {isTempControl && temp != null ? (
                          <div className="space-y-0.5">
                            {entry.equipment && (
                              <div className="text-[11px] text-[#9b9fb3]">
                                {entry.equipment.name}
                              </div>
                            )}
                            <span className="font-mono font-semibold text-[#0b1024]">
                              {temp}°C
                            </span>
                          </div>
                        ) : entry.equipment ? (
                          <span>{entry.equipment.name}</span>
                        ) : (
                          <span className="text-[#c7ccea]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[#6f7282]">
                        {entry.area?.name ?? "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[#0b1024]">
                          <UserIcon className="size-3 text-[#9b9fb3]" />
                          {entry.filledBy.name}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {isIoT ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7ff] px-2 py-0.5 text-[11px] font-medium text-[#0b7ea1]">
                            <Wifi className="size-3" />
                            {source === "tuya_auto" ? "Авто" : "Датчик"}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#9b9fb3]">Вручную</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatPill({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm ring-1 ring-white/10",
        alert && "bg-white/15 ring-white/30"
      )}
    >
      <div className="text-[26px] font-semibold leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-white/60">{label}</div>
      {hint ? (
        <div
          className={cn(
            "mt-0.5 text-[11px]",
            alert ? "text-[#ffd466]" : "text-white/40"
          )}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function ComplianceRing({ percent }: { percent: number }) {
  const size = 64;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  const color =
    percent >= 90 ? "#7cf5c0" : percent >= 60 ? "#ffd466" : "#ffb0a6";
  return (
    <div className="relative size-16 shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#eef1ff"
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          fill="transparent"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[14px] font-semibold text-[#0b1024]">
        {percent}%
      </div>
    </div>
  );
}

function AlertPill({
  href,
  tone,
  icon: Icon,
  value,
  label,
}: {
  href: string;
  tone: "red" | "amber" | "orange" | "indigo";
  icon: typeof AlertTriangle;
  value: number;
  label: string;
}) {
  const palette: Record<
    typeof tone,
    { card: string; ring: string; fg: string }
  > = {
    red: {
      card: "border-[#ffd2cd] bg-[#fff4f2]",
      ring: "bg-[#ffe1dc] text-[#d2453d]",
      fg: "text-[#d2453d]",
    },
    amber: {
      card: "border-[#ffe2a0] bg-[#fff8eb]",
      ring: "bg-[#ffe9b0] text-[#b25f00]",
      fg: "text-[#b25f00]",
    },
    orange: {
      card: "border-[#ffd1a8] bg-[#fff2e5]",
      ring: "bg-[#ffe0c2] text-[#c2510a]",
      fg: "text-[#c2510a]",
    },
    indigo: {
      card: "border-[#c7ccea] bg-[#eef1ff]",
      ring: "bg-[#dadfff] text-[#5566f6]",
      fg: "text-[#5566f6]",
    },
  };
  const c = palette[tone];
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(11,16,36,0.15)] ${c.card}`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${c.ring}`}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-[20px] font-semibold tabular-nums ${c.fg}`}>
          {value}
        </div>
        <div className={`text-[12px] leading-tight opacity-85 ${c.fg}`}>
          {label}
        </div>
      </div>
      <ArrowRight
        className={`size-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 ${c.fg}`}
      />
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  subtitle,
  primary,
}: {
  href: string;
  icon: typeof ClipboardList;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3 rounded-2xl border px-4 py-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(85,102,246,0.18)]",
        primary
          ? "border-[#5566f6] bg-[#5566f6] text-white"
          : "border-[#ececf4] bg-white text-[#0b1024] hover:border-[#d6d9ee]"
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
          primary ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-[#eef1ff] text-[#5566f6]"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "text-[15px] font-semibold",
              primary ? "text-white" : "text-[#0b1024]"
            )}
          >
            {title}
          </div>
          <ArrowRight
            className={cn(
              "size-4 shrink-0 transition-transform group-hover:translate-x-0.5",
              primary ? "text-white/70" : "text-[#c7ccea]"
            )}
          />
        </div>
        <div
          className={cn(
            "mt-1 text-[12px] leading-tight",
            primary ? "text-white/80" : "text-[#6f7282]"
          )}
        >
          {subtitle}
        </div>
      </div>
    </Link>
  );
}

/**
 * Compliance items are consumed in the section above via <CheckCircle2 /> and
 * <XCircle /> — the unused ShieldCheck + ThermometerSun imports here are for
 * the future "badges" feature and should stay so lint stays honest.
 */
void ShieldCheck;
