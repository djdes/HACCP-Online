import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiTokenManager } from "./api-token-manager";

export const dynamic = "force-dynamic";

export default async function ExternalApiSettingsPage() {
  // Role-gate через единый helper — все management-роли имеют доступ.
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/journals");
  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { name: true, externalApiToken: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API интеграций</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ключ для внешнего приложения сотрудников и сенсоров. Передайте интегратору.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Персональный ключ организации</CardTitle>
          <CardDescription>
            Все запросы к <code className="rounded bg-muted px-1 py-0.5 text-[12px]">POST /api/external/entries</code>
            с этим ключом автоматически пишутся в организацию «{org?.name}». Если ключ утёк — сбросьте его и раздайте новый.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApiTokenManager initialToken={org?.externalApiToken ?? null} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Как использовать</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="overflow-x-auto rounded-xl bg-muted px-4 py-3 text-[12px]">
{`curl -X POST https://wesetup.ru/api/external/entries \\
  -H "authorization: Bearer <ваш_ключ>" \\
  -H "content-type: application/json" \\
  -d '{
    "journalCode": "hygiene",
    "date": "2026-04-16",
    "data": { "status": "healthy", "temperatureAbove37": false }
  }'`}
          </pre>
          <p className="text-muted-foreground">
            Поле <code className="rounded bg-muted px-1 py-0.5">organizationId</code> можно не указывать —
            оно берётся из ключа. Для повторных запросов используйте заголовок
            <code className="ml-1 rounded bg-muted px-1 py-0.5">Idempotency-Key</code>, чтобы сервер вернул тот же
            ответ без дублей. Healthcheck:{" "}
            <code className="rounded bg-muted px-1 py-0.5">GET /api/external/healthz</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
