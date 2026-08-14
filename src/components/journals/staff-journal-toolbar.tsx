"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ChevronDown, Copy, Plus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DocumentCloseButton,
  useDocumentCloseAction,
} from "@/components/journals/document-close-button";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_AUTOFILL_STRIP_CLASS,
  DOC_BODY_STACK_CLASS,
  DOC_TITLE_ROW_NO_STRIP_CLASS,
  DOC_HEADING_CLASS,
  DOC_TITLE_ROW_CLASS,
  DOC_AUTOFILL_LABEL_CLASS,
} from "@/components/journals/journal-responsive";
import { useCopyYesterdayAction } from "@/components/journals/copy-yesterday-button";
import {
  getHygienePositionLabel,
  getStaffJournalResponsibleTitleOptions,
} from "@/lib/hygiene-document";
import { getUserPositionLabel, getUsersForRoleLabel } from "@/lib/user-roles";

import { toast } from "sonner";
import {
  PositionEmployeePicker,
  PositionSelectItems,
} from "@/components/shared/position-select";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { ControlPeriodicityField } from "@/components/journals/control-periodicity-field";
type UserItem = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  documentId: string;
  heading: string;
  title: string;
  status: string;
  autoFill: boolean;
  responsibleTitle: string | null;
  responsibleUserId?: string | null;
  users: UserItem[];
  includedEmployeeIds: string[];
  routeCode?: string;
  organizationName?: string;
  /**
   * Текст «Периодичность контроля» из `config.controlPeriodicity`
   * (или дефолт шаблона). Редактируется в «Настройках журнала».
   */
  controlPeriodicity?: string;
  showHeaderActions?: boolean;
  hideHeading?: boolean;
  hidePrint?: boolean;
  hideAutoFill?: boolean;
  onSettingsClick?: () => void;
  /**
   * Design v2 toggle — модалка «Настройки журнала» рендерится через
   * `<JournalSettingsModal>` вместо собственного Dialog. Действия
   * не меняются, только обёртка. См. docs/PIPELINE-VISION.md P3.
   */
  useV2?: boolean;
};

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (result && typeof result.error === "string" && result.error) ||
        "Операция не выполнена"
    );
  }
  return result;
}

