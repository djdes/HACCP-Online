"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { openDocumentPdf } from "@/lib/open-document-pdf";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_BODY_STACK_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_EXTRA_BLOCK_CLASS,
  DOC_HEADING_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { useDocumentCloseAction } from "@/components/journals/document-close-button";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  MobileViewToggle,
  MobileViewTableWrapper,
} from "@/components/journals/mobile-view-toggle";
import {
  RecordCardsView,
  type RecordCardItem,
} from "@/components/journals/record-cards-view";
import {
  formatDateRu,
  formatTime,
  normalizeFryerOilEntryData,
  QUALITY_ASSESSMENT_TABLE,
  QUALITY_LABELS,
  type FryerOilDocumentConfig,
  type FryerOilEntryData,
  type FryerOilSelectLists,
} from "@/lib/fryer-oil-document";

import { toast } from "sonner";
import { confirmAsync } from "@/components/ui/confirm-async";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_VIEWPORT_CLASS,
} from "@/components/journals/journal-grid";

/**
 * ЭКРАН = WeSetup (мягкие серые рамки `#ececf4`, шапка `#f8f9fc`),
 * ПЕЧАТЬ (Ctrl+P) = «бумага» для инспектора РПН/СЭС (чёрные рамки,
 * белая шапка). Поэтому каждый токен несёт пару screen + `print:`.
 */
/** Скруглённый viewport вокруг таблицы; в печати — прозрачный wrapper. */

/** Общий вид триггера shadcn-селекта внутри форм журнала. */
const SELECT_TRIGGER_CLASS =
  "h-9 w-full rounded-xl border-[#dcdfed] bg-white px-3.5 text-[13.5px] text-[#0b1024] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15";
/**
 * `<SelectItem value="">` в Radix запрещён — пустая строка зарезервирована
 * под «ничего не выбрано». Пункт «— выберите —» несёт сентинел.
 */
const NONE_VALUE = "__none";
const fromNone = (value: string) => (value === NONE_VALUE ? "" : value);
const toNone = (value: string) => (value ? value : NONE_VALUE);
type UserItem = { id: string; name: string; role: string };
type EntryItem = { id: string; date: string; data: FryerOilEntryData };
type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  status: string;
  dateFrom: string;
  config: FryerOilDocumentConfig;
  users: UserItem[];
  initialEntries: EntryItem[];
  routeCode: string;
  /** Design v2 toggle. */
  useV2?: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const QUALITY_OPTIONS = [5, 4, 3, 2, 1] as const;

function sortEntries(items: EntryItem[]) {
  return [...items]
    .map((item) => ({ ...item, data: normalizeFryerOilEntryData(item.data) }))
    .sort((a, b) =>
      `${a.data.startDate}-${a.data.startHour}-${a.data.startMinute}`.localeCompare(
        `${b.data.startDate}-${b.data.startHour}-${b.data.startMinute}`
      )
    );
}

function EntryDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: FryerOilSelectLists;
  users: UserItem[];
  initialEntry: EntryItem | null;
  onSubmit: (payload: { id?: string; data: FryerOilEntryData }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const initial = props.initialEntry?.data
    ? normalizeFryerOilEntryData(props.initialEntry.data)
    : {
        ...normalizeFryerOilEntryData({}),
        startDate: new Date().toISOString().slice(0, 10),
        fatType: props.lists.fatTypes[0] ?? "",
        equipmentType: props.lists.equipmentTypes[0] ?? "",
        productType: props.lists.productTypes[0] ?? "",
        controllerName: props.users[0]?.name ?? "",
      };
  const [data, setData] = useState<FryerOilEntryData>(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await props.onSubmit({ id: props.initialEntry?.id, data });
      props.onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] max-h-[92vh] overflow-hidden rounded-[24px] border-0 p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
            {props.initialEntry ? "Редактирование записи" : "Добавление новой строки"}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(92vh-160px)] space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Дата и время начала</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_1fr]">
              <Input type="date" value={data.startDate} onChange={(e) => setData((v) => ({ ...v, startDate: e.target.value }))} className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" />
              <Select value={String(data.startHour).padStart(2, "0")} onValueChange={(value) => setData((d) => ({ ...d, startHour: Number(value) }))}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Час" /></SelectTrigger>
                <SelectContent>{HOURS.map((v) => <SelectItem key={v} value={v}>{v} ч</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(data.startMinute).padStart(2, "0")} onValueChange={(value) => setData((d) => ({ ...d, startMinute: Number(value) }))}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Мин" /></SelectTrigger>
                <SelectContent>{MINUTES.map((v) => <SelectItem key={v} value={v}>{v} мин</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Вид фритюрного жира</Label>
            <Select value={toNone(data.fatType)} onValueChange={(value) => setData((d) => ({ ...d, fatType: fromNone(value) }))}>
              <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="— выберите —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>— выберите —</SelectItem>
                {props.lists.fatTypes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Качество на начало</Label>
            <Select value={String(data.qualityStart)} onValueChange={(value) => setData((d) => ({ ...d, qualityStart: Number(value) }))}>
              <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="— выберите —" /></SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((v) => <SelectItem key={v} value={String(v)}>{v} - {QUALITY_LABELS[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Тип жарочного оборудования</Label>
              <Select value={toNone(data.equipmentType)} onValueChange={(value) => setData((d) => ({ ...d, equipmentType: fromNone(value) }))}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="— выберите —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— выберите —</SelectItem>
                  {props.lists.equipmentTypes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Вид продукции</Label>
              <Select value={toNone(data.productType)} onValueChange={(value) => setData((d) => ({ ...d, productType: fromNone(value) }))}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="— выберите —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>— выберите —</SelectItem>
                  {props.lists.productTypes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Время окончания</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select value={String(data.endHour).padStart(2, "0")} onValueChange={(value) => setData((d) => ({ ...d, endHour: Number(value) }))}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Час" /></SelectTrigger>
                <SelectContent>{HOURS.map((v) => <SelectItem key={v} value={v}>{v} ч</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(data.endMinute).padStart(2, "0")} onValueChange={(value) => setData((d) => ({ ...d, endMinute: Number(value) }))}>
                <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="Мин" /></SelectTrigger>
                <SelectContent>{MINUTES.map((v) => <SelectItem key={v} value={v}>{v} мин</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Качество на конец</Label>
            <Select value={String(data.qualityEnd)} onValueChange={(value) => setData((d) => ({ ...d, qualityEnd: Number(value) }))}>
              <SelectTrigger className={SELECT_TRIGGER_CLASS}><SelectValue placeholder="— выберите —" /></SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((v) => <SelectItem key={v} value={String(v)}>{v} - {QUALITY_LABELS[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Переходящий остаток, кг</Label>
              <Input type="number" min="0" step="0.01" value={String(data.carryoverKg)} onChange={(e) => setData((d) => ({ ...d, carryoverKg: Number(e.target.value) || 0 }))} className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Утилизированный, кг</Label>
              <Input type="number" min="0" step="0.01" value={String(data.disposedKg)} onChange={(e) => setData((d) => ({ ...d, disposedKg: Number(e.target.value) || 0 }))} className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Должность, ФИО контролера</Label>
            <Input value={data.controllerName} onChange={(e) => setData((d) => ({ ...d, controllerName: e.target.value }))} className="h-10 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]" />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {props.initialEntry && props.onDelete ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-xl border-[#ffd7d3] px-5 text-[14px] font-medium text-[#ff3b30] shadow-none hover:bg-[#fff4f2] sm:w-auto"
                onClick={() => { void props.onDelete?.(props.initialEntry!.id); props.onOpenChange(false); }}
              >
                Удалить
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full rounded-xl border-[#dcdfed] px-5 text-[14px] font-medium text-[#0b1024] shadow-none hover:bg-[#fafbff] sm:w-auto"
              onClick={() => props.onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              disabled={busy}
              className="h-10 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
              onClick={() => { void save(); }}
            >
              {busy ? "Сохранение..." : props.initialEntry ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListsDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; lists: FryerOilSelectLists; onSave: (lists: FryerOilSelectLists) => Promise<void> }) {
  const [lists, setLists] = useState(props.lists);
  const tabs: Array<[keyof FryerOilSelectLists, string]> = [["fatTypes", "Вид жира"], ["equipmentTypes", "Оборудование"], ["productTypes", "Вид продукции"]];
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-0 sm:max-w-[620px]">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-7 py-5">
          <DialogTitle className="text-[22px] font-semibold">Редактировать списки</DialogTitle>
          <button type="button" className="rounded-md p-1 hover:bg-black/5" onClick={() => props.onOpenChange(false)}><X className="size-6" /></button>
        </DialogHeader>
        <div className="px-7 py-6">
          <Tabs defaultValue="fatTypes">
            <TabsList className="mb-5 w-full">{tabs.map(([key, label]) => <TabsTrigger key={key} value={key} className="flex-1">{label}</TabsTrigger>)}</TabsList>
            {tabs.map(([key]) => (
              <TabsContent key={key} value={key} className="space-y-2">
                {lists[key].map((item, index) => (
                  <div key={`${key}:${index}`} className="flex items-center gap-2">
                    <Input value={item} onChange={(e) => setLists((v) => ({ ...v, [key]: v[key].map((x, i) => i === index ? e.target.value : x) }))} className="h-10 rounded-xl" />
                    <Button type="button" variant="outline" className="h-10 rounded-xl border-[#ffd7d3] text-[#ff3b30]" onClick={() => setLists((v) => ({ ...v, [key]: v[key].filter((_, i) => i !== index) }))}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => setLists((v) => ({ ...v, [key]: [...v[key], ""] }))}><Plus className="size-4" />Добавить</Button>
              </TabsContent>
            ))}
          </Tabs>
          <div className="mt-6 flex justify-end"><Button type="button" className="h-10 rounded-xl bg-[#5566f6] px-7 text-white" onClick={() => { void props.onSave(lists); props.onOpenChange(false); }}>Сохранить</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog(props: { open: boolean; onOpenChange: (open: boolean) => void; title: string; dateFrom: string; status: "active" | "closed"; onSave: (v: { title: string; dateFrom: string; status: "active" | "closed" }) => Promise<void>; useV2?: boolean }) {
  const [title, setTitle] = useState(props.title);
  const [dateFrom, setDateFrom] = useState(props.dateFrom);
  const [status, setStatus] = useState<"active" | "closed">(props.status);

  if (props.useV2) {
    return (
      <JournalSettingsModal
        open={props.open}
        onOpenChange={props.onOpenChange}
        title="Настройки журнала"
        description="Название журнала, дата начала и статус."
        size="md"
        onSave={async () => {
          await props.onSave({ title, dateFrom, status });
        }}
        onCancel={() => props.onOpenChange(false)}
      >
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Название документа
          </Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Дата начала
          </Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Статус документа
          </Label>
          <Select value={status} onValueChange={(v: "active" | "closed") => setStatus(v)}>
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Активный</SelectItem>
              <SelectItem value="closed">Закрытый</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </JournalSettingsModal>
    );
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-7 py-5">
          <DialogTitle className="text-[22px] font-semibold">Настройки журнала</DialogTitle>
          <button type="button" className="rounded-md p-1 hover:bg-black/5" onClick={() => props.onOpenChange(false)}><X className="size-6" /></button>
        </DialogHeader>
        <div className="space-y-4 px-7 py-6">
          <div className="space-y-1"><Label>Название документа</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1"><Label>Дата начала</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl" /></div>
          <div className="space-y-1"><Label>Статус документа</Label><Select value={status} onValueChange={(v: "active" | "closed") => setStatus(v)}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Активный</SelectItem><SelectItem value="closed">Закрытый</SelectItem></SelectContent></Select></div>
          <div className="flex justify-end"><Button type="button" className="h-10 rounded-xl bg-[#5566f6] px-7 text-white" onClick={() => { void props.onSave({ title, dateFrom, status }); props.onOpenChange(false); }}>Сохранить</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Appendix() {
  return (
    <div className="space-y-5 pt-8">
      <div className="text-[18px]">Приложение. Методика определения качества фритюрного жира.</div>
      <table className="w-full border-collapse text-[13px]"><thead><tr><th className={`${GRID_HEAD_CELL_CLASS} px-3 py-2`}>Показатели качества</th><th className={`${GRID_HEAD_CELL_CLASS} px-3 py-2`}>Отлично</th><th className={`${GRID_HEAD_CELL_CLASS} px-3 py-2`}>Хорошо</th><th className={`${GRID_HEAD_CELL_CLASS} px-3 py-2`}>Удовлетворительно</th><th className={`${GRID_HEAD_CELL_CLASS} px-3 py-2`}>Неудовлетворительно</th></tr></thead><tbody>{QUALITY_ASSESSMENT_TABLE.indicators.map((x) => <tr key={x.name}><td className={`${GRID_CELL_CLASS} px-3 py-2`}>{x.name}</td><td className={`${GRID_CELL_CLASS} px-3 py-2`}>{x.scores[5]}</td><td className={`${GRID_CELL_CLASS} px-3 py-2`}>{x.scores[4]}</td><td className={`${GRID_CELL_CLASS} px-3 py-2`}>{x.scores[3]}</td><td className={`${GRID_CELL_CLASS} px-3 py-2`}>{x.scores[2]}</td></tr>)}</tbody></table>
      <table className="w-full border-collapse text-[13px]"><thead><tr><th className={`${GRID_HEAD_CELL_CLASS} px-3 py-2`}>Качество фритюра</th><th className={`${GRID_HEAD_CELL_CLASS} px-3 py-2`}>Бальная оценка</th></tr></thead><tbody>{QUALITY_ASSESSMENT_TABLE.gradingTable.map((x) => <tr key={`${x.label}-${x.score}`}><td className={`${GRID_CELL_CLASS} px-3 py-2 text-center`}>{x.label}</td><td className={`${GRID_CELL_CLASS} px-3 py-2 text-center`}>{x.score}</td></tr>)}</tbody></table>
      <div className="text-[15px] leading-7">Пример расчета среднего балла: {QUALITY_ASSESSMENT_TABLE.formulaExample}</div>
    </div>
  );
}

export function FryerOilDocumentClient(props: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<EntryItem[]>(() => sortEntries(props.initialEntries));
  const [config, setConfig] = useState(props.config);
  const [title, setTitle] = useState(props.title);
  const [dateFrom, setDateFrom] = useState(props.dateFrom);
  const [status, setStatus] = useState<"active" | "closed">(props.status === "closed" ? "closed" : "active");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryItem, setEntryItem] = useState<EntryItem | null>(null);
  const [listsOpen, setListsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isActive = status === "active";
  const closeAction = useDocumentCloseAction({ documentId: props.documentId, title });
  const { mobileView, switchMobileView } = useMobileView("fryer_oil");

  const cardItems: RecordCardItem[] = entries.map((entry, index) => ({
    id: entry.id,
    title: `№${index + 1} · ${formatDateRu(entry.data.startDate)} ${formatTime(
      entry.data.startHour,
      entry.data.startMinute
    )}`,
    subtitle: entry.data.fatType || undefined,
    leading: isActive ? (
      <Checkbox
        checked={selectedIds.includes(entry.id)}
        onCheckedChange={() =>
          setSelectedIds((v) =>
            v.includes(entry.id) ? v.filter((x) => x !== entry.id) : [...v, entry.id]
          )
        }
        className="size-5"
      />
    ) : null,
    fields: [
      {
        label: "Оценка на начало",
        value: QUALITY_LABELS[entry.data.qualityStart] || entry.data.qualityStart,
        hideIfEmpty: true,
      },
      { label: "Оборудование", value: entry.data.equipmentType, hideIfEmpty: true },
      { label: "Продукция", value: entry.data.productType, hideIfEmpty: true },
      {
        label: "Окончание жарки",
        value: formatTime(entry.data.endHour, entry.data.endMinute),
      },
      {
        label: "Оценка по окончании",
        value: QUALITY_LABELS[entry.data.qualityEnd] || entry.data.qualityEnd,
        hideIfEmpty: true,
      },
      {
        label: "Переходящий остаток",
        value: entry.data.carryoverKg > 0 ? `${entry.data.carryoverKg} кг` : "",
        hideIfEmpty: true,
      },
      {
        label: "Утилизировано",
        value: entry.data.disposedKg > 0 ? `${entry.data.disposedKg} кг` : "",
        hideIfEmpty: true,
      },
      { label: "Контролер", value: entry.data.controllerName, hideIfEmpty: true },
    ],
    onClick: isActive
      ? () => {
          setEntryItem(entry);
          setEntryOpen(true);
        }
      : undefined,
    actions: isActive ? (
      <button
        type="button"
        onClick={() => {
          setEntryItem(entry);
          setEntryOpen(true);
        }}
        className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white hover:bg-[#4a5bf0]"
      >
        Редактировать
      </button>
    ) : null,
  }));

  async function saveEntry(payload: { id?: string; data: FryerOilEntryData }) {
    const response = await fetch(`/api/journal-documents/${props.documentId}/fryer-oil`, { method: payload.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.entry) throw new Error(result?.error || "Не удалось сохранить запись");
    const next = { id: result.entry.id, date: result.entry.date, data: normalizeFryerOilEntryData(result.entry.data) };
    setEntries((v) => sortEntries([...v.filter((x) => x.id !== next.id), next]));
  }

  async function deleteEntries(ids: string[]) {
    if (ids.length === 0) return;
    const response = await fetch(`/api/journal-documents/${props.documentId}/fryer-oil`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error || "Не удалось удалить записи");
    setEntries((v) => v.filter((x) => !ids.includes(x.id)));
    setSelectedIds((v) => v.filter((x) => !ids.includes(x)));
  }

  /** Удаление выбранных строк — confirm со счётчиком последствий. */
  async function confirmDeleteEntries() {
    if (selectedIds.length === 0) return;
    const fatTypes = Array.from(
      new Set(
        entries
          .filter((entry) => selectedIds.includes(entry.id))
          .map((entry) => entry.data.fatType)
          .filter(Boolean),
      ),
    );
    const confirmed = await confirmAsync({
      title: "Удалить выбранные строки?",
      description: "Записи об использовании фритюрных жиров будут удалены безвозвратно.",
      variant: "danger",
      confirmLabel: "Удалить",
      bullets: [
        { label: `Записей будет удалено: ${selectedIds.length}`, tone: "warn" },
        fatTypes.length > 0
          ? { label: `Виды жира: ${fatTypes.slice(0, 4).join(", ")}`, tone: "info" as const }
          : { label: "У выбранных записей не указан вид жира", tone: "info" as const },
        {
          label: `Останется записей: ${entries.length - selectedIds.length}`,
          tone: "default",
        },
      ],
    });
    if (!confirmed) return;
    await deleteEntries(selectedIds).catch((error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось удалить записи"),
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayFocusEntryId = entries.find((entry) => entry.data.startDate === todayKey)?.id;

  return (
    <div className="bg-white text-black">
      <FocusTodayScroller
        onCreate={
          isActive
            ? () => {
                setEntryItem(null);
                setEntryOpen(true);
              }
            : undefined
        }
      />
      <div className={`${DOC_BODY_STACK_CLASS} mx-auto max-w-[1880px] px-6 py-8`}>
        <DocumentActionsBar
          backHref={`/journals/${props.routeCode}`}
          documentId={props.documentId}
          heading={<h1 className={DOC_HEADING_CLASS}>{title}</h1>}
          onSettings={() => setSettingsOpen(true)}
          menuItems={
            isActive
              ? [
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
        />
        {!isActive ? (
          <div className="mb-5">
            <JournalClosedBanner hint="Верните журнал в активные, чтобы снова вносить записи об использовании фритюрных жиров." />
          </div>
        ) : null}

        <div className={GRID_VIEWPORT_CLASS}>
          <div className="min-w-[1400px]">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[240px_1fr_280px] border border-[#ececf4] print:border-black">
              <div className="flex min-h-[110px] items-center justify-center border-r border-[#ececf4] print:border-black px-6 text-center text-[15px]">{props.organizationName}</div>
              <div className="grid grid-rows-[55px_55px]"><div className="flex items-center justify-center border-b border-[#ececf4] print:border-black text-[20px] uppercase">Система ХАССП</div><div className="flex items-center justify-center text-[18px] italic uppercase">Журнал учета использования фритюрных жиров</div></div>
              <div className="grid grid-rows-[55px_55px] border-l border-[#ececf4] print:border-black"><div className="space-y-1 border-b border-[#ececf4] print:border-black px-6 py-3 text-[18px]"><div className="flex items-center justify-between"><span>Начат</span><span>{formatDateRu(dateFrom)}</span></div><div className="flex items-center justify-between"><span>Окончен</span><span>__________</span></div></div><div className="flex items-center justify-center text-[18px] uppercase">Стр. 1 из 1</div></div>
            </div>
            {/* Бумажная шапка → КАПС-заголовок 28px, заголовок → «Добавить» 20px. */}
            <div className={`mt-7 ${DOC_CAPS_TITLE_CLASS} text-center text-[26px] font-semibold uppercase`}>Журнал учета использования фритюрных жиров</div>
            {isActive ? <div className={DOC_ADD_ROW_CLASS}><Button type="button" className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white hover:bg-[#4a5bf0]" onClick={() => { setEntryItem(null); setEntryOpen(true); }} disabled={props.users.length === 0}><Plus className="size-5" strokeWidth={2.5} />Добавить</Button><Button type="button" variant="outline" className="h-10 rounded-lg border-0 bg-[#5566f6]/[0.04] px-3.5 text-[14px] font-semibold text-[#5566f6] shadow-none hover:bg-[#5566f6]/[0.09]" onClick={() => setListsOpen(true)}>Редактировать списки</Button>{selectedIds.length > 0 ? <Button type="button" variant="outline" className="h-10 rounded-xl border-[#ffd7d3] px-3.5 text-[#ff3b30]" onClick={() => void confirmDeleteEntries()}><Trash2 className="size-5" />Удалить</Button> : null}</div> : null}
            <div className="mb-4 sm:hidden print:hidden"><MobileViewToggle mobileView={mobileView} onChange={switchMobileView} /></div>
            {mobileView === "cards" ? <RecordCardsView items={cardItems} emptyLabel="Записей нет. Нажмите «Добавить»." /> : null}
            <MobileViewTableWrapper mobileView={mobileView}>
            <table className="w-full border-collapse text-[13px]">
              <thead><tr>{isActive ? <th rowSpan={2} className={`w-[52px] ${GRID_HEAD_CELL_CLASS} px-2 py-3 print:hidden`}><Checkbox checked={entries.length > 0 && selectedIds.length === entries.length} onCheckedChange={(checked) => setSelectedIds(checked === true ? entries.map((x) => x.id) : [])} disabled={entries.length === 0} /></th> : null}<th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Дата, время начала использования фритюрного жира</th><th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Вид фритюрного жира</th><th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Органолептическая оценка качества жира на начало жарки</th><th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Тип жарочного оборудования</th><th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Вид продукции</th><th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Время окончания фритюрной жарки</th><th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Органолептическая оценка качества жира по окончании жарки</th><th colSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Использование оставшегося жира</th><th rowSpan={2} className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Должность, ФИО контролера</th></tr><tr><th className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Переходящий остаток, кг</th><th className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5`}>Утилизированный, кг</th></tr></thead>
              <tbody>{entries.length === 0 ? <tr><td colSpan={isActive ? 11 : 10} className={`${GRID_CELL_CLASS} px-6 py-10 text-center text-[#6f7282]`}>Нет записей. Нажмите «Добавить», чтобы создать первую запись.</td></tr> : entries.map((entry) => <tr key={entry.id} data-focus-today={entry.id === todayFocusEntryId ? "" : undefined} className={`${selectedIds.includes(entry.id) ? "bg-[#f3f5ff]" : ""} ${isActive ? "cursor-pointer hover:bg-[#f5f6ff]" : ""}`} onClick={() => { if (!isActive) return; setEntryItem(entry); setEntryOpen(true); }}>{isActive ? <td className={`${GRID_CELL_CLASS} px-2 py-3 text-center print:hidden`} onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.includes(entry.id)} onCheckedChange={() => setSelectedIds((v) => v.includes(entry.id) ? v.filter((x) => x !== entry.id) : [...v, entry.id])} /></td> : null}<td className={`${GRID_CELL_CLASS} px-2 py-1.5`}><button type="button" className={`flex w-full items-start justify-between gap-3 text-left ${isActive ? "hover:text-[#3848c7]" : ""}`} onClick={(e) => { e.stopPropagation(); if (isActive) { setEntryItem(entry); setEntryOpen(true); } }} disabled={!isActive}>{formatDateRu(entry.data.startDate)} {formatTime(entry.data.startHour, entry.data.startMinute)}{isActive ? <Pencil className="mt-0.5 size-4 shrink-0 print:hidden" /> : null}</button></td><td className={`${GRID_CELL_CLASS} px-2 py-1.5`}>{entry.data.fatType || "-"}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5 text-center`}>{QUALITY_LABELS[entry.data.qualityStart] || entry.data.qualityStart}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5`}>{entry.data.equipmentType || "-"}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5`}>{entry.data.productType || "-"}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5 text-center`}>{formatTime(entry.data.endHour, entry.data.endMinute)}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5 text-center`}>{QUALITY_LABELS[entry.data.qualityEnd] || entry.data.qualityEnd}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5 text-center`}>{entry.data.carryoverKg > 0 ? entry.data.carryoverKg : ""}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5 text-center`}>{entry.data.disposedKg > 0 ? entry.data.disposedKg : ""}</td><td className={`${GRID_CELL_CLASS} px-2 py-1.5`}>{entry.data.controllerName || "-"}</td></tr>)}</tbody>
            </table>
            </MobileViewTableWrapper>
            <div className={DOC_EXTRA_BLOCK_CLASS}>
              <Appendix />
            </div>
          </div>
        </div>
      </div>

      <EntryDialog key={entryItem?.id ?? "new"} open={entryOpen} onOpenChange={(open) => { setEntryOpen(open); if (!open) setEntryItem(null); }} lists={config.lists} users={props.users} initialEntry={entryItem} onSubmit={async (payload) => { await saveEntry(payload); }} onDelete={isActive ? async (id) => { await deleteEntries([id]); } : undefined} />
      <ListsDialog key={JSON.stringify(config.lists)} open={listsOpen} onOpenChange={setListsOpen} lists={config.lists} onSave={async (lists) => { const nextConfig = { ...config, lists }; const response = await fetch(`/api/journal-documents/${props.documentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: nextConfig }) }); const result = await response.json().catch(() => null); if (!response.ok) throw new Error(result?.error || "Не удалось сохранить списки"); setConfig(nextConfig); router.refresh(); }} />
      <SettingsDialog key={`${title}-${dateFrom}-${status}`} open={settingsOpen} onOpenChange={setSettingsOpen} title={title} dateFrom={dateFrom} status={status} useV2={props.useV2} onSave={async (v) => { const response = await fetch(`/api/journal-documents/${props.documentId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: v.title, dateFrom: v.dateFrom, status: v.status }) }); const result = await response.json().catch(() => null); if (!response.ok) throw new Error(result?.error || "Не удалось сохранить настройки"); setTitle(v.title); setDateFrom(v.dateFrom); setStatus(v.status); router.refresh(); }} />
    </div>
  );
}
