import Link from "next/link";
import { ArrowLeft, Clock, TrendingDown, TrendingUp } from "lucide-react";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ROOT-only страница: время заполнения форм по template'ам.
 * Source — `FormFillTiming` rows за последние 30 дней.
 *
 * Цель: продакт находит самые медленные формы → упрощает UX.
 *   Hygiene заполняется за 12 сек — норм.
 *   Climate — за 90 сек → есть что упростить.
 *   Intensive_cooling — за 180 сек → плохо, в таблице top-1 в красном.
 */

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} сек`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return remSec === 0 ? `${min} мин` : `${min} мин ${remSec} сек`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function p90(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return sorted[idx];
}

export default async function RootTimingsPage() {
  await requireRoot();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [timings, templates] = await Promise.all([
    db.formFillTiming.findMany({
      where: { createdAt: { gte: since } },
      select: { templateId: true, durationMs: true },
    }),
    db.journalTemplate.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    }),
  ]);

  const tplById = new Map(templates.map((t) => [t.id, t]));

  // Aggregate per templateId.
  const byTpl = new Map<string, number[]>();
  for (const t of timings) {
    const list = byTpl.get(t.templateId) ?? [];
    list.push(t.durationMs);
    byTpl.set(t.templateId, list);
  }

  const rows = [...byTpl.entries()]
    .map(([templateId, values]) => {
      const tpl = tplById.get(templateId);
      return {
        templateId,
        code: tpl?.code ?? "(unknown)",
        name: tpl?.name ?? "(unknown)",
        count: values.length,
        median: median(values),
        p90: p90(values),
        avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
      };
    })
    .sort((a, b) => b.median - a.median);

  // Цветовая интенсивность по медиане:
  //   <30s: 🟢 fast
  //   30s-90s: 🟡 normal
  //   >90s: 🔴 slow → в первую очередь упрощать
  function tone(medianMs: number) {
    if (medianMs > 90_000)
      return { bg: "#fff4f2", fg: "#a13a32", label: "медленно" };
    if (medianMs > 30_000)
      return { bg: "#fff8eb", fg: "#7a4a00", label: "нормально" };
    return { bg: "#ecfdf5", fg: "#116b2a", label: "быстро" };
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/root"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К списку организаций
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <Clock className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Время заполнения форм
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Медиана и p90 длительности заполнения форм task-fill за
              последние 30 дней. Топ медленных журналов — кандидаты на
              UX-упрощение. Sample &lt; 5 не показываем — статистика
              недостоверна.
            </p>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="text-[15px] font-medium text-[#0b1024]">
            Пока нет данных
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            Метрика начинает накапливаться когда сотрудники открывают и
            закрывают формы task-fill. Подождите 1-2 дня после деплоя.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#ececf4] bg-white">
          <table className="w-full min-w-[680px] text-[14px]">
            <thead className="bg-[#fafbff] text-[12px] uppercase tracking-[0.06em] text-[#6f7282]">
              <tr>
                <th className="px-4 py-3 text-left">Журнал</th>
                <th className="px-4 py-3 text-right">Sample</th>
                <th className="px-4 py-3 text-right">Медиана</th>
                <th className="px-4 py-3 text-right">P90</th>
                <th className="px-4 py-3 text-right">Среднее</th>
                <th className="px-4 py-3 text-left">Скорость</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ececf4]">
              {rows
                .filter((r) => r.count >= 5)
                .map((r) => {
                  const t = tone(r.median);
                  return (
                    <tr key={r.templateId}>
                      <td className="px-4 py-3 text-[#0b1024]">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-[#9b9fb3]">
                          {r.code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#3c4053]">
                        {r.count}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#0b1024]">
                        {formatDuration(r.median)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#3c4053]">
                        {formatDuration(r.p90)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#3c4053]">
                        {formatDuration(r.avg)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium"
                          style={{ backgroundColor: t.bg, color: t.fg }}
                        >
                          {r.median > 90_000 ? (
                            <TrendingUp className="size-3" />
                          ) : (
                            <TrendingDown className="size-3" />
                          )}
                          {t.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {rows.filter((r) => r.count < 5).length > 0 ? (
        <p className="text-[12px] text-[#9b9fb3]">
          Скрыто {rows.filter((r) => r.count < 5).length} журналов с
          sample &lt; 5 — недостоверная статистика.
        </p>
      ) : null}
    </div>
  );
}
