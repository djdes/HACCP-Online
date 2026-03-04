import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, ClipboardList, Wifi, BookOpen, Search } from "lucide-react";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getNormsForTemplate } from "@/lib/sanpin-norms";

function formatDate(date: Date): string {
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Черновик</Badge>;
    case "submitted":
      return <Badge variant="secondary">На проверке</Badge>;
    case "approved":
      return <Badge className="bg-green-600">Утверждено</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// Type guard for entry data
type EntryData = Record<string, unknown>;

function getEntryData(data: unknown): EntryData {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as EntryData;
  }
  return {};
}

export default async function JournalEntriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ status?: string; from?: string; to?: string; area?: string; page?: string }>;
}) {
  const { code } = await params;
  const filters = await searchParams;
  const session = await requireAuth();

  const template = await db.journalTemplate.findUnique({
    where: { code },
  });

  if (!template) {
    notFound();
  }

  // Build filter conditions
  const where: Record<string, unknown> = {
    templateId: template.id,
    organizationId: session.user.organizationId,
  };

  if (filters.status && filters.status !== "all") {
    where.status = filters.status;
  }

  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.gte = new Date(filters.from);
    if (filters.to) {
      const to = new Date(filters.to);
      to.setHours(23, 59, 59, 999);
      createdAt.lte = to;
    }
    where.createdAt = createdAt;
  }

  if (filters.area) {
    where.areaId = filters.area;
  }

  const pageSize = 50;
  const page = Math.max(1, parseInt(filters.page || "1"));

  const [entries, totalCount, areas] = await Promise.all([
    db.journalEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        filledBy: { select: { name: true } },
        area: { select: { name: true } },
        equipment: { select: { name: true } },
      },
    }),
    db.journalEntry.count({ where }),
    db.area.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const isTempControl = code === "temp_control";
  const relevantNorms = getNormsForTemplate(code);

  // Build filter URL helper
  function filterUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams();
    const merged = { status: filters.status || "", from: filters.from || "", to: filters.to || "", area: filters.area || "", ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) p.set(k, v);
    });
    const qs = p.toString();
    return `/journals/${code}${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = filters.status || filters.from || filters.to || filters.area;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          {template.description && (
            <p className="mt-1 text-muted-foreground">
              {template.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {relevantNorms.length > 0 && (
            <Button variant="outline" asChild>
              <Link href="/sanpin">
                <BookOpen className="size-4" />
                СанПиН
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href={`/journals/${code}/new`}>
              <Plus className="size-4" />
              Новая запись
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
        <Search className="size-4 text-muted-foreground" />

        <form className="flex flex-wrap items-center gap-2" action={`/journals/${code}`}>
          <select
            name="status"
            defaultValue={filters.status || "all"}
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="submitted">На проверке</option>
            <option value="approved">Утверждено</option>
          </select>

          <input
            type="date"
            name="from"
            defaultValue={filters.from || ""}
            placeholder="С"
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          />

          <input
            type="date"
            name="to"
            defaultValue={filters.to || ""}
            placeholder="По"
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
          />

          {areas.length > 0 && (
            <select
              name="area"
              defaultValue={filters.area || ""}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">Все участки</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}

          <Button type="submit" variant="secondary" size="sm">
            Применить
          </Button>
          {hasFilters && (
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/journals/${code}`}>Сбросить</Link>
            </Button>
          )}
        </form>

        <div className="ml-auto text-xs text-muted-foreground">
          Найдено: {totalCount}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <ClipboardList className="size-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">
            {hasFilters ? "Записей не найдено" : "Записей пока нет"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasFilters
              ? "Попробуйте изменить фильтры"
              : "Создайте первую запись в этом журнале"}
          </p>
          {!hasFilters && (
            <Button asChild className="mt-4">
              <Link href={`/journals/${code}/new`}>
                <Plus className="size-4" />
                Новая запись
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  {isTempControl && <TableHead>Оборудование</TableHead>}
                  {isTempControl && <TableHead>Температура</TableHead>}
                  <TableHead>Заполнил</TableHead>
                  <TableHead>Участок</TableHead>
                  {isTempControl && <TableHead>Источник</TableHead>}
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const data = getEntryData(entry.data);
                  const source = data.source as string | undefined;
                  const isIoT =
                    source === "tuya_auto" || source === "tuya_sensor";
                  const temp = data.temperature as number | undefined;

                  return (
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell>
                        <Link href={`/journals/${code}/${entry.id}`} className="block">
                          {formatDate(entry.createdAt)}
                        </Link>
                      </TableCell>
                      {isTempControl && (
                        <TableCell>
                          <Link href={`/journals/${code}/${entry.id}`} className="block font-medium">
                            {entry.equipment?.name ?? "—"}
                          </Link>
                        </TableCell>
                      )}
                      {isTempControl && (
                        <TableCell>
                          <Link href={`/journals/${code}/${entry.id}`} className="block">
                            {temp != null ? (
                              <span className="font-mono font-semibold">
                                {temp}°C
                              </span>
                            ) : (
                              "—"
                            )}
                          </Link>
                        </TableCell>
                      )}
                      <TableCell>{entry.filledBy.name}</TableCell>
                      <TableCell>{entry.area?.name ?? "—"}</TableCell>
                      {isTempControl && (
                        <TableCell>
                          {isIoT ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                              <Wifi className="size-3" />
                              {source === "tuya_auto" ? "Авто" : "Датчик"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Вручную
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={filterUrl({ page: String(page - 1) })}>
                    Назад
                  </Link>
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                Страница {page} из {totalPages}
              </span>
              {page < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={filterUrl({ page: String(page + 1) })}>
                    Далее
                  </Link>
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
