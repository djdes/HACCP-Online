"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type DocEntry = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  data: Record<string, unknown>;
};

type DocPayload = {
  document: {
    id: string;
    title: string;
    dateFrom: string;
    dateTo: string;
    status: string;
  };
  template: {
    code: string;
    name: string;
    fields: Array<{
      key: string;
      label: string;
      type: string;
      options?: Array<{ value: string; label: string }>;
    }>;
  };
  entries: DocEntry[];
};

export default function MiniDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [payload, setPayload] = useState<DocPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/mini/documents/${id}/entries`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load");
        setPayload(await res.json());
      } catch {
        setError("Не удалось загрузить документ");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function saveEntry(entryId: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/mini/documents/${id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: payload?.entries.find((e) => e.id === entryId)?.employeeId,
          date: payload?.entries.find((e) => e.id === entryId)?.date,
          data,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      // Refresh
      const refreshed = await fetch(`/api/mini/documents/${id}/entries`, {
        cache: "no-store",
      });
      if (refreshed.ok) setPayload(await refreshed.json());
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
  if (!payload) return null;

  const { document, template, entries } = payload;
  const fields = (template.fields ?? []).filter((f) => f.type !== "employee");

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <Link
        href={`/mini/journals/${template.code}`}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500"
      >
        <ArrowLeft className="size-4" />
        К журналу
      </Link>

      <header className="px-1">
        <h1 className="text-[20px] font-semibold text-slate-900">{document.title}</h1>
        <p className="mt-0.5 text-[13px] text-slate-500">
          {new Date(document.dateFrom).toLocaleDateString("ru-RU")} –{" "}
          {new Date(document.dateTo).toLocaleDateString("ru-RU")}
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">
          Пока нет записей.
        </div>
      ) : (
        <section className="space-y-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              fields={fields}
              onSave={(data) => saveEntry(entry.id, data)}
              saving={saving}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  fields,
  onSave,
  saving,
}: {
  entry: DocEntry;
  fields: Array<{ key: string; label: string; type: string; options?: Array<{ value: string; label: string }> }>;
  onSave: (data: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>(entry.data ?? {});

  const dateStr = new Date(entry.date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });

  if (!editMode) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 active:scale-[0.98]"
        onClick={() => setEditMode(true)}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-slate-900">
            {entry.employeeName}
          </span>
          <span className="text-[11px] text-slate-400">{dateStr}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {fields.map((f) => {
            const val = entry.data?.[f.key];
            if (val == null) return null;
            return (
              <span key={f.key} className="text-[12px] text-slate-500">
                {f.label}: {String(val)}
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-medium text-slate-900">
          {entry.employeeName} · {dateStr}
        </span>
        <button
          onClick={() => {
            setFormData(entry.data ?? {});
            setEditMode(false);
          }}
          className="text-[12px] text-slate-400"
        >
          Отмена
        </button>
      </div>
      <div className="space-y-2">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-[12px] font-medium text-slate-600">{f.label}</label>
            {f.type === "select" && f.options ? (
              <select
                value={String(formData[f.key] ?? "")}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, [f.key]: e.target.value }))
                }
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-[13px]"
              >
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "boolean" ? (
              <button
                onClick={() =>
                  setFormData((d) => ({ ...d, [f.key]: !Boolean(d[f.key]) }))
                }
                className={`mt-0.5 inline-flex rounded-lg px-3 py-1 text-[13px] font-medium ${
                  formData[f.key] ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                {formData[f.key] ? "Да" : "Нет"}
              </button>
            ) : (
              <input
                type={f.type === "number" ? "number" : "text"}
                value={String(formData[f.key] ?? "")}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                  }))
                }
                className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1 text-[13px]"
              />
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          onSave(formData);
          setEditMode(false);
        }}
        disabled={saving}
        className="mt-3 w-full rounded-xl bg-slate-900 py-2 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {saving ? "Сохраняем…" : "Сохранить"}
      </button>
    </div>
  );
}
