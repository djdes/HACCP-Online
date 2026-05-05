"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  GripVertical,
  Image as ImageIcon,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import type { GuideNode, GuideTree } from "@/lib/journal-guide-tree";

type Props = {
  code: string;
  journalName: string;
  initialTree: GuideTree | null;
};

function flattenTree(nodes: GuideNode[]): GuideNode[] {
  const byParent = new Map<string | null, GuideNode[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.ordering - b.ordering);
  }
  const result: GuideNode[] = [];
  function walk(parentId: string | null) {
    for (const node of byParent.get(parentId) ?? []) {
      result.push(node);
      walk(node.id);
    }
  }
  walk(null);
  return result;
}

function depthOf(node: GuideNode, all: GuideNode[]): number {
  let depth = 0;
  let current: GuideNode | undefined = node;
  while (current?.parentId) {
    current = all.find((n) => n.id === current!.parentId);
    if (!current) break;
    depth++;
    if (depth > 5) break;
  }
  return depth;
}

export function GuideTreeEditorClient({
  code,
  journalName,
  initialTree,
}: Props) {
  const router = useRouter();
  const [tree, setTree] = useState<GuideTree | null>(initialTree);
  const [, startTransition] = useTransition();

  const [addOpen, setAddOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<GuideNode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<GuideNode | null>(null);

  const flatNodes = useMemo(
    () => (tree?.nodes ? flattenTree(tree.nodes) : []),
    [tree?.nodes]
  );

  async function refresh() {
    const response = await fetch(`/api/settings/journal-guides/${code}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = (await response.json().catch(() => null)) as
      | { tree: GuideTree | null }
      | null;
    if (data) setTree(data.tree);
    startTransition(() => router.refresh());
  }

  async function handleDelete(node: GuideNode) {
    const response = await fetch(
      `/api/settings/journal-guides/${code}/nodes/${node.id}`,
      { method: "DELETE" }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.error || "Не удалось удалить узел");
      return;
    }
    setTree(data.tree);
    toast.success("Шаг удалён");
    setConfirmDelete(null);
    startTransition(() => router.refresh());
  }

  function computeOrdering(
    siblings: GuideNode[],
    targetIndex: number
  ): number {
    const before = siblings[targetIndex - 1]?.ordering;
    const after = siblings[targetIndex]?.ordering;
    if (before === undefined && after === undefined) return 1024;
    if (before === undefined && after !== undefined) return after / 2;
    if (after === undefined && before !== undefined) return before + 1024;
    return ((before ?? 0) + (after ?? 0)) / 2;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !tree) return;
    const rootNodes = [...tree.nodes]
      .filter((n) => n.parentId === null)
      .sort((a, b) => a.ordering - b.ordering);
    const oldIndex = rootNodes.findIndex((n) => n.id === active.id);
    const newIndex = rootNodes.findIndex((n) => n.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(rootNodes, oldIndex, newIndex);
    const targetIndex = reordered.findIndex((n) => n.id === active.id);
    const newOrdering = computeOrdering(
      reordered.filter((n) => n.id !== active.id),
      targetIndex
    );
    const next = tree.nodes.map((n) =>
      n.id === active.id ? { ...n, ordering: newOrdering } : n
    );
    setTree({ ...tree, nodes: next });
    const response = await fetch(
      `/api/settings/journal-guides/${code}/nodes/${active.id}/move`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: null, ordering: newOrdering }),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      toast.error(data?.error || "Не удалось переместить узел");
      await refresh();
      return;
    }
    setTree(data.tree);
    startTransition(() => router.refresh());
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
                <BookOpen className="size-6" />
              </div>
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/50">
                  Гайд для сотрудника (beta)
                </div>
                <h1 className="mt-1 text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                  {journalName}
                </h1>
                <p className="mt-2 max-w-[640px] text-[14px] text-white/70">
                  Инструкция «как заполнять журнал», которую видит сотрудник
                  в FillingGuide-модалке. Не привязана к колонкам — это
                  справка/контекст. Можно вкладывать подсекции.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              className="h-10 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] hover:bg-[#4a5bf0]"
            >
              <Plus className="size-4" />
              Добавить шаг
            </Button>
          </div>
        </div>
      </section>

      {tree === null || tree.nodes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <BookOpen className="size-5" />
          </div>
          <div className="mt-4 text-[15px] font-medium text-[#0b1024]">
            Гайд ещё не настроен
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            Добавьте первый шаг — например, «Что должно быть в наличии»
            или «Как часто заполнять». Каждый шаг состоит из заголовка,
            пояснения и опционального фото.
          </p>
          <div className="mt-5 flex justify-center">
            <Button
              type="button"
              onClick={() => setAddOpen(true)}
              className="h-10 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] hover:bg-[#4a5bf0]"
            >
              <Plus className="size-4" />
              Добавить первый шаг
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-[#ececf4] bg-white p-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flatNodes.map((n) => n.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {flatNodes.map((node, index) => (
                  <SortableGuideRow
                    key={node.id}
                    node={node}
                    index={index}
                    depth={depthOf(node, flatNodes)}
                    onEdit={() => setEditingNode(node)}
                    onDelete={() => setConfirmDelete(node)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <p className="mt-3 px-1 text-[12px] text-[#9b9fb3]">
            💡 Перетаскивайте шаги за иконку <GripVertical className="inline size-3 align-text-bottom" /> чтобы изменить порядок.
          </p>
        </div>
      )}

      <AddGuideDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        code={code}
        onCreated={async () => {
          setAddOpen(false);
          await refresh();
        }}
      />

      <EditGuideDialog
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
        title="Удалить шаг?"
        description={
          confirmDelete
            ? `«${confirmDelete.title}» и его подшаги будут удалены.`
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

function SortableGuideRow({
  node,
  index,
  depth,
  onEdit,
  onDelete,
}: {
  node: GuideNode;
  index: number;
  depth: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: node.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    marginLeft: `${depth * 24}px`,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border bg-white p-4 transition-colors ${
        isDragging
          ? "border-[#5566f6] bg-[#f5f6ff] shadow-[0_16px_40px_-24px_rgba(85,102,246,0.55)]"
          : "border-[#ececf4] hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Перетащить"
          className="mt-0.5 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-[#9b9fb3] hover:bg-[#f5f6ff] hover:text-[#5566f6] active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[12px] font-semibold text-[#3848c7]">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-medium text-[#0b1024]">
              {node.title || "(без названия)"}
            </span>
            {node.photoUrl ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f6ff] px-2.5 py-0.5 text-[11px] text-[#3848c7]">
                <ImageIcon className="size-3" />
                фото
              </span>
            ) : null}
          </div>
          {node.detail ? (
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] text-[#6f7282]">
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
            onClick={onEdit}
            className="h-8 rounded-xl px-2 text-[#6f7282] hover:bg-[#f5f6ff] hover:text-[#5566f6]"
          >
            <Settings2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 rounded-xl px-2 text-[#a13a32] hover:bg-[#fff4f2]"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function AddGuideDialog({
  open,
  onOpenChange,
  code,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  code: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/settings/journal-guides/${code}/nodes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId: null,
            title: title.trim(),
            detail: detail.trim() || null,
            photoUrl: photoUrl.trim() || null,
          }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || "Не удалось добавить шаг");
        return;
      }
      toast.success("Шаг добавлен");
      setTitle("");
      setDetail("");
      setPhotoUrl("");
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
          setPhotoUrl("");
        }
        onOpenChange(value);
      }}
      title="Добавить шаг гайда"
      description="Шаг отображается сотруднику в инструкции «как заполнять журнал»."
      size="md"
      isSaving={busy}
      saveDisabled={!title.trim()}
      onSave={handleSave}
      onCancel={() => onOpenChange(false)}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Заголовок
          </Label>
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например: Когда заполнять"
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Описание (можно несколько строк)
          </Label>
          <Textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Например: «Сразу после смены, до конца дня. Если задержался — напиши причину в комментарии»"
            className="min-h-[140px] rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Ссылка на фото (опционально)
          </Label>
          <Input
            value={photoUrl}
            onChange={(event) => setPhotoUrl(event.target.value)}
            placeholder="https://..."
            type="url"
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
          <p className="text-[12px] text-[#9b9fb3]">
            Иллюстрация — например, «вот так выглядит правильно
            заполненная строка» или фото нужного оборудования.
          </p>
        </div>
      </div>
    </JournalSettingsModal>
  );
}

function EditGuideDialog({
  open,
  node,
  code,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  node: GuideNode | null;
  code: string;
  onOpenChange: (value: boolean) => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && node) {
      setTitle(node.title);
      setDetail(node.detail ?? "");
      setPhotoUrl(node.photoUrl ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node?.id]);

  if (!node) return null;

  async function handleSave() {
    if (!title.trim() || !node) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/settings/journal-guides/${code}/nodes/${node.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            detail: detail.trim() || null,
            photoUrl: photoUrl.trim() || null,
          }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error || "Не удалось сохранить шаг");
        return;
      }
      toast.success("Шаг сохранён");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <JournalSettingsModal
      open={open}
      onOpenChange={onOpenChange}
      title="Редактирование шага"
      description="Изменения видны сотруднику сразу после сохранения."
      size="md"
      isSaving={busy}
      saveDisabled={!title.trim()}
      onSave={handleSave}
      onCancel={() => onOpenChange(false)}
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Заголовок
          </Label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Описание
          </Label>
          <Textarea
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            className="min-h-[140px] rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Ссылка на фото
          </Label>
          <Input
            value={photoUrl}
            onChange={(event) => setPhotoUrl(event.target.value)}
            placeholder="https://..."
            type="url"
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
      </div>
    </JournalSettingsModal>
  );
}
