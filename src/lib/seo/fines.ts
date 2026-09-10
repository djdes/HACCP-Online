/**
 * Калькулятор штрафов по КоАП РФ (редакция 2026 года, суммы в рублях).
 * Санкции даны диапазоном; по некоторым статьям вместо штрафа возможно
 * приостановление деятельности до 90 суток.
 */
export type FineArticle = {
  id: string;
  article: string;
  title: string;
  hint: string;
  ip: [number, number];
  legal: [number, number];
  official: [number, number];
  suspension: boolean;
};

export const FINE_ARTICLES: FineArticle[] = [
  { id: "6.3-1", article: "ст. 6.3 ч. 1", title: "Нарушение санитарных правил (общее)", hint: "Нет ППК, журналов, медкнижек, не проводится производственный контроль.", ip: [500, 1000], legal: [10_000, 20_000], official: [500, 1000], suspension: true },
  { id: "6.6", article: "ст. 6.6", title: "Санитарные требования к организации питания", hint: "Температура, бракераж, товарное соседство, гигиена на кухне.", ip: [5000, 10_000], legal: [30_000, 50_000], official: [5000, 10_000], suspension: true },
  { id: "14.43-1", article: "ст. 14.43 ч. 1", title: "Нарушение требований техрегламентов (ХАССП)", hint: "Не внедрены процедуры ХАССП по ТР ТС 021/2011.", ip: [20_000, 30_000], legal: [100_000, 300_000], official: [10_000, 20_000], suspension: false },
  { id: "14.43-2", article: "ст. 14.43 ч. 2", title: "Нарушение техрегламентов с вредом здоровью", hint: "Отравление или иной вред как следствие нарушения.", ip: [30_000, 40_000], legal: [300_000, 600_000], official: [20_000, 30_000], suspension: true },
  { id: "6.3-2", article: "ст. 6.3 ч. 2", title: "Нарушение санитарных правил при угрозе распространения болезни", hint: "В период ограничительных мероприятий (карантин).", ip: [50_000, 150_000], legal: [200_000, 500_000], official: [50_000, 150_000], suspension: true },
  { id: "14.8", article: "ст. 14.8 ч. 1", title: "Нет информации для потребителя", hint: "Отсутствуют состав, аллергены, сроки годности на выдаче.", ip: [500, 1000], legal: [5000, 10_000], official: [500, 1000], suspension: false },
];

export type FineTotals = { ip: [number, number]; legal: [number, number]; official: [number, number]; suspension: boolean; count: number };

export function sumFines(ids: string[]): FineTotals {
  const chosen = FINE_ARTICLES.filter((a) => ids.includes(a.id));
  const add = (key: "ip" | "legal" | "official"): [number, number] => [chosen.reduce((s, a) => s + a[key][0], 0), chosen.reduce((s, a) => s + a[key][1], 0)];
  return { ip: add("ip"), legal: add("legal"), official: add("official"), suspension: chosen.some((a) => a.suspension), count: chosen.length };
}

export function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}
