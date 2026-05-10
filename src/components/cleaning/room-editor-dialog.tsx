"use client";

/**
 * Shared dialog для редактирования полной cleaning-конфигурации помещения:
 * name, kind, detergent, currentScope, generalScope, currentDays,
 * generalDays. Используется и в /settings/buildings (stage 3) и в журнале
 * уборки (stage 4 — там пока inline в cleaning-document-client.tsx;
 * можно мигрировать позже).
 *
 * Cleaning unification 2026-05-08, см.
 * docs/superpowers/specs/2026-05-08-cleaning-unification.md
 *
 * Сохранение делает PATCH /api/settings/rooms/[id]; этот же endpoint
 * автоматически синкает JournalChecklistItem (stage 6 hook).
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ScopeListEditor,
  WeekdayMaskPicker,
  MonthDaysPicker,
} from "@/components/cleaning/scope-and-schedule-editors";
import {
  parseScopeSteps,
  type ScopeStep,
} from "@/lib/cleaning-document";

const KIND_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "guest", label: "Гостевая зона" },
  { value: "kitchen", label: "Кухня / горячий цех" },
  { value: "wash", label: "Мойка" },
  { value: "bar", label: "Бар" },
  { value: "storage", label: "Склад" },
  { value: "other", label: "Другое" },
];

export type RoomEditorInitial = {
  id: string;
  name: string;
  kind: string;
  detergent: string;
  /**
   * Принимает либо legacy `string[]`, либо новый `ScopeStep[]` с per-step
   * requirePhoto. Внутри normalize'ится через parseScopeSteps.
   */
  currentScope: string[] | ScopeStep[];
  generalScope: string[] | ScopeStep[];
  currentDays: number;
  generalDays: number;
  // 2026-05-08+ rich schedule + photo
  currentScheduleType?: "weekly" | "monthly";
  generalScheduleType?: "weekly" | "monthly";
  currentMonthDays?: string[];
  generalMonthDays?: string[];
  requirePhoto?: boolean;
};

/**
 * Snapshot переданного на сервер patch'а — каллер использует его, чтобы
 * сразу пересчитать matrix/TF-задачи без ожидания router.refresh()
 * (который async и приходит на 1 render позже).
 */
export type RoomEditorSavedSnapshot = {
  id: string;
  name: string;
  detergent: string;
  currentScope: ScopeStep[];
  generalScope: ScopeStep[];
  currentDays: number;
  generalDays: number;
  currentScheduleType: "weekly" | "monthly";
  generalScheduleType: "weekly" | "monthly";
  currentMonthDays: string[];
  generalMonthDays: string[];
  requirePhoto: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: RoomEditorInitial | null;
  onSaved?: (snapshot: RoomEditorSavedSnapshot) => void;
};

