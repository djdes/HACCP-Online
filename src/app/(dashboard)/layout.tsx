import { requireAuth } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <AuthSessionProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </AuthSessionProvider>
  );
}
