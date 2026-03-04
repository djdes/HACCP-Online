import Link from "next/link";
import {
  ClipboardList,
  Users,
  ThermometerSun,
} from "lucide-react";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireAuth();
  const organizationId = session.user.organizationId;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalEntries, todayEntries, activeTemplates, activeUsers] =
    await Promise.all([
      db.journalEntry.count({
        where: { organizationId },
      }),
      db.journalEntry.count({
        where: {
          organizationId,
          createdAt: { gte: todayStart },
        },
      }),
      db.journalTemplate.count({
        where: { isActive: true },
      }),
      db.user.count({
        where: { organizationId, isActive: true },
      }),
    ]);

  const templates = await db.journalTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const stats = [
    {
      title: "Записей сегодня",
      value: todayEntries,
      icon: ClipboardList,
    },
    {
      title: "Всего записей",
      value: totalEntries,
      icon: ClipboardList,
    },
    {
      title: "Сотрудников",
      value: activeUsers,
      icon: Users,
    },
    {
      title: "Журналов",
      value: activeTemplates,
      icon: ThermometerSun,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Journal template cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Журналы</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Link key={template.id} href={`/journals/${template.code}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  {template.description && (
                    <CardDescription>{template.description}</CardDescription>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