export function RoomEditorDialog({ open, onOpenChange, initial, onSaved }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState(initial?.kind ?? "other");
  const [detergent, setDetergent] = useState(initial?.detergent ?? "");
  const [currentScope, setCurrentScope] = useState<ScopeStep[]>(
    parseScopeSteps(initial?.currentScope ?? []),
  );
  const [generalScope, setGeneralScope] = useState<ScopeStep[]>(
    parseScopeSteps(initial?.generalScope ?? []),
  );
  const [currentDays, setCurrentDays] = useState<number>(
    initial?.currentDays ?? 127,
  );
  const [generalDays, setGeneralDays] = useState<number>(
    initial?.generalDays ?? 0,
  );
  const [currentScheduleType, setCurrentScheduleType] = useState<
    "weekly" | "monthly"
  >(initial?.currentScheduleType ?? "weekly");
  const [generalScheduleType, setGeneralScheduleType] = useState<
    "weekly" | "monthly"
  >(initial?.generalScheduleType ?? "weekly");
  const [currentMonthDays, setCurrentMonthDays] = useState<string[]>(
    initial?.currentMonthDays ?? [],
  );
  const [generalMonthDays, setGeneralMonthDays] = useState<string[]>(
    initial?.generalMonthDays ?? [],
  );
  const [requirePhoto, setRequirePhoto] = useState<boolean>(
    initial?.requirePhoto ?? false,
  );
  const [saving, setSaving] = useState(false);

  // Reset form on initial change (when dialog re-opens for другое помещение)
  // Используем useEffect чтобы не тащить новый useId.
  useStateReset(initial?.id, () => {
    setName(initial?.name ?? "");
    setKind(initial?.kind ?? "other");
    setDetergent(initial?.detergent ?? "");
    setCurrentScope(parseScopeSteps(initial?.currentScope ?? []));
    setGeneralScope(parseScopeSteps(initial?.generalScope ?? []));
    setCurrentDays(initial?.currentDays ?? 127);
    setGeneralDays(initial?.generalDays ?? 0);
    setCurrentScheduleType(initial?.currentScheduleType ?? "weekly");
    setGeneralScheduleType(initial?.generalScheduleType ?? "weekly");
    setCurrentMonthDays(initial?.currentMonthDays ?? []);
    setGeneralMonthDays(initial?.generalMonthDays ?? []);
    setRequirePhoto(initial?.requirePhoto ?? false);
  });

  async function save() {
    if (!initial) return;
    if (!name.trim()) {
      toast.error("Название не может быть пустым");
      return;
    }
    setSaving(true);
    try {
      const sanitizeSteps = (steps: ScopeStep[]): ScopeStep[] =>
        steps
          .map((s) => {
            const trimmed = s.label.trim();
            const out: ScopeStep = { label: trimmed };
            if (typeof s.requirePhoto === "boolean")
              out.requirePhoto = s.requirePhoto;
            return out;
          })
          .filter((s) => s.label.length > 0);
      const res = await fetch(`/api/settings/rooms/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          detergent: detergent.trim(),
          currentScope: sanitizeSteps(currentScope),
          generalScope: sanitizeSteps(generalScope),
          currentDays,
          generalDays,
          currentScheduleType,
          generalScheduleType,
          currentMonthDays,
          generalMonthDays,
          requirePhoto,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      toast.success("Помещение сохранено");
      onOpenChange(false);
      onSaved?.({
        id: initial.id,
        name: name.trim(),
        detergent: detergent.trim(),
        currentScope: sanitizeSteps(currentScope),
        generalScope: sanitizeSteps(generalScope),
        currentDays,
        generalDays,
        currentScheduleType,
        generalScheduleType,
        currentMonthDays,
        generalMonthDays,
        requirePhoto,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden rounded-[24px] border-0 p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
            Редактирование помещения
          </DialogTitle>
        </DialogHeader>
        {initial ? (
          <>
            <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">
                  Название помещения
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Например: Горячий цех"
                  className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">Тип</Label>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                >
                  {KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-[#3c4053]">
                  Моющие и дезинфицирующие средства
                </Label>
                <Textarea
                  value={detergent}
                  onChange={(e) => setDetergent(e.target.value)}
                  placeholder="Например: Хлоргексидин 0,05% + Sanit"
                  className="rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px]"
                  rows={3}
                />
              </div>

              <label className="flex items-start gap-3 rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4 cursor-pointer transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]">
                <input
                  type="checkbox"
                  checked={requirePhoto}
                  onChange={(e) => setRequirePhoto(e.target.checked)}
                  className="mt-0.5 size-4 cursor-pointer accent-[#5566f6]"
                />
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-[#0b1024]">
                    📸 Требовать фото на каждом шаге
                  </div>
                  <p className="mt-0.5 text-[12px] leading-[1.55] text-[#6f7282]">
                    Когда включено, уборщица не сможет нажать «Сделал» в TasksFlow
                    без загрузки фотографии. Это превращает заполнение из «галочки»
                    в реальный evidence-trail для проверок РПН.
                  </p>
                </div>
              </label>

              <div className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-[13px] font-semibold text-[#0b1024]">
                      Текущая уборка
                    </Label>
                    <p className="mt-0.5 text-[12px] leading-[1.55] text-[#6f7282]">
                      Пошаговый чек-лист — каждый шаг станет подзадачей в TasksFlow.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-medium text-[#3848c7] tabular-nums">
                    {currentScope.filter((s) => s.label.trim()).length} шаг.
                  </span>
                </div>
                <ScopeListEditor
                  mode="with-photo"
                  value={currentScope}
                  onChange={setCurrentScope}
                  roomRequirePhoto={requirePhoto}
                  placeholder="Например: Протереть рабочие поверхности"
                  addLabel="Добавить шаг текущей уборки"
                  emptyHint="Шагов текущей уборки пока нет — добавьте первый шаг ниже."
                />
                <div className="space-y-2 border-t border-[#ececf4] pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[12px] font-medium text-[#3c4053]">
                      Когда проводить
                    </Label>
                    <div className="inline-flex rounded-xl border border-[#dcdfed] bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setCurrentScheduleType("weekly")}
                        className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
                          currentScheduleType === "weekly"
                            ? "bg-[#5566f6] text-white"
                            : "text-[#3c4053] hover:bg-[#f5f6ff]"
                        }`}
                      >
                        Каждую неделю
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentScheduleType("monthly")}
                        className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
                          currentScheduleType === "monthly"
                            ? "bg-[#5566f6] text-white"
                            : "text-[#3c4053] hover:bg-[#f5f6ff]"
                        }`}
                      >
                        По датам месяца
                      </button>
                    </div>
                  </div>
                  {currentScheduleType === "weekly" ? (
                    <>
                      <p className="text-[11px] leading-[1.45] text-[#6f7282]">
                        Уборка повторяется каждую неделю в выбранные дни.
                      </p>
                      <WeekdayMaskPicker
                        value={currentDays}
                        onChange={setCurrentDays}
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] leading-[1.45] text-[#6f7282]">
                        Выберите конкретные числа месяца. Подходит для нерегулярного
                        графика — например «1 и 15» или «последний день месяца».
                      </p>
                      <MonthDaysPicker
                        value={currentMonthDays}
                        onChange={setCurrentMonthDays}
                      />
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[#ececf4] bg-[#fafbff] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <Label className="text-[13px] font-semibold text-[#0b1024]">
                      Генеральная уборка
                    </Label>
                    <p className="mt-0.5 text-[12px] leading-[1.55] text-[#6f7282]">
                      Подробный список — что моется/дезинфицируется в день генеральной.
                    </p>
                  </div>
                  <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[11px] font-medium text-[#3848c7] tabular-nums">
                    {generalScope.filter((s) => s.label.trim()).length} шаг.
                  </span>
                </div>
                <ScopeListEditor
                  mode="with-photo"
                  value={generalScope}
                  onChange={setGeneralScope}
                  roomRequirePhoto={requirePhoto}
                  placeholder="Например: Демонтировать съёмные части и промыть"
                  addLabel="Добавить шаг генеральной уборки"
                  emptyHint="Шагов генеральной уборки пока нет — добавьте первый шаг ниже."
                />
                <div className="space-y-2 border-t border-[#ececf4] pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[12px] font-medium text-[#3c4053]">
                      Когда проводить
                    </Label>
                    <div className="inline-flex rounded-xl border border-[#dcdfed] bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setGeneralScheduleType("weekly")}
                        className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
                          generalScheduleType === "weekly"
                            ? "bg-[#5566f6] text-white"
                            : "text-[#3c4053] hover:bg-[#f5f6ff]"
                        }`}
                      >
                        Каждую неделю
                      </button>
                      <button
                        type="button"
                        onClick={() => setGeneralScheduleType("monthly")}
                        className={`rounded-lg px-3 py-1 text-[11px] font-medium transition-colors ${
                          generalScheduleType === "monthly"
                            ? "bg-[#5566f6] text-white"
                            : "text-[#3c4053] hover:bg-[#f5f6ff]"
                        }`}
                      >
                        По датам месяца
                      </button>
                    </div>
                  </div>
                  {generalScheduleType === "weekly" ? (
                    <>
                      <p className="text-[11px] leading-[1.45] text-[#6f7282]">
                        Обычно — раз в неделю. Например, только Сб или только Пн.
                      </p>
                      <WeekdayMaskPicker
                        value={generalDays}
                        onChange={setGeneralDays}
                      />
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] leading-[1.45] text-[#6f7282]">
                        Удобно для генералки «раз в месяц последнего числа» или
                        конкретных дат — выбери число и/или «Последний день месяца».
                      </p>
                      <MonthDaysPicker
                        value={generalMonthDays}
                        onChange={setGeneralMonthDays}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                className="h-11 w-full rounded-2xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                disabled={saving}
                className="h-11 w-full rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
                onClick={save}
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// Tiny helper — re-init local state when key changes.
import { useEffect, useRef } from "react";
function useStateReset(key: string | undefined, reset: () => void) {
  const last = useRef(key);
  useEffect(() => {
    if (last.current !== key) {
      last.current = key;
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
