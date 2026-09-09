/**
 * Идеи клиентов и голосование — чистые правила.
 *
 * Площадка общая для всех организаций: идею видят и за неё голосуют все
 * руководители, автор снаружи не показывается (только «ваша идея» самому
 * автору и ROOT). Статусы ставит ROOT.
 */
export const IDEA_STATUSES = ["new", "planned", "in_progress", "done", "declined"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_STATUS_LABEL: Record<IdeaStatus, string> = {
  new: "Новая",
  planned: "В планах",
  in_progress: "В работе",
  done: "Сделано",
  declined: "Не будем",
};

export const IDEA_STATUS_HINT: Record<IdeaStatus, string> = {
  new: "Ждёт голосов и решения",
  planned: "Возьмём в одну из ближайших версий",
  in_progress: "Уже делаем",
  done: "Вышло — смотрите «Что нового»",
  declined: "Решили не делать — причина в комментарии",
};

export const OPEN_IDEA_STATUSES: IdeaStatus[] = ["new", "planned", "in_progress"];

export function isIdeaStatus(value: unknown): value is IdeaStatus {
  return typeof value === "string" && (IDEA_STATUSES as readonly string[]).includes(value);
}

export const IDEA_TITLE_MIN = 5;
export const IDEA_TITLE_MAX = 120;
export const IDEA_DESCRIPTION_MAX = 2000;
export const IDEA_ADMIN_NOTE_MAX = 1000;
/** Сколько идей одна организация может предложить за сутки. */
export const IDEAS_PER_ORG_PER_DAY = 5;

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function validateIdeaInput(input: {
  title: unknown;
  description: unknown;
}): { ok: true; title: string; description: string | null } | { ok: false; error: string } {
  const title = clean(input.title);
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (title.length < IDEA_TITLE_MIN) return { ok: false, error: `Название — хотя бы ${IDEA_TITLE_MIN} символов` };
  if (title.length > IDEA_TITLE_MAX) return { ok: false, error: `Название — не длиннее ${IDEA_TITLE_MAX} символов` };
  if (description.length > IDEA_DESCRIPTION_MAX) {
    return { ok: false, error: `Описание — не длиннее ${IDEA_DESCRIPTION_MAX} символов` };
  }
  return { ok: true, title, description: description ? description : null };
}

export type IdeaSort = "top" | "new";

export function sortIdeas<T extends { votes: number; createdAt: Date | string; status: string }>(ideas: T[], sort: IdeaSort): T[] {
  const time = (v: Date | string) => (typeof v === "string" ? new Date(v) : v).getTime();
  return [...ideas].sort((a, b) => {
    if (sort === "top") {
      if (b.votes !== a.votes) return b.votes - a.votes;
    }
    return time(b.createdAt) - time(a.createdAt);
  });
}

export type IdeaFilter = "open" | "done" | "all";

export function filterIdeas<T extends { status: string }>(ideas: T[], filter: IdeaFilter): T[] {
  if (filter === "all") return ideas;
  if (filter === "done") return ideas.filter((i) => i.status === "done");
  return ideas.filter((i) => (OPEN_IDEA_STATUSES as string[]).includes(i.status));
}

/** Заголовок уведомления автору при смене статуса. */
export function describeIdeaStatusChange(title: string, status: IdeaStatus): string {
  const short = title.length > 60 ? `${title.slice(0, 57)}…` : title;
  return `Идея «${short}» — ${IDEA_STATUS_LABEL[status].toLowerCase()}`;
}
