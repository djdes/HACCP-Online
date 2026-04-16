import Link from "next/link";
import { LayoutDashboard, ScrollText, Settings2 } from "lucide-react";
import { requireRoot } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function RootAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // All /root/* pages are gated here + in middleware. Middleware returns 404
  // without a valid root JWT, requireRoot() throws notFound() again as a
  // belt-and-braces safety net in case middleware is ever bypassed.
  const session = await requireRoot();

  return (
    <div className="min-h-screen bg-[#f4f5fb]">
      <header className="border-b border-[#dddfe8] bg-[#11142b] text-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-8 py-5">
          <div>
            <div className="text-[12px] uppercase tracking-[0.18em] text-white/60">
              HACCP-Online · Platform
            </div>
            <div className="mt-1 text-[20px] font-semibold tracking-tight">
              {session.user.name || session.user.email}
            </div>
          </div>
          <nav className="flex items-center gap-6 text-[14px]">
            <Link
              href="/root"
              className="inline-flex items-center gap-2 hover:text-white"
            >
              <LayoutDashboard className="size-4" />
              Организации
            </Link>
            <Link
              href="/root/telegram-logs"
              className="inline-flex items-center gap-2 hover:text-white"
            >
              <ScrollText className="size-4" />
              Telegram логи
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 hover:bg-white/20"
            >
              <Settings2 className="size-4" />
              Выйти в приложение
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-8 py-8">{children}</main>
    </div>
  );
}
