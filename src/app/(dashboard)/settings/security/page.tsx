import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { LOGIN_METHOD_LABEL, maskIp, type LoginMethod } from "@/lib/login-device";
import { PageHeader } from "@/components/ui/page-header";

import { SecurityClient } from "./security-client";

export const dynamic = "force-dynamic";

/**
 * «Безопасность»: история входов и «завершить все сессии». Доступна
 * каждому пользователю для его аккаунта — руководителю и сотруднику.
 */
export default async function SecurityPage() {
  const session = await requireAuth();
  const rows = await db.loginEvent.findMany({
    where: { userId: session.user.id },
    orderBy: { at: "desc" },
    take: 30,
    select: { id: true, at: true, ip: true, device: true, method: true, isNewDevice: true },
  });
  const logins = rows.map((row) => ({
    id: row.id,
    at: row.at.toISOString(),
    ip: maskIp(row.ip),
    device: row.device,
    method: LOGIN_METHOD_LABEL[(row.method as LoginMethod) in LOGIN_METHOD_LABEL ? (row.method as LoginMethod) : "password"],
    isNewDevice: row.isNewDevice,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Безопасность"
        description="Кто и откуда входил в ваш аккаунт, и одна кнопка, чтобы разом выйти со всех устройств."
      />
      <SecurityClient logins={logins} />
    </div>
  );
}
