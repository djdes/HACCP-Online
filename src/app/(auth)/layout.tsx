import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getWebHomeHref } from "@/lib/role-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth-уже-есть → /dashboard сразу. Без этого `/login` показывал бы
  // форму даже залогиненному пользователю — приходящему с лендинга это
  // выглядит как «меня разлогинило». Один лишний редирект сэкономит
  // тап и убирает сомнения «а я точно вошёл».
  const session = await getServerSession(authOptions).catch(() => null);
  if (session?.user) {
    redirect(
      getWebHomeHref({
        role: session.user.role ?? "",
        isRoot: session.user.isRoot === true,
      })
    );
  }

  // Pages below render their own full-screen layouts (split panels, etc) —
  // keep this wrapper as a transparent pass-through so they get the whole
  // viewport instead of being boxed into a 28rem card.
  return <div className="min-h-screen bg-[#f7f7fb]">{children}</div>;
}
