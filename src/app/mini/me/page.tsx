"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { ArrowLeft, LogOut, Moon, Sun, Unlink } from "lucide-react";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { useMiniTheme } from "../_components/mini-theme";

/**
 * Profile screen for the Mini App.
 *
 * Read-only except for two destructive actions:
 *   - "Выйти" — drop the NextAuth session cookie; next /mini visit must
 *     re-verify initData. Useful when the bound employee changes devices.
 *   - "Отвязать Telegram" — also clears `User.telegramChatId` so even with
 *     valid initData on this device we no longer have a User mapping and
 *     the user must re-accept a fresh invite.
 */
export default function MiniMePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { theme, setTheme } = useMiniTheme();
  const [busy, setBusy] = useState<"none" | "signout" | "unlink">("none");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (
      status === "authenticated" &&
      !hasFullWorkspaceAccess(session.user)
    ) {
      router.replace("/mini");
    }
  }, [router, session, status]);

  if (status === "authenticated" && !hasFullWorkspaceAccess(session.user)) {
    return null;
  }

  if (status !== "authenticated") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Загружаем…
      </div>
    );
  }

  const u = session.user;

  async function handleUnlink() {
    setError(null);
    setBusy("unlink");
    try {
      const resp = await fetch("/api/mini/unlink-tg", { method: "POST" });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({ error: "" }))) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      await signOut({ redirect: false });
      window.location.href = "/mini";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отвязать");
      setBusy("none");
    }
  }

  async function handleSignOut() {
    setBusy("signout");
    await signOut({ redirect: false });
    window.location.href = "/mini";
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <Link
        href="/mini"
        className="mini-press inline-flex items-center gap-1 text-[13px] font-medium"
        style={{ color: "var(--mini-text-muted)" }}
      >
        <ArrowLeft className="size-4" />
        На главную
      </Link>

      <header className="px-1">
        <h1
          className="text-[22px] font-semibold"
          style={{ color: "var(--mini-text)" }}
        >
          Профиль
        </h1>
      </header>

      <section className="mini-card p-4">
        <dl className="space-y-3 text-[14px]">
          <div className="flex items-center justify-between gap-3">
            <dt style={{ color: "var(--mini-text-muted)" }}>Имя</dt>
            <dd
              className="font-medium"
              style={{ color: "var(--mini-text)" }}
            >
              {u.name || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt style={{ color: "var(--mini-text-muted)" }}>Организация</dt>
            <dd
              className="font-medium"
              style={{ color: "var(--mini-text)" }}
            >
              {u.organizationName || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt style={{ color: "var(--mini-text-muted)" }}>Роль</dt>
            <dd
              className="font-medium"
              style={{ color: "var(--mini-text)" }}
            >
              {u.role || "—"}
            </dd>
          </div>
          {u.email && !u.email.endsWith("@invite.local") ? (
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: "var(--mini-text-muted)" }}>Email</dt>
              <dd
                className="font-medium"
                style={{ color: "var(--mini-text)" }}
              >
                {u.email}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      {/* Theme toggle — сегментный переключатель «тёмная/светлая». */}
      <section className="mini-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div
              className="text-[14px] font-semibold"
              style={{ color: "var(--mini-text)" }}
            >
              Тема оформления
            </div>
            <div
              className="mt-0.5 text-[12px]"
              style={{ color: "var(--mini-text-muted)" }}
            >
              Настройка сохранится на этом устройстве
            </div>
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label="Тема Mini App"
          className="mini-press flex gap-1 rounded-2xl p-1"
          style={{
            background: "var(--mini-surface-2)",
            border: "1px solid var(--mini-divider)",
          }}
        >
          <button
            type="button"
            role="radio"
            aria-checked={theme === "dark"}
            onClick={() => setTheme("dark")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors"
            style={{
              background:
                theme === "dark" ? "var(--mini-text)" : "transparent",
              color:
                theme === "dark"
                  ? "var(--mini-bg)"
                  : "var(--mini-text-muted)",
            }}
          >
            <Moon className="size-4" />
            Тёмная
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={theme === "light"}
            onClick={() => setTheme("light")}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors"
            style={{
              background:
                theme === "light" ? "var(--mini-text)" : "transparent",
              color:
                theme === "light"
                  ? "var(--mini-bg)"
                  : "var(--mini-text-muted)",
            }}
          >
            <Sun className="size-4" />
            Светлая
          </button>
        </div>
      </section>

      {error ? (
        <div
          className="rounded-2xl p-3 text-[13px]"
          style={{
            background: "var(--mini-crimson-soft)",
            color: "var(--mini-crimson)",
            border: "1px solid var(--mini-divider)",
          }}
        >
          {error}
        </div>
      ) : null}

      <section className="space-y-2">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy !== "none"}
          className="mini-press flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[14px] font-medium disabled:opacity-50"
          style={{
            background: "var(--mini-card-solid-bg)",
            color: "var(--mini-text)",
            border: "1px solid var(--mini-divider)",
          }}
        >
          <span className="inline-flex items-center gap-2">
            <LogOut
              className="size-4"
              style={{ color: "var(--mini-text-muted)" }}
            />
            Выйти
          </span>
          <span
            className="text-[11px]"
            style={{ color: "var(--mini-text-faint)" }}
          >
            сессия сбросится
          </span>
        </button>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={busy !== "none"}
          className="mini-press flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left text-[14px] font-medium disabled:opacity-50"
          style={{
            background: "var(--mini-crimson-soft)",
            color: "var(--mini-crimson)",
            border: "1px solid var(--mini-divider)",
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Unlink className="size-4" />
            Отвязать Telegram
          </span>
          <span className="text-[11px] opacity-70">
            {busy === "unlink" ? "…" : "нужен новый инвайт"}
          </span>
        </button>
      </section>
    </div>
  );
}
