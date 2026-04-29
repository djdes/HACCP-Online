"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Sparkles,
  UserCheck,
} from "lucide-react";

type Scope = {
  scopeKey: string;
  scopeLabel: string;
  sublabel?: string;
  journalDocumentId?: string;
  availability: "available" | "mine" | "taken" | "completed";
  claim: {
    id: string;
    userId: string;
    userName?: string | null;
    status: string;
    claimedAt: string;
  } | null;
};

type MyActive = {
  id: string;
  journalCode: string;
  scopeKey: string;
  scopeLabel: string;
  parentHint?: string | null;
} | null;

type Pool = {
  code: string;
  date: string;
  pool: boolean;
  scopes: Scope[];
  myActive: MyActive;
};

/**
 * Универсальный Mini-App список задач для одного журнала. Использует
 * /api/journal-task-pool/[code] — рисует scope'ы со статусами:
 *   - available  → синяя кнопка «Взять»
 *   - mine       → зелёная плашка «Я выполняю» + кнопка «Завершить» / «Отпустить»
 *   - taken      → серая «Занято: <Имя>»
 *   - completed  → зелёная «Готово: <Имя>»
 *
 * Если у пользователя уже есть active claim в ДРУГОМ журнале —
 * все «Взять» disabled с tooltip «Сначала заверши».
 *
 * После claim'а делаем `router.push(<entryPath>)` если callback задан,
 * иначе просто refresh — клиент журнала сам подхватит claim через
 * другой endpoint. Это позволяет встроить компонент в разные UI без
 * жёсткого binding'а.
 */
