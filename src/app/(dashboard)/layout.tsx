import { isImpersonating, requireAuth } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Header } from "@/components/layout/header";
import { ImpersonationBanner } from "@/components/dashboard/impersonation-banner";
import { Toaster } from "@/components/ui/sonner";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  // When root is impersonating a customer org, pull its name for the banner.
  // Cached implicitly via the per-request Next.js data cache.
  let impersonatedName: string | null = null;
  if (isImpersonating(session) && session.user.actingAsOrganizationId) {
    const org = await db.organization.findUnique({
      where: { id: session.user.actingAsOrganizationId },
      select: { name: true },
    });
    impersonatedName = org?.name ?? null;
  }

  return (
    <AuthSessionProvider session={session}>
      <div className="min-h-screen bg-gray-50">
        {impersonatedName ? (
          <ImpersonationBanner organizationName={impersonatedName} />
        ) : null}
        <Header
          userName={session.user.name ?? "Пользователь"}
          userEmail={session.user.email ?? ""}
          organizationName={impersonatedName ?? session.user.organizationName ?? ""}
        />
        <main className="p-4 md:p-6">{children}</main>
      </div>
      <Toaster />
    </AuthSessionProvider>
  );
}