function AddEmployeeDialog({
  open,
  onOpenChange,
  users,
  includedEmployeeIds,
  documentId,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  users: UserItem[];
  includedEmployeeIds: string[];
  documentId: string;
}) {
  const router = useRouter();
  const [pick, setPick] = useState<{ positionTitle: string; userId: string }>({
    positionTitle: "",
    userId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  /**
   * Кандидаты = сотрудники организации, которых ЕЩЁ НЕТ в документе.
   * Раньше в каскад «Должность → Сотрудник» передавался тот же список,
   * но должности строились по нему же, поэтому при полностью заполненном
   * журнале выбор должности «просто не работал»: должность выбиралась,
   * а список сотрудников был пуст без единого слова объяснения.
   */
  const availableUsers = useMemo(
    () => users.filter((user) => !includedEmployeeIds.includes(user.id)),
    [includedEmployeeIds, users]
  );
  const allAlreadyAdded = users.length > 0 && availableUsers.length === 0;
  /**
   * Есть ли ещё кандидаты на ВЫБРАННОЙ должности. Нужен отдельно от
   * `availableUsers`, потому что должности берутся из полного списка
   * `users` — иначе после добавления последнего повара сама должность
   * «Повар» исчезала бы из селекта, и владелец думал, что её удалили.
   */
  const positionHasCandidates = useMemo(() => {
    if (!pick.positionTitle) return true;
    return availableUsers.some(
      (user) => getUserPositionLabel(user) === pick.positionTitle
    );
  }, [availableUsers, pick.positionTitle]);

  useEffect(() => {
    if (!open) return;
    setPick({ positionTitle: "", userId: "" });
  }, [open]);

  async function handleSubmit() {
    if (!pick.userId) return;

    setIsSubmitting(true);
    try {
      await requestJson(`/api/journal-documents/${documentId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_employee",
          employeeId: pick.userId,
        }),
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка добавления сотрудника");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-0 sm:max-w-[670px]">
        <DialogHeader className="border-b px-5 py-6 sm:px-10 sm:py-8">
          <DialogTitle className="text-[30px] font-medium text-black">
            Добавление новой строки
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 px-5 py-6 sm:px-10 sm:py-8">
          {allAlreadyAdded ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] px-5 py-4">
                <div className="text-[15px] font-semibold text-[#0b1024]">
                  Все сотрудники уже добавлены в журнал
                </div>
                <p className="mt-1.5 text-[13.5px] leading-[1.45] text-[#6f7282]">
                  В документе уже {users.length}{" "}
                  {users.length === 1 ? "строка" : "строк"} — по одной на каждого
                  активного сотрудника организации. Чтобы добавить кого-то ещё,
                  сначала заведите сотрудника в «Настройки → Сотрудники».
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="h-10 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
                >
                  Закрыть
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[15px] text-[#3c4053]">
                Выберите соответствующую должность и сотрудника.
              </p>
              <PositionEmployeePicker
                users={availableUsers}
                positionUsers={users}
                value={pick}
                onChange={setPick}
                disabled={availableUsers.length === 0}
                emptyEmployeeHint="Все сотрудники этой должности уже в журнале — выберите другую должность."
                triggerClassName="h-9 rounded-xl border-[#dfe1ec] bg-[#f3f4fb] px-3.5 text-[13.5px]"
              />
              {!positionHasCandidates ? (
                <div className="rounded-xl border border-[#ffe6c9] bg-[#fff8ee] px-4 py-3 text-[13px] leading-[1.45] text-[#8a5a12]">
                  Все сотрудники этой должности уже в журнале — выберите другую
                  должность.
                </div>
              ) : null}
              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !pick.userId}
                  className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white transition-colors duration-150 hover:bg-[#4b57ff]"
                >
                  {isSubmitting ? "Добавление..." : "Добавить"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FillFromStaffDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  users,
  includedEmployeeIds,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  documentId: string;
  documentTitle: string;
  users: UserItem[];
  includedEmployeeIds: string[];
}) {
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Счётчик «сколько ещё не в журнале» по каждой категории. Раньше пункты
   * были просто «Руководство — Повар», и владелец не понимал, почему кнопка
   * «Добавить» ничего не делает: все кандидаты уже были в документе.
   */
  const remainingByCategory = useMemo(() => {
    const map = new Map<string, number>();
    const pending = users.filter((user) => !includedEmployeeIds.includes(user.id));
    map.set("all", pending.length);
    pending.forEach((user) => {
      const key = `role:${user.role}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [includedEmployeeIds, users]);

  const roleOptions = useMemo(() => {
    const roles = [...new Set(users.map((user) => user.role))];
    const items = [{ value: "all", label: "Добавить всех" }];

    roles.forEach((role) => {
      const prefix = role === "owner" ? "Руководство" : "Сотрудники";
      items.push({
        value: `role:${role}`,
        label: `${prefix} — ${getHygienePositionLabel(role)}`,
      });
    });

    return items.map((item) => ({
      ...item,
      label: `${item.label} (${remainingByCategory.get(item.value) ?? 0})`,
    }));
  }, [remainingByCategory, users]);

  const remainingCount = useMemo(() => {
    if (category === "all") {
      return users.filter((user) => !includedEmployeeIds.includes(user.id)).length;
    }

    const role = category.replace("role:", "");
    return users.filter(
      (user) => user.role === role && !includedEmployeeIds.includes(user.id)
    ).length;
  }, [category, includedEmployeeIds, users]);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await requestJson(`/api/journal-documents/${documentId}/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fill_from_list",
          category,
        }),
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка заполнения из списка");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-0 sm:max-w-[690px]">
        <DialogHeader className="border-b px-5 py-6 sm:px-10 sm:py-8">
          <DialogTitle className="text-[22px] font-medium leading-[1.2] text-black">
            Заполнение документа:
            <br />
            &quot;{documentTitle}&quot;
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6 px-5 py-6 sm:px-10 sm:py-8">
          <div className="text-[18px] text-black">Добавить из категории:</div>
          <div className="space-y-3">
            <Label className="text-[14px] text-[#73738a]">Должность</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-10 rounded-xl border-[#dfe1ec] bg-[#f3f4fb] px-3.5 text-[13.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {remainingCount > 0 ? (
            <div className="rounded-xl border border-[#e2e6ff] bg-[#f7f8ff] px-4 py-3 text-[13.5px] leading-[1.45] text-[#3848c7]">
              Будет добавлено: {remainingCount}{" "}
              {remainingCount === 1
                ? "новый сотрудник"
                : remainingCount < 5
                  ? "новых сотрудника"
                  : "новых сотрудников"}
              . Уже добавленные строки не дублируются.
            </div>
          ) : (
            <div className="rounded-xl border border-[#ffe6c9] bg-[#fff8ee] px-4 py-3 text-[13.5px] leading-[1.45] text-[#8a5a12]">
              {category === "all"
                ? "Все сотрудники организации уже в журнале — добавлять некого."
                : "Все сотрудники этой должности уже в журнале — выберите другую категорию."}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || remainingCount === 0}
              title={
                remainingCount === 0
                  ? "Нет сотрудников для добавления — все уже в журнале"
                  : undefined
              }
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white transition-colors duration-150 hover:bg-[#4b57ff] disabled:opacity-50"
            >
              {isSubmitting ? "Добавление..." : "Добавить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JournalSettingsDialog({
  open,
  onOpenChange,
  documentId,
  title,
  responsibleTitle,
  responsibleUserId,
  users,
  controlPeriodicity = "",
  useV2 = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  documentId: string;
  title: string;
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  users: UserItem[];
  controlPeriodicity?: string;
  useV2?: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(title);
  const [responsible, setResponsible] = useState(responsibleTitle || "");
  const [responsibleUser, setResponsibleUser] = useState(responsibleUserId || "");
  const [periodicity, setPeriodicity] = useState(controlPeriodicity);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const options = useMemo(() => getStaffJournalResponsibleTitleOptions(users), [users]);

  useEffect(() => {
    if (!open) return;
    setName(title);
    setResponsible(responsibleTitle || options[0] || "");
    setResponsibleUser(responsibleUserId || "");
    setPeriodicity(controlPeriodicity);
  }, [
    controlPeriodicity,
    open,
    options,
    responsibleTitle,
    responsibleUserId,
    title,
  ]);

  async function handleSave() {
    setIsSubmitting(true);
    try {
      await requestJson(`/api/journal-documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: name.trim(),
          responsibleTitle: responsible,
          responsibleUserId: responsibleUser || null,
          controlPeriodicity: periodicity,
        }),
      });

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения настроек журнала");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (useV2) {
    return (
      <JournalSettingsModal
        open={open}
        onOpenChange={onOpenChange}
        title="Настройки журнала"
        description="Название журнала и ответственный сотрудник. Применяется ко всему периоду документа."
        size="md"
        isSaving={isSubmitting}
        onSave={handleSave}
        onCancel={() => onOpenChange(false)}
      >
        <div className="space-y-2">
          <Label
            htmlFor="journal-title-v2"
            className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]"
          >
            Название документа
          </Label>
          <Input
            id="journal-title-v2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Введите название документа"
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Должность ответственного
          </Label>
          <Select
            value={responsible}
            onValueChange={(value) => {
              setResponsible(value);
              const candidates = getUsersForRoleLabel(users, value);
              if (responsibleUser && !candidates.some((u) => u.id === responsibleUser)) {
                setResponsibleUser(candidates[0]?.id || "");
              } else if (!responsibleUser && candidates[0]) {
                setResponsibleUser(candidates[0].id);
              }
            }}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              <PositionSelectItems users={users} />
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Сотрудник
          </Label>
          <Select value={responsibleUser} onValueChange={setResponsibleUser}>
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              {(responsible ? getUsersForRoleLabel(users, responsible) : users).map(
                (user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <ControlPeriodicityField
          value={periodicity}
          onChange={setPeriodicity}
        />
      </JournalSettingsModal>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] rounded-[32px] border-0 p-0 sm:max-w-[765px]">
        <DialogHeader className="border-b px-14 py-12">
          <DialogTitle className="text-[22px] font-medium text-black">
            Настройки журнала
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-8 px-14 py-12">
          <div className="space-y-3">
            <Label htmlFor="journal-title" className="sr-only">
              Название документа
            </Label>
            <Input
              id="journal-title"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Введите название документа"
              className="h-22 rounded-3xl border-[#dfe1ec] px-8 text-[24px]"
            />
          </div>
          <div className="space-y-3">
            <Label className="text-[14px] text-[#73738a]">Должность ответственного</Label>
            <Select
              value={responsible}
              onValueChange={(value) => {
                setResponsible(value);
                const candidates = getUsersForRoleLabel(users, value);
                if (responsibleUser && !candidates.some((u) => u.id === responsibleUser)) {
                  setResponsibleUser(candidates[0]?.id || "");
                } else if (!responsibleUser && candidates[0]) {
                  setResponsibleUser(candidates[0].id);
                }
              }}
            >
              <SelectTrigger className="h-22 rounded-3xl border-[#dfe1ec] bg-[#f3f4fb] px-8 text-[24px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={users} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            <Label className="text-[14px] text-[#73738a]">Сотрудник</Label>
            <Select value={responsibleUser} onValueChange={setResponsibleUser}>
              <SelectTrigger className="h-22 rounded-3xl border-[#dfe1ec] bg-[#f3f4fb] px-8 text-[24px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                {(responsible
                  ? getUsersForRoleLabel(users, responsible)
                  : users
                ).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ControlPeriodicityField
            value={periodicity}
            onChange={setPeriodicity}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4b57ff]"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StaffJournalToolbar({
  documentId,
  heading,
  title,
  status,
  autoFill,
  responsibleTitle,
  responsibleUserId = null,
  users,
  includedEmployeeIds,
  routeCode,
  controlPeriodicity = "",
  showHeaderActions = false,
  hideHeading = false,
  hidePrint = false,
  hideAutoFill = false,
  onSettingsClick,
  useV2 = false,
}: Props) {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checked, setChecked] = useState(autoFill);
  const [isSwitching, setIsSwitching] = useState(false);
  const copyYesterday = useCopyYesterdayAction(documentId);
  const closeAction = useDocumentCloseAction({ documentId, title });

  useEffect(() => {
    setChecked(autoFill);
  }, [autoFill]);

  async function handleAutoFill(value: boolean) {
    const previous = checked;
    setChecked(value);
    setIsSwitching(true);

    try {
      await requestJson(`/api/journal-documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoFill: value }),
      });

      if (value) {
        await requestJson(`/api/journal-documents/${documentId}/staff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply_auto_fill" }),
        });
      }

      router.refresh();
    } catch (error) {
      setChecked(previous);
      toast.error(error instanceof Error ? error.message : "Ошибка автозаполнения");
    } finally {
      setIsSwitching(false);
    }
  }

  const headingNode = !hideHeading ? (
    <h1 className={DOC_HEADING_CLASS}>{heading}</h1>
  ) : null;

  return (
    <>
      <div className={DOC_BODY_STACK_CLASS}>
        {showHeaderActions && routeCode ? (
          <DocumentActionsBar
            // Q3: без полосы автозаполнения (журнал здоровья, закрытый
            // документ) H1 упирается прямо в бумажную шапку — эталонный
            // зазор там 28px, а не 20px «до полосы».
            className={
              hideAutoFill || status !== "active"
                ? DOC_TITLE_ROW_NO_STRIP_CLASS
                : undefined
            }
            backHref={`/journals/${routeCode}`}
            documentId={documentId}
            showPrint={!hidePrint}
            heading={headingNode}
            onSettings={
              status === "active"
                ? () => (onSettingsClick ? onSettingsClick() : setSettingsOpen(true))
                : undefined
            }
            menuItems={
              status === "active"
                ? [
                    {
                      key: "copy-yesterday",
                      label: "Скопировать вчерашнее",
                      icon: <Copy className="size-4" />,
                      title:
                        "Создать сегодняшние строки по вчерашним значениям — удобно, когда ничего не поменялось.",
                      onSelect: () => void copyYesterday.run(false),
                      disabled: copyYesterday.busy,
                    },
                    {
                      key: "close-journal",
                      label: "Закончить журнал",
                      icon: <Archive className="size-4" />,
                      onSelect: () => void closeAction.closeDocument(),
                      disabled: closeAction.isClosing,
                    },
                  ]
                : []
            }
          >
            {copyYesterday.dialog}
          </DocumentActionsBar>
        ) : null}

        {/* Fallback-раскладка для вызовов без `showHeaderActions`: у них нет
            <DocumentActionsBar>, поэтому H1 и кнопки рендерятся здесь — но в
            том же каноническом порядке «заголовок слева, действия справа». */}
        {!showHeaderActions ? (
          <div className={DOC_TITLE_ROW_CLASS}>
            {headingNode ?? <div />}
            {status === "active" && (
            <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              className="h-9 rounded-lg border-0 bg-[#5566f6]/[0.04] px-3.5 text-[14px] font-semibold text-[#5566f6] shadow-none hover:bg-[#5566f6]/[0.09]"
            >
              Настройки журнала
            </Button>
            <DocumentCloseButton
              documentId={documentId}
              title={title}
              variant="outline"
              className="h-9 rounded-lg border-0 bg-[#5566f6]/[0.04] px-3.5 text-[14px] font-semibold text-[#5566f6] shadow-none hover:bg-[#5566f6]/[0.09]"
            >
              Закончить журнал
            </DocumentCloseButton>
            </>
            )}
          </div>
        ) : null}

        {/* Полоса автозаполнения — сразу под строкой заголовка, как на
            эталоне (крошки → H1 → полоса → бумажная шапка). Кнопка
            «Добавить» здесь больше НЕ рендерится: её место — над таблицей
            (<StaffJournalAddButton>, см. hygiene/health-document-client). */}
        {status === "active" && !hideAutoFill ? (
          // H5/Q3 аудита: у эталона полоса — лента 48px, подпись 15px/600,
          // тумблер штатного размера (44×24), зазор до подписи 12px.
          // Вся геометрия живёт в DOC_AUTOFILL_STRIP_CLASS.
          <div className={DOC_AUTOFILL_STRIP_CLASS}>
            <Switch
              checked={checked}
              onCheckedChange={handleAutoFill}
              disabled={isSwitching}
              className="data-[state=unchecked]:bg-[#d6d9ee]"
            />
            <span className={DOC_AUTOFILL_LABEL_CLASS}>
              Автоматически заполнять журнал
            </span>
          </div>
        ) : null}
      </div>

      <JournalSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        documentId={documentId}
        title={title}
        responsibleTitle={responsibleTitle}
        responsibleUserId={responsibleUserId}
        users={users}
        controlPeriodicity={controlPeriodicity}
        useV2={useV2}
      />

    </>
  );
}