export function JournalTaskPool({
  code,
  buildEntryPath,
}: {
  code: string;
  /** Опц. строитель пути для перехода к форме после claim. */
  buildEntryPath?: (scope: Scope) => string;
}) {
  const router = useRouter();
  const [pool, setPool] = useState<Pool | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const res = await fetch(`/api/journal-task-pool/${code}?date=${date}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Pool;
      setPool(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function claim(scope: Scope) {
    if (!pool) return;
    setBusy(scope.scopeKey);
    setError(null);
    try {
      const res = await fetch("/api/journal-task-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalCode: code,
          scopeKey: scope.scopeKey,
          scopeLabel: scope.scopeLabel,
          dateKey: pool.date,
          parentHint: scope.scopeLabel,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || "Не удалось взять");
      }
      // Если backend вернул свежий claim с id — сразу переходим на
      // универсальную форму /mini/claim/[id] (быстрый ввод).
      // Кастомный buildEntryPath по-прежнему имеет приоритет —
      // используется например cleaning, у которого matrix-документ
      // сложнее быстрой формы.
      if (buildEntryPath) {
        await load();
        router.push(buildEntryPath(scope));
        return;
      }
      if (data?.claim?.id) {
        router.push(`/mini/claim/${data.claim.id}`);
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function release(claimId: string) {
    setBusy(claimId);
    try {
      await fetch(`/api/journal-task-claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function complete(claimId: string) {
    setBusy(claimId);
    try {
      await fetch(`/api/journal-task-claims/${claimId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!pool && !error) {
    return (
      <div className="flex h-32 items-center justify-center text-[#6f7282]">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#ffd2cd] bg-[#fff4f2] p-4 text-[14px] text-[#a13a32]">
        <AlertTriangle className="mr-2 inline size-4" />
        {error}
      </div>
    );
  }
  if (!pool) return null;

  if (!pool.pool) {
    return (
      <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[14px] text-[#6f7282]">
        У этого журнала нет ежедневного pool'а задач.
      </div>
    );
  }
  if (pool.scopes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-6 text-center text-[14px] text-[#6f7282]">
        На сегодня нет задач в этом журнале.
        <br />
        <span className="text-[12px] text-[#9b9fb3]">
          Попросите менеджера создать активный документ.
        </span>
      </div>
    );
  }

  const myActiveOtherJournal =
    pool.myActive && pool.myActive.journalCode !== code ? pool.myActive : null;

  return (
    <div className="space-y-3">
      {myActiveOtherJournal ? (
        <div className="rounded-2xl border border-[#ffe9b0] bg-[#fff8eb] p-3 text-[13px] text-[#a13a32]">
          <Lock className="mr-1.5 inline size-4 align-text-bottom" />
          У вас в работе:&nbsp;
          <span className="font-semibold">{myActiveOtherJournal.scopeLabel}</span>
          &nbsp;— завершите её прежде чем брать новые.
        </div>
      ) : null}

      {pool.scopes.map((scope) => (
        <ScopeCard
          key={scope.scopeKey}
          scope={scope}
          busy={busy === scope.scopeKey}
          claimBusy={busy === scope.claim?.id}
          locked={Boolean(myActiveOtherJournal)}
          onClaim={() => claim(scope)}
          onRelease={() => scope.claim && release(scope.claim.id)}
          onComplete={() => scope.claim && complete(scope.claim.id)}
          buildEntryPath={buildEntryPath}
        />
      ))}
    </div>
  );
}

function ScopeCard({
  scope,
  busy,
  claimBusy,
  locked,
  onClaim,
  onRelease,
  onComplete,
  buildEntryPath,
}: {
  scope: Scope;
  busy: boolean;
  claimBusy: boolean;
  locked: boolean;
  onClaim: () => void;
  onRelease: () => void;
  onComplete: () => void;
  buildEntryPath?: (scope: Scope) => string;
}) {
  const router = useRouter();
  const av = scope.availability;
  const isMine = av === "mine";
  const isCompleted = av === "completed";
  const isTaken = av === "taken";

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-2xl border p-3.5 transition-colors",
        isCompleted
          ? "border-[#c8f0d5] bg-[#ecfdf5]"
          : isMine
            ? "border-[#5566f6] bg-[#eef1ff]"
            : isTaken
              ? "border-[#ececf4] bg-[#fafbff] opacity-70"
              : "border-[#ececf4] bg-white",
      ].join(" ")}
    >
      <span
        className={[
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          isCompleted
            ? "bg-[#d9f4e1] text-[#136b2a]"
            : isMine
              ? "bg-[#5566f6] text-white"
              : isTaken
                ? "bg-[#ececf4] text-[#9b9fb3]"
                : "bg-[#eef1ff] text-[#3848c7]",
        ].join(" ")}
      >
        {isCompleted ? (
          <CheckCircle2 className="size-5" />
        ) : isMine ? (
          <UserCheck className="size-5" />
        ) : isTaken ? (
          <Lock className="size-5" />
        ) : (
          <Sparkles className="size-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-[#0b1024]">
          {scope.scopeLabel}
        </div>
        {scope.sublabel ? (
          <div className="mt-0.5 text-[12px] text-[#6f7282]">
            {scope.sublabel}
          </div>
        ) : null}
        {scope.claim ? (
          <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-[#6f7282]">
            <Clock className="size-3" />
            {isCompleted ? "Готово · " : isMine ? "Я · " : "Занято · "}
            <span className={isCompleted ? "text-[#136b2a]" : isMine ? "text-[#3848c7]" : "text-[#0b1024]"}>
              {scope.claim.userName || "сотрудник"}
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        {av === "available" && !locked ? (
          <button
            type="button"
            onClick={onClaim}
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(85,102,246,0.6)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Взять
          </button>
        ) : null}
        {av === "available" && locked ? (
          <button
            type="button"
            disabled
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#ececf4] bg-[#fafbff] px-3 text-[13px] text-[#9b9fb3]"
            title="Сначала заверши текущую задачу"
          >
            <Lock className="size-3.5" />
            Закрыто
          </button>
        ) : null}
        {av === "mine" ? (
          <>
            {buildEntryPath ? (
              <button
                type="button"
                onClick={() => router.push(buildEntryPath(scope))}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white"
              >
                Открыть
              </button>
            ) : null}
            <button
              type="button"
              onClick={onComplete}
              disabled={claimBusy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#136b2a] px-3 text-[13px] font-medium text-white"
            >
              Завершить
            </button>
            <button
              type="button"
              onClick={onRelease}
              disabled={claimBusy}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 text-[12px] text-[#6f7282]"
            >
              Отпустить
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
