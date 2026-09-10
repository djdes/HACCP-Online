import type { PositionMatrix } from "@/lib/topvisor";

/**
 * Поиск просевших позиций для ночного алерта.
 *
 * Главное требование к алерту — не стать шумом (как и у остальных
 * платформенных алертов, см. `platform-alerts.ts`). Позиции в выдаче
 * шатает на пару пунктов постоянно, и сообщать о каждом дрожании
 * бессмысленно: такой алерт перестанут читать. Поэтому три повода, и
 * все три означают «сходи посмотри»:
 *
 *  * фраза вылетела из ТОП-10 — потеря почти всего трафика по ней;
 *  * фраза просела сразу на 5+ пунктов — так шум не выглядит;
 *  * фраза пропала из выдачи, хотя вчера была.
 *
 * Свою историю не храним: сравниваем два свежих среза, которые и так
 * приезжают из Topvisor одним запросом.
 */

export type DropReason = "out-of-top10" | "dropped" | "lost";

export type PositionDrop = {
  phrase: string;
  /** Позиция на предыдущем срезе. */
  from: number;
  /** Позиция на свежем срезе; null — фразы в выдаче больше нет. */
  to: number | null;
  /** Отрицательное число: на сколько пунктов просела. */
  delta: number;
  reason: DropReason;
  url: string | null;
};

/** Меньший провал — это шум выдачи, а не повод будить человека. */
const MIN_DROP = 5;

export type DropsResult = {
  /** Дата свежего среза; null — сравнивать не с чем. */
  date: string | null;
  /** Дата предыдущего среза. */
  previousDate: string | null;
  drops: PositionDrop[];
};

export function findDrops(
  matrix: PositionMatrix,
  minDrop: number = MIN_DROP
): DropsResult {
  const [newest, previous] = matrix.dates;
  if (!newest || !previous) {
    return { date: newest ?? null, previousDate: null, drops: [] };
  }

  const drops: PositionDrop[] = [];
  for (const row of matrix.rows) {
    const from = row.byDate[previous]?.position ?? null;
    // Фразу без прошлой позиции сравнивать не с чем: она либо только
    // добавлена, либо не снималась. Это не падение.
    if (from == null) continue;

    const to = row.byDate[newest]?.position ?? null;
    const url = row.byDate[newest]?.url ?? row.byDate[previous]?.url ?? null;

    if (to == null) {
      drops.push({ phrase: row.phrase, from, to: null, delta: -from, reason: "lost", url });
      continue;
    }

    const delta = from - to;
    if (delta >= 0) continue; // выросла или осталась на месте

    if (from <= 10 && to > 10) {
      drops.push({ phrase: row.phrase, from, to, delta, reason: "out-of-top10", url });
    } else if (-delta >= minDrop) {
      drops.push({ phrase: row.phrase, from, to, delta, reason: "dropped", url });
    }
  }

  // Сначала то, что болит сильнее: вылет из ТОП-10 важнее просадки
  // с 80-го на 90-е, даже если пунктов там больше.
  const weight: Record<DropReason, number> = {
    "out-of-top10": 0,
    lost: 1,
    dropped: 2,
  };
  drops.sort(
    (a, b) => weight[a.reason] - weight[b.reason] || a.delta - b.delta
  );

  return { date: newest, previousDate: previous, drops };
}

const REASON_LABEL: Record<DropReason, string> = {
  "out-of-top10": "вылет из ТОП-10",
  lost: "пропала из выдачи",
  dropped: "просадка",
};

/** Текст для Telegram: коротко и так, чтобы было понятно без открытия сайта. */
export function formatDropsMessage(
  result: DropsResult,
  regionName: string,
  limit = 10
): string {
  const lines = [
    `📉 Позиции ${regionName}`,
    `Срез ${result.date} против ${result.previousDate}`,
    "",
  ];

  for (const drop of result.drops.slice(0, limit)) {
    const to = drop.to == null ? "нет в выдаче" : `${drop.to}`;
    lines.push(`• ${drop.phrase}: ${drop.from} → ${to} (${REASON_LABEL[drop.reason]})`);
  }

  const hidden = result.drops.length - limit;
  if (hidden > 0) lines.push(`…и ещё ${hidden}`);

  lines.push("", "https://wesetup.ru/root/seo/positions");
  return lines.join("\n");
}
