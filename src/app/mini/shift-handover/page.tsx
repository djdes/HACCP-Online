"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Shift = {
  id: string;
  user: { id: string; name: string };
  status: string;
  handoverNotes: string | null;
  handoverToId: string | null;
  handoverAt: string | null;
};

export default function MiniShiftHandoverPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/mini/shift-handover", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        setShifts(data.shifts ?? []);
      } catch {
        setError("Не удалось загрузить смены");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveHandover(shiftId: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/mini/shift-handover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId, notes }),
      });
      if (!res.ok) throw new Error("Failed");
      // Refresh
      const refreshed = await fetch("/api/mini/shift-handover", { cache: "no-store" });
      if (refreshed.ok) {
        const data = await refreshed.json();
        setShifts(data.shifts ?? []);
      }
      setEditShiftId(null);
      setNotes("");
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-center text-sm text-slate-500">Загружаем…</div>;
  if (error)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <Link href="/mini" className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500">
        <ArrowLeft className="size-4" />
        На главную
      </Link>

      <header className="px-1">
        <h1 className="text-[20px] font-semibold text-slate-900">Передача смен</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">{new Date().toLocaleDateString("ru-RU")}</p>
      </header>

      {shifts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">
          На сегодня смен не запланировано.
        </div>
      ) : (
        <section className="space-y-3">
          {shifts.map((shift) => (
            <div key={shift.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-medium text-slate-900">{shift.user.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    shift.status === "scheduled"
                      ? "bg-blue-100 text-blue-700"
                      : shift.status === "off"
                      ? "bg-slate-100 text-slate-500"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {shift.status}
                </span>
              </div>

              {shift.handoverNotes ? (
                <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
                  <span className="font-medium text-slate-500">Передано:</span>{" "}
                  {shift.handoverNotes}
                  {shift.handoverAt ? (
                    <div className="mt-1 text-[11px] text-slate-400">
                      {new Date(shift.handoverAt).toLocaleString("ru-RU")}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {editShiftId === shift.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Что нужно знать следующей смене?"
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[14px] focus:border-slate-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveHandover(shift.id)}
                      disabled={saving || !notes.trim()}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
                    >
                      {saving ? "Сохраняем…" : "Сохранить"}
                    </button>
                    <button
                      onClick={() => {
                        setEditShiftId(null);
                        setNotes("");
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-600"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setEditShiftId(shift.id);
                    setNotes(shift.handoverNotes ?? "");
                  }}
                  className="mt-2 text-[13px] font-medium text-slate-600 underline underline-offset-2"
                >
                  {shift.handoverNotes ? "Редактировать" : "Добавить примечание"}
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
