"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Coins, Loader2, Lock } from "lucide-react";

/**
 * Премиальная карточка obligation для mini-home (Phase 3, шаг 3.4).
 *
 * Логика:
 *   • если уже забрана (`claimedById` != null) — read-only с подписью
 *     «уже взял Иван в 12:34»;
 *   • иначе — лайм-кнопка «Взять с бонусом X ₽», по клику зовёт
 *     `POST /api/journals/[id]/claim-bonus`. На 200/201 ведём на
 *     `/mini/bonus/[id]` (форма с обязательным фото). На 409
 *     обновляем стейт «уже взял …» прямо на месте.
 */
export function MiniBonusCard({
  obligationId,
  title,
  subtitle,
  bonusAmountKopecks,
  initialClaimedByName,
  initialClaimedAt,
  index,
}: {
  obligationId: string;
  title: string;
  subtitle?: string | null;
  bonusAmountKopecks: number;
  initialClaimedByName: string | null;
  initialClaimedAt: string | null;
  index?: number;
}) {
  const router = useRouter();
  const [claimedByName, setClaimedByName] = useState<string | null>(
    initialClaimedByName
  );
  const [claimedAt, setClaimedAt] = useState<string | null>(
    initialClaimedAt
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClaimed = claimedByName !== null || claimedAt !== null;
  const amountRubles = formatRubles(bonusAmountKopecks);

  async function handleClaim() {
    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch(
        `/api/journals/${encodeURIComponent(obligationId)}/claim-bonus`,
        { method: "POST" }
      );
      const data = (await resp.json().catch(() => ({}))) as {
        error?: string;
        claimedBy?: { id: string; name: string | null } | null;
        claimedAt?: string | null;
      };

      if (resp.ok) {
        router.push(`/mini/bonus/${encodeURIComponent(obligationId)}`);
        return;
      }

      if (resp.status === 409) {
        setClaimedByName(data.claimedBy?.name ?? "другой сотрудник");
        setClaimedAt(data.claimedAt ?? new Date().toISOString());
        return;
      }

      setError(data.error ?? `HTTP ${resp.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Сетевая ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="mini-card flex items-stretch gap-3 px-3.5 py-3.5"
      style={{
        border: "1px solid rgba(200,255,90,0.32)",
        background:
          "linear-gradient(180deg, rgba(200,255,90,0.08) 0%, rgba(200,255,90,0.02) 100%)",
      }}
    >
      {typeof index === "number" ? (
        <div
          className="flex w-6 shrink-0 items-start pt-0.5"
          style={{
            fontFamily: "var(--mini-font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            color: "var(--mini-lime)",
          }}
        >
          {String(index).padStart(2, "0")}
        </div>
      ) : null}

      <div className="min-w-0 flex-1 space-y-2 py-0.5">
        <div className="flex items-center gap-2">
          <span
            className="mini-pill inline-flex items-center gap-1"
            data-tone="lime"
            style={{ paddingInline: 8 }}
          >
            <Coins className="size-3" strokeWidth={2.2} />
            +{amountRubles} ₽
          </span>
          <span
            className="mini-mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              color: "var(--mini-text-faint)",
              textTransform: "uppercase",
            }}
          >
            премия
          </span>
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 15,
            fontWeight: 500,
            lineHeight: 1.25,
            color: "var(--mini-text)",
            letterSpacing: "-0.005em",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            className="line-clamp-2"
            style={{
              fontSize: 12,
              lineHeight: 1.35,
              color: "var(--mini-text-muted)",
            }}
          >
            {subtitle}
          </div>
        ) : null}

        {isClaimed ? (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] leading-4"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--mini-text-muted)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Lock className="size-3.5" strokeWidth={2} />
            <span>
              Уже взял{" "}
              <strong style={{ color: "var(--mini-text)" }}>
                {claimedByName?.trim() || "другой сотрудник"}
              </strong>
              {claimedAt ? ` в ${formatTimeRu(claimedAt)}` : ""}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClaim}
            disabled={submitting}
            className="mini-press inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold disabled:opacity-50"
            style={{
              background: "var(--mini-lime)",
              color: "var(--mini-bg)",
              boxShadow:
                "0 8px 24px -10px rgba(200,255,90,0.45), inset 0 -2px 0 rgba(0,0,0,0.06)",
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Захватываю…
              </>
            ) : (
              <>
                Взять с бонусом
                <ArrowUpRight className="size-4" strokeWidth={2.4} />
              </>
            )}
          </button>
        )}

        {error ? (
          <p
            className="text-[12px]"
            style={{ color: "var(--mini-crimson)" }}
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatRubles(kopecks: number): string {
  if (!Number.isFinite(kopecks) || kopecks <= 0) return "0";
  const rubles = kopecks / 100;
  return rubles
    .toLocaleString("ru-RU", {
      minimumFractionDigits: rubles % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })
    .replace(/ /g, " ");
}

function formatTimeRu(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
