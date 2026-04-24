import { isImpersonating, requireAuth } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { Toaster } from "@/components/ui/sonner";
import {
  SiteThemeBootstrap,
  SiteThemeProvider,
} from "@/components/theme/site-theme";
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

  const [impersonatedOrg, profile] = await Promise.all([
    isImpersonating(session) && session.user.actingAsOrganizationId
      ? db.organization.findUnique({
          where: { id: session.user.actingAsOrganizationId },
          select: { name: true },
        })
      : Promise.resolve(null),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { positionTitle: true },
    }),
  ]);

  const impersonatedName = impersonatedOrg?.name ?? null;

  return (
    <AuthSessionProvider session={session}>
      <SiteThemeProvider>
        <SiteThemeBootstrap />
        <div
          className="app-shell min-h-screen bg-gray-50"
          data-app-theme="light"
          suppressHydrationWarning
        >
          {impersonatedName ? (
            <ImpersonationBanner organizationName={impersonatedName} />
          ) : null}
          <Header
            userName={session.user.name ?? "Пользователь"}
            userEmail={session.user.email ?? ""}
            organizationName={impersonatedName ?? session.user.organizationName ?? ""}
            userRole={session.user.role ?? ""}
            positionTitle={profile?.positionTitle ?? ""}
            isRoot={session.user.isRoot === true}
            telegramBotUsername={process.env.TELEGRAM_BOT_USERNAME ?? ""}
          />
          <main className="p-4 md:p-6">{children}</main>
        </div>
        <Toaster />
      </SiteThemeProvider>
    </AuthSessionProvider>
  );
}
