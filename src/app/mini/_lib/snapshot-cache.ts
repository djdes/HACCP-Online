/**
 * Снимок главного экрана для мгновенного показа.
 *
 * В подвале с одной палкой запрос главной идёт секунды, и всё это время
 * человек видит скелетон. Снимок прошлого ответа отдаёт тот же список за
 * доли секунды — с честной пометкой, на какое время эти данные.
 *
 * Снимок — ТОЛЬКО для чтения списка. Он никогда не становится
 * источником данных формы: запись в журнал обязана строиться на том,
 * что сейчас ответил сервер, иначе в документ уедет вчерашний состав
 * обязанностей.
 *
 * Главная опасность — чужой снимок. На кухне «одна трубка на три
 * смены», и список задач повара А, показанный повару Б, читается как
 * его собственный. Поэтому владелец пишется внутрь снимка и сверяется
 * при чтении, а не подразумевается ключом.
 */

export type Snapshot<T> = {
  /** Чей это снимок. Не совпал с текущей сессией — снимок не наш. */
  userId: string;
  /** Какой организации. ROOT смотрит чужие: снимок одной не годится другой. */
  organizationId: string | null;
  savedAt: number;
  data: T;
};

/** Старше суток — уже не «свежие данные», а дезинформация. */
export const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type SnapshotScope = {
  userId: string | null;
  organizationId: string | null;
};

/**
 * Годится ли снимок к показу. Разделено с чтением из хранилища, потому
 * что ошибиться здесь — значит показать человеку чужую смену.
 */
export function isSnapshotUsable<T>(
  snapshot: Snapshot<T> | null,
  scope: SnapshotScope,
  now: number
): boolean {
  if (!snapshot) return false;
  if (!scope.userId) return false;
  if (snapshot.userId !== scope.userId) return false;
  if (snapshot.organizationId !== scope.organizationId) return false;
  const age = now - snapshot.savedAt;
  // Снимок «из будущего» — переведённые часы. Показывать можно, но
  // возраст считать нельзя, поэтому просто не доверяем.
  if (age < 0) return false;
  return age <= SNAPSHOT_MAX_AGE_MS;
}

/** «данные на 08:12» — короткая честная пометка рядом со списком. */
export function snapshotAgeLabel(savedAt: number, now: number): string {
  const age = now - savedAt;
  if (age < 60_000) return "данные только что";
  const time = new Date(savedAt).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `данные на ${time}`;
}

const KEY = "wesetup.mini.home-snapshot";

export function readSnapshot<T>(): Snapshot<T> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot<T>;
    if (typeof parsed?.savedAt !== "number" || typeof parsed?.userId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSnapshot<T>(
  data: T,
  scope: SnapshotScope,
  now: number = Date.now()
): void {
  if (!scope.userId) return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        userId: scope.userId,
        organizationId: scope.organizationId,
        savedAt: now,
        data,
      } satisfies Snapshot<T>)
    );
  } catch {
    /* хранилище заблокировано — экран просто ждёт сервер, как раньше */
  }
}

/** Выход и смена организации обязаны снимок убирать. */
export function clearSnapshot(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
