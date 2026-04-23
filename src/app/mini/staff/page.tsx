"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { MiniCard } from "../_components/mini-card";

type Employee = {
  id: string;
  name: string;
  phone: string | null;
  positionTitle: string | null;
  telegramLinked: boolean;
  isActive: boolean;
};

type Position = {
  id: string;
  name: string;
  categoryKey: string;
};

type StaffData = {
  employees: Employee[];
  positions: Position[];
};

type LocalState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: StaffData }
  | { kind: "adding" };

export default function MiniStaffPage() {
  const { status } = useSession();
  const [state, setState] = useState<LocalState>({ kind: "loading" });
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadData();
  }, [status]);

  async function loadData() {
    try {
      const resp = await fetch("/api/mini/staff", { cache: "no-store" });
      if (!resp.ok) {
        const body = (await resp.json().catch(() => ({ error: "" }))) as {
          error?: string;
        };
        throw new Error(body.error || `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as StaffData;
      setState({ kind: "ready", data });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Ошибка загрузки",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      jobPositionId: fd.get("position") as string,
      fullName: fd.get("name") as string,
      phone: fd.get("phone") as string,
    };
    try {
      const resp = await fetch("/api/mini/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({ error: "" }))) as {
          error?: string;
        };
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      setShowForm(false);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setFormLoading(false);
    }
  }

  if (status !== "authenticated") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Загружаем…
      </div>
    );
  }

  if (state.kind === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Загружаем…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold">Ошибка</h1>
        <p className="text-sm text-red-500">{state.message}</p>
        <button
          onClick={() => loadData()}
          className="mt-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Повторить
        </button>
      </div>
    );
  }

  if (state.kind !== "ready") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
        Загружаем…
      </div>
    );
  }

  const { employees, positions } = state.data;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-[22px] font-semibold text-slate-900">Сотрудники</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white"
        >
          {showForm ? "Отмена" : "+ Добавить"}
        </button>
      </header>

      {showForm ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <div>
            <label className="block text-[13px] font-medium text-slate-700">
              Должность
            </label>
            <select
              name="position"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] focus:border-slate-400 focus:outline-none"
            >
              <option value="">Выберите…</option>
              {positions.map((p: Position) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-slate-700">
              ФИО
            </label>
            <input
              name="name"
              required
              placeholder="Иванов Иван Иванович"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] focus:border-slate-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-slate-700">
              Телефон
            </label>
            <input
              name="phone"
              required
              placeholder="+7 985 123-45-67"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] focus:border-slate-400 focus:outline-none"
            />
          </div>
          {formError ? (
            <p className="text-[13px] text-red-500">{formError}</p>
          ) : null}
          <button
            type="submit"
            disabled={formLoading}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-[14px] font-medium text-white disabled:opacity-50"
          >
            {formLoading ? "Сохраняем…" : "Добавить сотрудника"}
          </button>
        </form>
      ) : null}

      <section className="space-y-2">
        {employees.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center text-[14px] text-slate-500">
            Пока нет сотрудников.
          </div>
        ) : (
          employees.map((emp: Employee) => (
            <div
              key={emp.id}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-[15px] font-medium text-slate-900">
                  {emp.name}
                </p>
                <p className="text-[13px] text-slate-500">
                  {emp.positionTitle || "—"}
                  {emp.phone ? ` · ${emp.phone}` : ""}
                </p>
              </div>
              {emp.telegramLinked ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  TG
                </span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Нет TG
                </span>
              )}
            </div>
          ))
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link
          href="/mini"
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-slate-500"
        >
          Главная
        </Link>
        <Link
          href="/mini/staff"
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-slate-900"
        >
          Сотрудники
        </Link>
        <Link
          href="/mini/me"
          className="flex flex-col items-center gap-0.5 text-[11px] font-medium text-slate-500"
        >
          Профиль
        </Link>
      </nav>
    </div>
  );
}
