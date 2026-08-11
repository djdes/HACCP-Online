import { Suspense } from "react";
import { isImpersonating, requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { CompleteProfileNudge } from "@/components/dashboard/complete-profile-nudge";
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
import { WhatsNewModal } from "@/components/dashboard/whats-new-modal";
import {
  LATEST_NOTES_BUILD_SHA,
  WHATS_NEW_NOTES,
} from "@/lib/whats-new-notes";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
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

  const [impersonatedOrg, profile, brandedOrg] = await Promise.all([
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
      select: { brandColor: true, logoUrl: true },
    }),
  ]);

  const impersonatedName = impersonatedOrg?.name ?? null;
  const initialTheme: "light" | "dark" =
    profile?.themePreference === "dark" ? "dark" : "light";

  // Анкета считается незаполненной, если аккаунт завели мгновенной
  // регистрацией (имя = почта) или так и не указали телефон. Схему под
  // это не меняли: старые аккаунты из визарда телефон указывали
  // обязательно и под эвристику не попадают.
  //
  // ROOT и платформенная организация исключены: это служебный аккаунт
  // владельца, у него нет и не должно быть анкеты заведения — эвристика
  // цепляла его за отсутствующий телефон и показывала лишний баннер.
  const platformOrgId = (process.env.PLATFORM_ORG_ID ?? "platform").trim();
  const needsProfileCompletion =
    hasFullWorkspaceAccess(session.user) &&
    !isImpersonating(session) &&
    session.user.isRoot !== true &&
    activeOrgId !== platformOrgId &&
    Boolean(profile) &&
    (!profile?.phone || profile?.name === profile?.email);

  // Validate hex color (#RRGGBB) — иначе CSS injection-vector.
  const brandColor =
    brandedOrg?.brandColor && /^#[0-9a-fA-F]{6}$/.test(brandedOrg.brandColor)
      ? brandedOrg.brandColor
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
        <div
          className="app-shell flex min-h-screen flex-col bg-gray-50"
          data-app-theme={initialTheme}
          suppressHydrationWarning
        >
          {impersonatedName ? (
            <ImpersonationBanner organizationName={impersonatedName} />
          ) : null}
          {needsProfileCompletion ? (
            // Suspense — компонент читает `?welcome=1` через useSearchParams.
            <Suspense fallback={null}>
              <CompleteProfileNudge email={profile?.email ?? ""} />
            </Suspense>
          ) : null}
          <Header
            userName={session.user.name ?? "Пользователь"}
            userEmail={session.user.email ?? ""}
            organizationName={impersonatedName ?? session.user.organizationName ?? ""}
            organizationLogoUrl={brandedOrg?.logoUrl ?? null}
            userRole={session.user.role ?? ""}
            positionTitle={profile?.positionTitle ?? ""}
            isRoot={session.user.isRoot === true}
            telegramBotUsername={process.env.TELEGRAM_BOT_USERNAME ?? ""}
          />
          {/* Контент по центру, 1296px — контейнер эталона
              (docs/reference/haccp-online/typography.json → listPage.container).
              Вертикальный ритм: 24px сверху, как на эталоне. */}
          <main className="flex-1 p-4 md:p-6">
            <div className="mx-auto w-full max-w-[1296px]">{children}</div>
          </main>
          {/* Футер дашборда — виден на каждой странице (требование
              владельца: «наш футер на каждой странице»). `mt-auto`
              прижимает его к низу на коротких экранах. */}
          <DashboardFooter />
          {/* AI SanPiN/HACCP помощник — доступен management+ из любого
              экрана дашборда. Сотрудникам без полного доступа не
              нужен — они выполняют конкретные задачи, а не настраивают
              нормативы. */}
          {hasFullWorkspaceAccess(session.user) ? <SanpinChatWidget /> : null}
          {/* Поддержка — доступна management+ из любого экрана. */}
          {hasFullWorkspaceAccess(session.user) ? <SupportWidget /> : null}
          {/* «Что нового» — modal появляется если пользователь не видел
              текущую версию notes. Только для management — рядовым
              сотрудникам это шум. */}
          {hasFullWorkspaceAccess(session.user) ? (
            <WhatsNewModal
              buildSha={LATEST_NOTES_BUILD_SHA}
              notes={WHATS_NEW_NOTES}
            />
          ) : null}
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
