"use client";

import { useState } from "react";
import { Lock, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { btnPrimary, formatDateTime, readError, textareaClass } from "@/components/partner/ui";

export type ClientNote = { id: string; text: string; authorName: string; createdAt: string };

/**
 * Заметки партнёра о клиенте. Видны только команде партнёра — клиент их
 * не получает ни в интерфейсе, ни в письмах. Список живёт в состоянии,
 * чтобы добавление/удаление было мгновенным без перезагрузки.
 */
export function ClientNotes({ organizationId, initial }: { organizationId: string; initial: ClientNote[] }) {
  const [notes, setNotes] = useState(initial);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function add() {
    const value = text.trim();
    if (!value) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/partner/clients/${organizationId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Не удалось сохранить заметку"));
        return;
      }
      const data = (await res.json()) as { note: ClientNote };
      setNotes((prev) => [data.note, ...prev]);
      setText("");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/partner/notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(await readError(res, "Не удалось удалить"));
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-2xl bg-[#f5f6ff] px-3.5 py-2.5 text-[13px] leading-[1.5] text-[#3848c7]">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Заметки видит только ваша команда. Клиенту они недоступны.
      </div>

      <div>
        <textarea
          className={textareaClass}
          rows={3}
          maxLength={2000}
          placeholder="Например: договорились созвониться в пятницу, напомнить про медкнижки поваров"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void add();
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[12px] text-[#9b9fb3]">Ctrl+Enter — сохранить</span>
          <button type="button" className={btnPrimary} onClick={add} disabled={saving || !text.trim()}>
            <Send className="size-4" />
            {saving ? "Сохраняем…" : "Добавить заметку"}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-[14px] text-[#6f7282]">Заметок пока нет.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-2xl border border-[#ececf4] bg-white px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-wrap text-[14px] leading-[1.55] text-[#0b1024]">{n.text}</p>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  className="shrink-0 rounded-xl p-1.5 text-[#9b9fb3] opacity-0 transition-all duration-150 hover:bg-[#fff4f2] hover:text-[#a13a32] group-hover:opacity-100 focus-visible:opacity-100"
                  title="Удалить заметку"
                  aria-label="Удалить заметку"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-1.5 text-[12px] text-[#6f7282]">
                {n.authorName} · {formatDateTime(n.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
