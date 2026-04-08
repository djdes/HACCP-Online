import { requireAuth } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Header } from "@/components/layout/header";
import { Toaster } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return (
    <AuthSessionProvider session={session}>
      <div className="min-h-screen bg-gray-50">
        <Header
          userName={session.user.name ?? "Пользователь"}
          userEmail={session.user.email ?? ""}
          organizationName={session.user.organizationName ?? ""}
        />
        <main className="p-4 md:p-6">{children}</main>
      </div>
      <Toaster />
    </AuthSessionProvider>
  );
}
