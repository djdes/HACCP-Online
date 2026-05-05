"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ListTree,
  Pin,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import type { PipelineNode, PipelineTree } from "@/lib/journal-pipeline-tree";

type FieldDef = { key: string; label: string };

type Props = {
  code: string;
  journalName: string;
  fields: FieldDef[];
  initialTree: PipelineTree | null;
};

function flattenTree(nodes: PipelineNode[]): PipelineNode[] {
  // root nodes first, then children grouped after their parent in DFS order
  const byParent = new Map<string | null, PipelineNode[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.ordering - b.ordering);
  }
  const result: PipelineNode[] = [];
  function walk(parentId: string | null) {
    for (const node of byParent.get(parentId) ?? []) {
      result.push(node);
      walk(node.id);
    }
  }
  walk(null);
  return result;
}

function depthOf(node: PipelineNode, all: PipelineNode[]): number {
  let depth = 0;
  let current: PipelineNode | undefined = node;
  while (current?.parentId) {
    current = all.find((n) => n.id === current!.parentId);
    if (!current) break;
    depth++;
    if (depth > 5) break;
  }
  return depth;
}

export function TreeEditorClient({
  code,
  journalName,
  fields,
  initialTree,
}: Props) {
  const router = useRouter();
  const [tree, setTree] = useState<PipelineTree | null>(initialTree);
  const [, startTransition] = useTransition();

  const [seedOpen, setSeedOpen] = useState(false);
  const [seedBusy, setSeedBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PipelineNode | null>(null);
  const [editingNode, setEditingNode] = useState<PipelineNode | null>(null);

  const flatNodes = useMemo(
    () => (tree?.nodes ? flattenTree(tree.nodes) : []),
    [tree?.nodes]
  );

  async function refresh() {
    const response = await fetch(
      `/api/settings/journal-pipelines/${code}`,
      { method: "GET", cache: "no-store" }
    );
    const data = (await response.json().catch(() => null)) as
      | { tree: PipelineTree | null }
      | null;
    if (data) setTree(data.tree);
    startTransition(() => router.refresh());
  }

  async function handleSeed() {
    setSeedBusy(true);
    try {
      const response = await fetch(
        `/api/settings/journal-pipelines/${code}/seed`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || "Не удалось создать pipeline");
        return;
      }
      setTree(data.tree);
      toast.success(
        `Создано pinned-узлов: ${data.created?.length ?? 0}`
      );
      setSeedOpen(false);
      startTransition(() => router.refresh());
    } finally {
      setSeedBusy(false);
    }
  }

  async function handleDelete(node: PipelineNode) {
    const response = await fetch(
      `/api/settings/journal-pipelines/${code}/nodes/${node.id}`,
      { method: "DELETE" }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.error || "Не удалось удалить узел");
      return;
    }
    setTree(data.tree);
    toast.success("Узел удалён");
    setConfirmDelete(null);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <Link
            href="/settings/journal-pipelines"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            К списку журналов
          </Link>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <ListTree className="size-6" />
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Pipeline (beta)
                </div>
                <h1 className="mt-1 text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                  {journalName}
                </h1>
                <p className="mt-2 max-w-[640px] text-[14px] text-white/70">
                  Дерево шагов, по которым будет вести сотрудника TasksFlow.
                  Pinned-узлы (📌) привязаны к колонкам журнала и заполняют
                  их автоматически. Custom-узлы (✏) — ваши инструкции и
                  подсказки.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {tree && tree.nodes.length > 0 ? (
                <Button
                  type="button"
                  onClick={() => {
                    setAddParentId(null);
                    setAddOpen(true);
                  }}
                  className="h-10 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] hover:bg-[#4a5bf0]"
                >
                  <Plus className="size-4" />
                  Добавить шаг
                </Button>
              ) : null}
              {tree && tree.nodes.some((n) => n.kind === "pinned") ? null : (
                <Button
                  type="button"
                  onClick={() => setSeedOpen(true)}
                  disabled={fields.length === 0}
                  className="h-10 rounded-2xl bg-white px-4 text-[14px] font-medium text-[#0b1024] hover:bg-white/90 disabled:bg-white/30"
                  title={
                    fields.length === 0
                      ? "У журнала нет описанных колонок"
                      : undefined
                  }
                >
                  <Sparkles className="size-4 text-[#5566f6]" />
                  Создать из колонок журнала
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {tree && tree.nodes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-5" />
          </div>
          <div className="mt-4 text-[15px] font-medium text-[#0b1024]">
            Pipeline ещё не настроен
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            Нажмите «Создать из колонок журнала» — мы автоматически
            создадим pinned-узел для каждой колонки. Потом можно добавить
            свои custom-шаги между ними.
          </p>
        </div>
      ) : tree === null ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <ListTree className="size-5" />
          </div>
          <div className="mt-4 text-[15px] font-medium text-[#0b1024]">
            Pipeline-шаблон ещё не создан
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            Запустите seed чтобы создать дерево по колонкам журнала, либо
            добавьте первый custom-шаг.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              onClick={() => setSeedOpen(true)}
              disabled={fields.length === 0}
              className="h-10 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] hover:bg-[#4a5bf0]"
            >
              <Sparkles className="size-4" />
              Создать из колонок
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddParentId(null);
                setAddOpen(true);
              }}
              className="h-10 rounded-2xl border-[#dcdfed] bg-white px-4 text-[14px] text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
            >
              <Plus className="size-4" />
              Добавить custom-шаг
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-[#ececf4] bg-white p-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-4">
          <ul className="space-y-2">
            {flatNodes.map((node, index) => {
              const depth = depthOf(node, flatNodes);
              const isPinned = node.kind === "pinned";
              return (
                <li
                  key={node.id}
                  className="rounded-2xl border border-[#ececf4] bg-white p-4 transition-colors hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
                  style={{ marginLeft: `${depth * 24}px` }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-semibold ${
                        isPinned
                          ? "bg-[#5566f6] text-white"
                          : "bg-[#eef1ff] text-[#3848c7]"
                      }`}
                    >
                      {isPinned ? <Pin className="size-4" /> : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-medium text-[#0b1024]">
                          {node.title || "(без названия)"}
                        </span>
                        {isPinned ? (
                          <span className="rounded-full bg-[#eef1ff] px-2.5 py-0.5 font-mono text-[11px] text-[#3848c7]">
                            {node.linkedFieldKey}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#fafbff] px-2.5 py-0.5 text-[11px] text-[#6f7282]">
                            custom
                          </span>
                        )}
                        {node.photoMode !== "none" ? (
                          <span className="rounded-full bg-[#fff4f2] px-2.5 py-0.5 text-[11px] text-[#a13a32]">
                            фото: {node.photoMode}
                          </span>
                        ) : null}
                        {node.requireComment ? (
                          <span className="rounded-full bg-[#fff4f2] px-2.5 py-0.5 text-[11px] text-[#a13a32]">
                            комментарий обязателен
                          </span>
                        ) : null}
                      </div>
                      {node.detail ? (
                        <p className="mt-1 line-clamp-2 text-[13px] text-[#6f7282]">
                          {node.detail}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Редактировать"
                        onClick={() => setEditingNode(node)}
                        className="h-8 rounded-xl px-2 text-[#6f7282] hover:bg-[#f5f6ff] hover:text-[#5566f6]"
                      >
                        <Settings2 className="size-4" />
                      </Button>
                      {!isPinned ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete(node)}
                          className="h-8 rounded-xl px-2 text-[#a13a32] hover:bg-[#fff4f2]"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <SeedConfirmDialog
        open={seedOpen}
        onOpenChange={setSeedOpen}
        fieldsCount={fields.length}
        onConfirm={handleSeed}
        busy={seedBusy}
      />

      <AddCustomDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        parentId={addParentId}
        code={code}
        onCreated={async () => {
          setAddOpen(false);
          await refresh();
        }}
      />

      <EditNodeDialog
        open={editingNode !== null}
        node={editingNode}
        code={code}
        onOpenChange={(value) => {
          if (!value) setEditingNode(null);
        }}
        onSaved={async () => {
          setEditingNode(null);
          await refresh();
        }}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        variant="danger"
        title="Удалить узел?"
        description={
          confirmDelete
            ? `«${confirmDelete.title}» и все его подузлы будут удалены.`
            : ""
        }
        confirmLabel="Удалить"
        onConfirm={async () => {
          if (confirmDelete) {
            await handleDelete(confirmDelete);
          }
        }}
      />
    </div>
  );
}

function SeedConfirmDialog({
  open,
  onOpenChange,
  fieldsCount,
  onConfirm,
  busy,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  fieldsCount: number;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <JournalSettingsModal
      open={open}
      onOpenChange={onOpenChange}
      title="Создать pipeline из колонок"
      description={`Будет создано ${fieldsCount} pinned-узлов — по одному на каждую колонку журнала. Потом их можно редактировать, добавлять custom-шаги и менять порядок.`}
      size="md"
      isSaving={busy}
      onSave={onConfirm}
      onCancel={() => onOpenChange(false)}
    >
      <div className="rounded-2xl border border-[#dcdfed] bg-[#fafbff] p-4 text-[13px] text-[#3c4053]">
        💡 Pinned-узлы — это шаги, которые автоматически заполнят колонки
        журнала, когда сотрудник дойдёт до них в TasksFlow. Они не
        удаляются (можно только редактировать или разделить).
      </div>
    </JournalSettingsModal>
  );
}

function AddCustomDialog({
  open,
  onOpenChange,
  parentId,
  code,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  parentId: string | null;
  code: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [photoRequired, setPhotoRequired] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/settings/journal-pipelines/${code}/nodes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId,
            title: title.trim(),
            detail: detail.trim() || null,
            photoMode: photoRequired ? "required" : "none",
          }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || "Не удалось создать узел");
        return;
      }
      toast.success("Узел добавлен");
      setTitle("");
      setDetail("");
      setPhotoRequired(false);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <JournalSettingsModal
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setTitle("");
          setDetail("");
          setPhotoRequired(false);
        }
        onOpenChange(value);
      }}
      title="Добавить custom-шаг"
      description="Шаг с произвольным названием — например, «Возьми ведро» или «Запиши номер партии». Не привязан к колонке журнала."
      size="md"
      isSaving={busy}
      saveDisabled={!title.trim()}
      onSave={handleSave}
      onCancel={() => onOpenChange(false)}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Название шага
          </Label>
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Возьми перчатки и ведро"
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Подробное описание (необязательно)
          </Label>
          <Textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Что именно сделать. Можно несколько строк."
            className="min-h-[120px] rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-4 py-3">
          <input
            type="checkbox"
            checked={photoRequired}
            onChange={(event) => setPhotoRequired(event.target.checked)}
            className="size-4 accent-[#5566f6]"
          />
          <div className="text-[13px] text-[#0b1024]">
            <div className="font-medium">Требовать фото</div>
            <div className="text-[12px] text-[#6f7282]">
              Сотрудник не сможет нажать «Сделал», пока не приложит
              фото на этом шаге.
            </div>
          </div>
        </label>
      </div>
    </JournalSettingsModal>
  );
}

function EditNodeDialog({
  open,
  node,
  code,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  node: PipelineNode | null;
  code: string;
  onOpenChange: (value: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [hint, setHint] = useState("");
  const [photoMode, setPhotoMode] = useState<
    "none" | "optional" | "required"
  >("none");
  const [requireComment, setRequireComment] = useState(false);
  const [requireSignature, setRequireSignature] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sync state with node when dialog opens.
  useNodeSync(node, open, (n) => {
    setTitle(n.title);
    setDetail(n.detail ?? "");
    setHint(n.hint ?? "");
    setPhotoMode(n.photoMode);
    setRequireComment(n.requireComment);
    setRequireSignature(n.requireSignature);
  });

  if (!node) return null;
  const isPinned = node.kind === "pinned";

  async function handleSave() {
    if (!title.trim() || !node) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/settings/journal-pipelines/${code}/nodes/${node.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            detail: detail.trim() || null,
            hint: hint.trim() || null,
            photoMode,
            requireComment,
            requireSignature,
          }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || "Не удалось сохранить узел");
        return;
      }
      toast.success("Узел сохранён");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <JournalSettingsModal
      open={open}
      onOpenChange={onOpenChange}
      title="Редактирование узла"
      description={
        isPinned
          ? `Pinned-шаг привязан к колонке журнала «${node.linkedFieldKey ?? ""}». Можно менять название и инструкцию, но удалить нельзя.`
          : "Custom-шаг — ваш произвольный шаг pipeline'а."
      }
      size="md"
      isSaving={busy}
      saveDisabled={!title.trim()}
      onSave={handleSave}
      onCancel={() => onOpenChange(false)}
    >
      <div className="space-y-5">
        {isPinned ? (
          <div className="rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-4 py-3 text-[13px] text-[#3c4053]">
            📌 <span className="font-medium">linkedFieldKey:</span>{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-[#3848c7]">
              {node.linkedFieldKey ?? "—"}
            </code>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Название шага
          </Label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Подробное описание
          </Label>
          <Textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Что именно сделать. Можно несколько строк."
            className="min-h-[120px] rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Подсказка (показывается мелким шрифтом)
          </Label>
          <Input
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            placeholder="Например: «См. фото в WhatsApp»"
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Фото-доказательство
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(["none", "optional", "required"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPhotoMode(mode)}
                className={`rounded-2xl border px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  photoMode === mode
                    ? "border-[#5566f6] bg-[#f5f6ff] text-[#3848c7]"
                    : "border-[#dcdfed] bg-white text-[#6f7282] hover:border-[#5566f6]/40"
                }`}
              >
                {mode === "none"
                  ? "Не нужно"
                  : mode === "optional"
                    ? "По желанию"
                    : "Обязательно"}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-4 py-3">
          <input
            type="checkbox"
            checked={requireComment}
            onChange={(event) => setRequireComment(event.target.checked)}
            className="size-4 accent-[#5566f6]"
          />
          <div className="text-[13px] text-[#0b1024]">
            <div className="font-medium">Требовать комментарий</div>
            <div className="text-[12px] text-[#6f7282]">
              Сотрудник должен написать текст перед «Сделал».
            </div>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-4 py-3">
          <input
            type="checkbox"
            checked={requireSignature}
            onChange={(event) => setRequireSignature(event.target.checked)}
            className="size-4 accent-[#5566f6]"
          />
          <div className="text-[13px] text-[#0b1024]">
            <div className="font-medium">Требовать подпись (ФИО)</div>
            <div className="text-[12px] text-[#6f7282]">
              Полезно для финальных шагов — сотрудник вводит ФИО.
            </div>
          </div>
        </label>
      </div>
    </JournalSettingsModal>
  );
}

/// Вытягивает поля узла в state редактора при каждом открытии.
/// Без него редактор покажет старые значения если открыть → закрыть → открыть.
function useNodeSync(
  node: PipelineNode | null,
  open: boolean,
  apply: (n: PipelineNode) => void
) {
  useEffect(() => {
    if (open && node) apply(node);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id]);
}

