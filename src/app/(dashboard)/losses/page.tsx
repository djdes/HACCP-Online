import Link from "next/link";
import { TrendingDown, Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const CATEGORY_LABELS: Record<string, string> = {
  overweight: "Перевес",
  underweight: "Недовес",
  packaging_defect: "Брак упаковки",
  rework: "Переработка",
  writeoff: "Списание",
  bottleneck_idle: "Простой",
  raw_material_variance: "Разброс сырья",
  other: "Другое",
};

export default async function LossesPage() {
  const session = await requireAuth();
  const orgId = session.user.organizationId;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [records, weekRecords] = await Promise.all([
    db.lossRecord.findMany({
      where: { organizationId: orgId },
      orderBy: { date: "desc" },
      take: 100,
    }),
    db.lossRecord.findMany({
      where: { organizationId: orgId, date: { gte: weekAgo } },
    }),
  ]);

  // Weekly summary by category
  const weekByCategory: Record<string, { count: number; totalQty: number; totalCost: number }> = {};
  for (const r of weekRecords) {
    if (!weekByCategory[r.category]) weekByCategory[r.category] = { count: 0, totalQty: 0, totalCost: 0 };
    weekByCategory[r.category].count++;
    weekByCategory[r.category].totalQty += r.quantity;
    weekByCategory[r.category].totalCost += r.costRub || 0;
  }

  const totalWeekCost = weekRecords.reduce((sum, r) => sum + (r.costRub || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Учёт потерь</h1>
          <p className="mt-1 text-muted-foreground">7 источников потерь на производстве</p>
        </div>
        <Button asChild>
          <Link href="/losses/new">
            <Plus className="size-4" />
            Записать потерю
          </Link>
        </Button>
      </div>

      {/* Weekly summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="size-5 text-red-500" />
              Потери за неделю
            </CardTitle>
            {totalWeekCost > 0 && (
              <span className="text-lg font-bold text-red-600">
                {totalWeekCost.toLocaleString("ru-RU")} руб
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(weekByCategory).sort(([, a], [, b]) => b.totalCost - a.totalCost).map(([cat, data]) => (
              <div key={cat} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[cat] || cat}</p>
                <p className="text-lg font-bold">{data.count}</p>
                <p className="text-xs text-muted-foreground">
                  {data.totalQty.toFixed(1)} ед.
                  {data.totalCost > 0 && ` / ${data.totalCost.toLocaleString("ru-RU")} руб`}
                </p>
              </div>
            ))}
            {Object.keys(weekByCategory).length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                За неделю потерь не зафиксировано
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Категория</TableHead>
              <TableHead>Продукт</TableHead>
              <TableHead>Кол-во</TableHead>
              <TableHead>Стоимость</TableHead>
              <TableHead>Причина</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.date.toLocaleDateString("ru-RU")}</TableCell>
                <TableCell>
                  <Badge variant="outline">{CATEGORY_LABELS[r.category] || r.category}</Badge>
                </TableCell>
                <TableCell className="font-medium">{r.productName}</TableCell>
                <TableCell>{r.quantity} {r.unit}</TableCell>
                <TableCell>{r.costRub ? `${r.costRub.toLocaleString("ru-RU")} руб` : "—"}</TableCell>
                <TableCell className="text-sm">{r.cause || "—"}</TableCell>
              </TableRow>
            ))}
            {records.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Записей пока нет
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
