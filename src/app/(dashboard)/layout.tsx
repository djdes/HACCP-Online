import { Suspense } from "react";
import { isImpersonating, requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { CompleteProfileNudge } from "@/components/dashboard/complete-profile-nudge";
import { WelcomeOrgBanner } from "@/components/organizations/welcome-org-banner";
import { DemoOrgBanner } from "@/components/organizations/demo-org-banner";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";
import { Toaster } from "@/components/ui/sonner";
import {
  SiteThemeBootstrap,
  SiteThemeProvider,
} from "@/components/theme/site-theme";
import { SanpinChatWidget } from "@/components/ai/sanpin-chat-widget";
import { SupportWidget } from "@/components/support/support-widget";
import { CommandPalette } from "@/components/layout/command-palette";
import { UrgentJournalHotkey } from "@/components/layout/urgent-journal-hotkey";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { hasCapability } from "@/lib/permission-presets";
import { getBalance } from "@/lib/balance/ledger";
import { db } from "@/lib/db";
import { DEFAULT_ORG_NAME } from "@/lib/org-profile";
import { listAccessibleOrganizations } from "@/lib/organization-access";
import { BILLING_TEST_MODE, FREE_MAX_USERS } from "@/lib/plan-limits";
import { PageNav, PageNavProvider } from "@/components/layout/page-nav";
import { JournalUndoProvider } from "@/components/journals/journal-undo-slot";
import { PartnerAccessBanner } from "@/components/dashboard/partner-access-banner";
import {
  getPartnerBrandById,
  getVisibleOrgBranding,
} from "@/lib/partners/branding";
import { toConsultantContact } from "@/lib/partners/consultant-contact";
import { getPartnerMembership } from "@/lib/partners/service";
import { getPartnerHintRates } from "@/lib/partners/partner-hint";
import "@/app/app-theme.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Все (dashboard) routes — приватные. Дублирует robots.txt, но также
// влияет на кэшированную HTML-копию у юзера (если кто-то поделится
// скриншотом dev-tools или пробросит deep-link через WhatsApp web preview).
export const metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  const activeOrgId =
    isImpersonating(session) && session.user.actingAsOrganizationId
      ? session.user.actingAsOrganizationId
      : getActiveOrgId(session);

  const partnerAccess = session.user.partnerAccess ?? null;

  const [
    impersonatedOrg,
    profile,
    brandedOrg,
    organizations,
    ownedAccount,
    partnerBranding,
    partnerMembership,
    partnerAccessBrand,
  ] = await Promise.all([
    isImpersonating(session) && session.user.actingAsOrganizationId
      ? db.organization.findUnique({
          where: { id: session.user.actingAsOrganizationId },
          select: { name: true },
        })
      : Promise.resolve(null),
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        positionTitle: true,
        themePreference: true,
        // Признаки незавершённой анкеты после мгновенной регистрации:
        // имя равно почте и/или не заполнен телефон.
        email: true,
        name: true,
        phone: true,
      },
    }),
    // H1 — white-label: читаем brandColor для override основного
    // indigo и logoUrl для замены WESETUP-лейбла в шапке.
    db.organization.findUnique({
      where: { id: activeOrgId },
      select: {
        brandColor: true,
        logoUrl: true,
        name: true,
        // E2: тариф и численность едут в меню профиля пропсами —
        // клиентского fetch'а за этим ради одной строки не заводим.
        subscriptionPlan: true,
        type: true,
        accountId: true,
        account: { select: { subscriptionPlan: true } },
        // Демо-организация: баннер «данные тестовые» + счётчики для
        // диалога удаления.
        isDemo: true,
        demoExpiresAt: true,
        _count: {
          select: {
            users: { where: { isActive: true } },
            journalDocuments: true,
          },
        },
      },
    }),
      listAccessibleOrganizations(session.user.id),
      db.account.findUnique({
        where: { ownerUserId: session.user.id },
        select: { id: true },
      }),
      // White-label партнёра: бренд, акцент и контакты консультанта для
      // кабинета клиента. null — если партнёра нет или клиент выбрал
      // стандартный интерфейс WeSetup.
      getVisibleOrgBranding(activeOrgId),
      // Переключатель контекста «Моя организация / Партнёрский кабинет»
      // нужен только участнику партнёра в своей организации; внутри
      // кабинета клиента (partnerAccess) он и так видит баннер партнёра.
      partnerAccess ? Promise.resolve(null) : getPartnerMembership(session.user.id),
      // Имя партнёра для баннера «вы здесь как партнёр» — независимо от
      // того, скрыл клиент брендинг или нет.
      partnerAccess ? getPartnerBrandById(partnerAccess.partnerId) : Promise.resolve(null),
    ]);

  // Тариф и лимит мест живут на аккаунте: у сети из трёх кафе один
  // договор и общие бесплатные места (FREE_MAX_USERS). Пока организация не привязана
  // к аккаунту (миграция не прогонялась) — считаем по одной точке.
  // Демо-организация в тариф не входит: её 10–20 тестовых сотрудников
  // иначе молча перевели бы аккаунт с бесплатного на платный.
  const accountUsers = brandedOrg?.accountId
    ? await db.user.count({
        where: {
          isActive: true,
          organization: { accountId: brandedOrg.accountId, isDemo: false },
        },
      })
    : brandedOrg?.isDemo
      ? 0
      : (brandedOrg?._count.users ?? 0);
  const accountPlan =
    brandedOrg?.account?.subscriptionPlan ??
    brandedOrg?.subscriptionPlan ??
    "free";

  // Баллы в шапке видит только тот, кто может ими распорядиться:
  // сумма — это деньги организации. Остальным пункт меню всё равно
  // показываем: отзыв пишет и повар, просто без цифры.
  const balanceRub = hasCapability(session.user, "admin.full")
    ? await getBalance(activeOrgId).catch(() => null)
    : null;

  const impersonatedName = impersonatedOrg?.name ?? null;
  const initialTheme: "light" | "dark" =
    profile?.themePreference === "dark" ? "dark" : "light";

  // Анкета считается незаполненной, если нет телефона или организация
  // всё ещё называется заглушкой из мгновенной регистрации. На имя
  // больше не смотрим: оно стало необязательным, и сервер подставляет
  // туда название организации — старая проверка `name === email`
  // никогда бы не сработала.
  //
  // ROOT и платформенная организация исключены: это служебный аккаунт
  // владельца, у него нет и не должно быть анкеты заведения. Демо —
  // тоже: `/api/profile/complete` пишет в активную организацию и
  // переименовал бы песочницу вместо своей.
  const platformOrgId = (process.env.PLATFORM_ORG_ID ?? "platform").trim();
  const needsProfileCompletion =
    hasFullWorkspaceAccess(session.user) &&
    !isImpersonating(session) &&
    session.user.isRoot !== true &&
    activeOrgId !== platformOrgId &&
    !brandedOrg?.isDemo &&
    Boolean(profile) &&
    (!profile?.phone || brandedOrg?.name === DEFAULT_ORG_NAME);

  // Validate hex color (#RRGGBB) — иначе CSS injection-vector.
  const brandColor =
    brandedOrg?.brandColor && /^#[0-9a-fA-F]{6}$/.test(brandedOrg.brandColor)
      ? brandedOrg.brandColor
      : null;

  // Партнёрский брендинг. Собственные настройки организации (цвет,
  // логотип) старше партнёрских: если клиент задал свой цвет — акцент
  // партнёра не трогаем. Акцент уже проверен на формат и контраст при
  // сохранении (`checkAccent`), но hex-формат перепроверяем перед
  // вставкой в <style>.
  const consultant = toConsultantContact(partnerBranding);

  // Иконка «партнёрская программа» у логотипа. Считается после брендинга:
  // под чужим (white-label) логотипом звать под свой бренд неуместно.
  const headerLogoUrl = brandedOrg?.logoUrl ?? consultant?.logoUrl ?? null;
  const partnerHint = await getPartnerHintRates({
    organizationId: activeOrgId,
    userId: session.user.id,
    hasWhiteLabelLogo: Boolean(headerLogoUrl),
  });
  const partnerAccent =
    !brandColor &&
    consultant?.accentColor &&
    /^#[0-9a-fA-F]{6}$/.test(consultant.accentColor) &&
    consultant.accentHover &&
    /^#[0-9a-fA-F]{6}$/.test(consultant.accentHover)
      ? { color: consultant.accentColor, hover: consultant.accentHover }
      : null;
  const partnerCabinet =
    partnerMembership && partnerMembership.partner.status === "active"
      ? { brandName: partnerMembership.partner.brandName }
      : null;

  return (
    <AuthSessionProvider session={session}>
      <SiteThemeProvider initialTheme={initialTheme}>
        <SiteThemeBootstrap />
        {/* H1 — white-label brand color через CSS-vars. Подменяет
            основной indigo (#5566f6) если org указала свой цвет. */}
        {brandColor ? (
          <style
            dangerouslySetInnerHTML={{
              __html: `.app-shell { --brand-color: ${brandColor}; }`,
            }}
          />
        ) : null}
        {/* Акцент партнёра: переменные подхватывают правила
            `.app-shell[data-partner-accent]` в app-theme.css — кнопки и
            активные элементы перекрашиваются без правки компонентов. */}
        {partnerAccent ? (
          <style
            dangerouslySetInnerHTML={{
              __html: `.app-shell { --brand-accent: ${partnerAccent.color}; --brand-accent-hover: ${partnerAccent.hover}; }`,
            }}
          />
        ) : null}
        <div
          className="app-shell flex min-h-screen flex-col bg-gray-50"
          data-app-theme={initialTheme}
          data-partner-accent={partnerAccent ? "" : undefined}
          suppressHydrationWarning
        >
          {impersonatedName ? (
            <ImpersonationBanner organizationName={impersonatedName} />
          ) : null}
          {partnerAccess ? (
            <PartnerAccessBanner
              organizationName={brandedOrg?.name ?? "Организация"}
              brandName={partnerAccessBrand?.brandName ?? "партнёр"}
              level={partnerAccess.level}
            />
          ) : null}
          {needsProfileCompletion ? (
            // Suspense — компонент читает `?welcome=1` через useSearchParams.
            <Suspense fallback={null}>
              <CompleteProfileNudge email={profile?.email ?? ""} />
            </Suspense>
          ) : null}
          {/* Провайдер обнимает и шапку, и страницу: кнопки отмены
              рендерятся наверху, а их состояние живёт в клиенте открытого
              документа — иначе они друг друга не видят. */}
          <JournalUndoProvider>
          <Header
            userName={session.user.name ?? "Пользователь"}
            userEmail={session.user.email ?? ""}
            organizationName={impersonatedName ?? session.user.organizationName ?? ""}
            organizationLogoUrl={headerLogoUrl}
            userRole={session.user.role ?? ""}
            positionTitle={profile?.positionTitle ?? ""}
            isRoot={session.user.isRoot === true}
            subscriptionPlan={accountPlan}
            balanceRub={balanceRub}
            activeUsers={accountUsers}
            freeUserLimit={FREE_MAX_USERS}
            billingTestMode={BILLING_TEST_MODE}
            organizations={organizations}
            activeOrganizationId={activeOrgId}
            canCreateOrganization={Boolean(ownedAccount)}
            organizationSphere={brandedOrg?.type ?? "restaurant"}
            partnerCabinet={partnerCabinet}
            partnerHint={partnerHint}
          />
          {/* Быстрый старт только что созданной точки. Живёт в layout'е,
              а не на странице дашборда: баннер сам решает показываться
              по `?welcome-org=1`, и дашборд о нём знать не обязан. */}
          <Suspense fallback={null}>
            <WelcomeOrgBanner
              organizationId={activeOrgId}
              organizationName={brandedOrg?.name ?? "Организация"}
            />
          </Suspense>
          {/* Песочница: постоянная полоса «данные тестовые» с выходом
              в свою организацию и удалением. Только владельцу аккаунта —
              у него и кнопки, и домашняя организация, куда возвращаться. */}
          {brandedOrg?.isDemo && ownedAccount && !isImpersonating(session) ? (
            <Suspense fallback={null}>
              <DemoOrgBanner
                organizationName={brandedOrg.name}
                demoExpiresAt={brandedOrg.demoExpiresAt?.toISOString() ?? null}
                homeOrganizationId={session.user.organizationId}
                staffCount={brandedOrg._count.users}
                documentsCount={brandedOrg._count.journalDocuments}
              />
            </Suspense>
          ) : null}
          {/* Контент во всю ширину экрана (R1: владельцу было «узко»
              на 1296px). Ограничение max-w-[1800px] оставлено только ради
              сверхшироких мониторов, где строка таблицы иначе теряет глаз.
              Вертикальный ритм: 24px сверху, как на эталоне.

              ВАЖНО: горизонтальные паддинги живут ВНУТРИ коробки 1800px
              (px-4 md:px-8), ровно как в <Header>. Раньше padding был на
              <main> (снаружи коробки), из-за чего левая граница контента
              оказывалась на 24px левее левой границы шапки. Единственное
              место, где задаётся горизонтальная геометрия страницы. */}
          <main className="flex-1 py-4 md:py-6">
            <div className="mx-auto w-full max-w-[1800px] px-4 md:px-8">
              {/* Провайдер оборачивает и навигацию, и контент: страницы
                  уточняют крошки через <PageCrumbs>, а рисует их PageNav. */}
              <PageNavProvider>
                <PageNav
                  organizationName={
                    impersonatedName ?? session.user.organizationName ?? ""
                  }
                />
                {children}
              </PageNavProvider>
            </div>
          </main>
          </JournalUndoProvider>
          {/* Футер дашборда — виден на каждой странице (требование
              владельца: «наш футер на каждой странице»). `mt-auto`
              прижимает его к низу на коротких экранах. */}
          <DashboardFooter partnerBrandName={consultant?.brandName ?? null} />
          {/* AI помощник — доступен ВСЕМ авторизованным (решение
              владельца 2026-09-02): отвечает по текущей странице и данным
              организации, действия предлагает карточкой с подтверждением.
              Права на действия режутся на сервере (ACL, «своя строка /
              сегодня»), поэтому виджет безопасен и для рядовых ролей. */}
          <SanpinChatWidget />
          {/* Поддержка — доступна management+ из любого экрана. */}
          {hasFullWorkspaceAccess(session.user) ? (
            <SupportWidget
              consultant={consultant}
              hideChat={Boolean(partnerAccess)}
            />
          ) : null}
          {/* «Что нового» отключено: заметки писались вручную и отставали
              от кода — менялся SHA сборки, а текст оставался прежним, и
              модалка после каждого входа показывала старое как новое.
              Компонент и src/lib/whats-new-notes.ts на месте: вернуть
              можно одной строкой, когда будет чем наполнять. */}
          {/* ⌘K — палитра-навигатор. Один глобальный listener на keydown,
              ноль cost когда не открыт. Доступна всем кто видит dashboard. */}
          <CommandPalette />
          {/* P2.A.1 — Ctrl+Shift+N → срочный журнал → /journals/[code]/new */}
          <UrgentJournalHotkey />
        </div>
        <Toaster />
      </SiteThemeProvider>
    </AuthSessionProvider>
  );
}
