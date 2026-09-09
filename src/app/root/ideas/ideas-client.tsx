"use client";

import { Lightbulb, Save, ThumbsUp, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IDEA_STATUSES, IDEA_STATUS_LABEL, type IdeaStatus } from "@/lib/ideas/rules";

type RootIdea = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  votes: number;
  adminNote: string | null;
  createdAt: string;
  statusChangedAt: string | null;
  organization: string;
  author: string;
};

const CARD = "rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]";
const INPUT =
  "h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15";

export function RootIdeasClient() {
  const [ideas, setIdeas] = useState<RootIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { status: IdeaStatus; adminNote: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<RootIdea | null>(null);

  async function remove() {
    if (!deleting) return;
    try {
      const response = await fetch(`/api/root/ideas/${deleting.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Не удалось удалить");
      toast.success("Идея удалена");
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/root/ideas");
      const data = (await response.json()) as { ideas: RootIdea[] };
      setIdeas(data.ideas ?? []);
      const next: Record<string, { status: IdeaStatus; adminNote: string }> = {};
      for (const idea of data.ideas ?? []) {
        next[idea.id] = { status: idea.status as IdeaStatus, adminNote: idea.adminNote ?? "" };
      }
      setDrafts(next);
    } catch {
      toast.error("Не удалось загрузить идеи");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(id: string) {
    const draft = drafts[id];
    if (!draft) return;
    setSaving(id);
    try {
      const response = await fetch(`/api/root/ideas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: draft.status, adminNote: draft.adminNote }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить");
      toast.success("Сохранено — автор получит уведомление, если статус изменился");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="text-[14px] text-[#6f7282]">Загружаем…</div>;
  if (ideas.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
        <div className="text-[15px] font-medium text-[#0b1024]">Идей пока нет</div>
        <p className="mx-auto mt-1.5 max-w-[360px] text-[13px] text-[#6f7282]">Клиенты предлагают их в разделе «Идеи» кабинета.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ideas.map((idea) => {
        const draft = drafts[idea.id] ?? { status: idea.status as IdeaStatus, adminNote: idea.adminNote ?? "" };
        const dirty = draft.status !== idea.status || draft.adminNote !== (idea.adminNote ?? "");
        return (
          <section key={idea.id} className={CARD} data-testid="root-idea">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-[#0b1024]">
                  <Lightbulb className="size-4 shrink-0 text-[#5566f6]" />
                  <span className="min-w-0">{idea.title}</span>
                </div>
                {idea.description ? (
                  <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-[#3c4053]">{idea.description}</p>
                ) : null}
                <div className="mt-2 text-[12px] text-[#6f7282]">
                  {idea.organization} · {idea.author} · {new Date(idea.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f5f6ff] px-3 py-1 text-[13px] font-medium tabular-nums text-[#3848c7]">
                <ThumbsUp className="size-3.5" />
                {idea.votes}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr_auto]">
              <select
                value={draft.status}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [idea.id]: { ...draft, status: e.target.value as IdeaStatus } }))}
                className={INPUT}
                aria-label="Статус идеи"
              >
                {IDEA_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {IDEA_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
              <input
                value={draft.adminNote}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [idea.id]: { ...draft, adminNote: e.target.value } }))}
                placeholder="Комментарий клиентам: почему, когда, где искать"
                className={INPUT}
                aria-label="Комментарий"
              />
              <button
                type="button"
                onClick={() => void save(idea.id)}
                disabled={!dirty || saving === idea.id}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
              >
                <Save className="size-4" />
                {saving === idea.id ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setDeleting(idea)}
                className="inline-flex h-9 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-medium text-[#a13a32] transition-colors hover:bg-[#fff4f2]"
              >
                <Trash2 className="size-4" />
                Удалить
              </button>
            </div>
          </section>
        );
      })}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        variant="danger"
        title="Удалить идею?"
        description={deleting ? `«${deleting.title}» исчезнет у всех клиентов вместе с голосами.` : ""}
        bullets={[{ label: "Голоса удаляются вместе с идеей" }, { label: "Автору уведомление не уходит" }]}
        confirmLabel="Удалить"
        onConfirm={remove}
      />
    </div>
  );
}