/**
 * Кнопка «Добавить ▾» гигиенического журнала / журнала здоровья.
 *
 * Раньше жила внутри <StaffJournalToolbar>, то есть в шапке страницы —
 * ВЫШЕ бумажной ХАССП-шапки. На эталоне (cleaning-04-grid.png) «Добавить»
 * стоит слева непосредственно НАД таблицей, под КАПС-заголовком, поэтому
 * кнопка вынесена в отдельный компонент со своим состоянием и диалогами:
 * host-клиент рендерит её ровно там, где нужно. Действия и диалоги
 * прежние — переехало только место рендера.
 */
export function StaffJournalAddButton({
  documentId,
  title,
  status,
  users,
  includedEmployeeIds,
  className,
}: {
  documentId: string;
  title: string;
  status: string;
  users: UserItem[];
  includedEmployeeIds: string[];
  className?: string;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [fillOpen, setFillOpen] = useState(false);

  if (status !== "active") return null;

  return (
    <div className={className ?? DOC_ADD_ROW_CLASS}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="h-11 w-fit gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white hover:bg-[#4a5bf0]">
            <Plus className="size-5" strokeWidth={2.5} />
            Добавить
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        {/* Размеры пунктов — как в остальных журналах (text-[14px] / py-2).
            Раньше здесь стояли text-[18px] + size-6 иконки в p-4 контейнере:
            дропдаун выглядел «огромным» на фоне соседних меню. */}
        <DropdownMenuContent
          align="start"
          className="max-w-[calc(100vw-1rem)] rounded-2xl border-0 p-1.5 shadow-xl sm:min-w-[280px]"
        >
          <DropdownMenuItem
            className="rounded-xl px-3 py-2 text-[14px] text-[#3848c7]"
            onSelect={() => setAddOpen(true)}
          >
            <UserPlus className="mr-2.5 size-4 text-[#3848c7]" />
            Добавить сотрудника
          </DropdownMenuItem>
          <DropdownMenuItem
            className="rounded-xl px-3 py-2 text-[14px] text-[#3848c7]"
            onSelect={() => setFillOpen(true)}
          >
            <Users className="mr-2.5 size-4 text-[#3848c7]" />
            Заполнить из списка сотрудников
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddEmployeeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        users={users}
        includedEmployeeIds={includedEmployeeIds}
        documentId={documentId}
      />

      <FillFromStaffDialog
        open={fillOpen}
        onOpenChange={setFillOpen}
        documentId={documentId}
        documentTitle={title}
        users={users}
        includedEmployeeIds={includedEmployeeIds}
      />
    </div>
  );
}
