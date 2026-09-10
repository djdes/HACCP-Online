import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { computeNps } from "@/lib/nps";

export const dynamic = "force-dynamic";

function tone(score: number): string {
  return score >= 9 ? "bg-[#ecfdf5] text-[#116b2a]" : score >= 7 ? "bg-[#fff8eb] text-[#b25f00]" : "bg-[#fff4f2] text-[#a13a32]";
}

/** NPS клиентов: индекс за 90 дней и за всё время, комментарии. */
export default async function RootNpsPage() {
  await requireRoot();
  const now = new Date();
  const since = new Date(now.getTime() - 90 * 86_400_000);
  const [recent, all, latest] = await Promise.all([
    db.npsResponse.findMany({ where: { createdAt: { gte: since } }, select: { score: true } }),
    db.npsResponse.findMany({ select: { score: true } }),
    db.npsResponse.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const orgIds = Array.from(new Set(latest.map((r) => r.organizationId)));
  const orgs = orgIds.length ? await db.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }) : [];
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const s90 = computeNps(recent.map((r) => r.score));
  const sAll = computeNps(all.map((r) => r.score));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">NPS клиентов</h1>
        <p className="mt-1 max-w-[720px] text-[14px] leading-relaxed text-[#6f7282]">
          Один вопрос руководителю раз в 90 дней: «Порекомендуете ли WeSetup коллегам?» NPS = доля промоутеров (9–10) минус доля критиков (0–6).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          ["За 90 дней", s90],
          ["За всё время", sAll],
        ].map(([label, s]) => {
          const summary = s as typeof s90;
          return (
            <section key={label as string} className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">{label as string}</div>
              <div className="mt-2 text-[40px] font-semibold tabular-nums" data-testid="nps-value">{summary.nps === null ? "—" : summary.nps}</div>
              <div className="mt-1 text-[13px] text-[#6f7282]">
                ответов {summary.total} · промоутеры {summary.promoters} · нейтральные {summary.passives} · критики {summary.detractors}
                {summary.average !== null ? ` · средняя ${summary.average}` : ""}
              </div>
            </section>
          );
        })}
      </div>
      {latest.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-12 text-center text-[14px] text-[#6f7282]">Ответов пока нет.</div>
      ) : (
        <ul className="space-y-2">
          {latest.map((r) => (
            <li key={r.id} className="flex items-start gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3">
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums ${tone(r.score)}`}>{r.score}</span>
              <div className="min-w-0">
                <div className="text-[13px] text-[#6f7282]">
                  {orgName.get(r.organizationId) ?? r.organizationId} · {r.createdAt.toLocaleString("ru-RU")}
                </div>
                {r.comment ? <p className="mt-1 text-[14px] leading-relaxed text-[#0b1024]">{r.comment}</p> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
