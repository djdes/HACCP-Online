import { isImpersonating, requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { Toaster } from "@/components/ui/sonner";
import {
  SiteThemeBootstrap,
  SiteThemeProvider,
} from "@/components/theme/site-theme";
import { SanpinChatWidget } from "@/components/ai/sanpin-chat-widget";
import { SupportWidget } from "@/components/support/support-widget";
import { CommandPalette } from "@/components/layout/command-palette";
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
      select: { positionTitle: true, themePreference: true },
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
          className="app-shell min-h-screen bg-gray-50"
          data-app-theme={initialTheme}
          suppressHydrationWarning
        >
          {impersonatedName ? (
            <ImpersonationBanner organizationName={impersonatedName} />
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
          <main className="p-4 md:p-6">{children}</main>
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
        </div>
        <Toaster />
      </SiteThemeProvider>
    </AuthSessionProvider>
  );
}
