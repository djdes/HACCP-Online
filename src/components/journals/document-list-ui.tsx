"use client";

import Link from "next/link";
import { Ellipsis, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { CreateDocumentDialog } from "@/components/journals/create-document-dialog";
import {
  JOURNAL_LIST_ACTIONS_CLASS,
  JOURNAL_LIST_HEADING_CLASS,
  JOURNAL_TAB_RAIL_CLASS,
  JOURNAL_TAB_VIEWPORT_CLASS,
} from "@/components/journals/journal-responsive";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FillGuideLauncher } from "@/components/journals/fill-guide-launcher";
import { TOUR } from "@/lib/tour-anchors";

export function JournalTopBar(props: {
  heading: string;
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  compact?: boolean;
  /**
   * Сколько документов уже есть на активной вкладке. Пока их ноль, кнопка
   * «Создать документ» в шапке не показывается — единственная точка входа
   * находится внутри карточки пустого состояния (эталон: fryer_oil-list.png,
   * cold_equipment_control-list.png). `undefined` ⇒ старое поведение.
   */
  documentCount?: number;
  /**
   * Код журнала в URL (`/journals/<code>`). Нужен «Инструкции», чтобы
   * открыть пожурнальный гайд, а не общий /sanpin. По умолчанию совпадает
   * с `templateCode`; передавайте явно там, где route ≠ template.
   */
  routeCode?: string;
  /**
   * Своя кнопка «Создать документ». Нужна журналам, которые создают
   * документ с преднастроенным `config` (disinfectant, accident,
   * breakdown-history) и потому не могут пользоваться общим
   * `<CreateDocumentDialog>`. Когда передан — рендерим его вместо
   * дефолтного диалога, всё остальное (заголовок, «Инструкция»,
   * respons-раскладка) остаётся общим.
   */
  createSlot?: React.ReactNode;
  /** uv_lamp_runtime: следующий свободный номер установки (U7 аудита). */
  nextLampNumber?: string;
  /**
   * Первый активный документ — «Как заполнить?» ведёт туда шаги «внутри
   * документа». Без него такие шаги показываются неактивными.
   */
  firstDocumentId?: string;
}) {
  return (
    // `sm:items-center` — когда длинный H1 («Журнал бракеража скоропортящейся
    // продукции») переносится в две строки, кнопки «Инструкция» / «Создать
    // документ» центрируются по высоте блока заголовка, а не липнут к первой
    // строке (P4 сводной таблицы аудита).
    <div className="flex flex-wrap items-start justify-between gap-4 sm:items-center">
      <h1 className={JOURNAL_LIST_HEADING_CLASS}>
        {props.heading}
      </h1>
      <div className={JOURNAL_LIST_ACTIONS_CLASS}>
        {/* Одна кнопка «Инструкция»: открывает окно с двумя вкладками —
            «Куда нажимать» (шаги по интерфейсу) и «Правила» (что и как
            проверять). Страница `/journals/<code>/guide` осталась —
            ссылка на неё внизу окна. */}
        <div className="flex w-full gap-2 sm:w-auto">
          <FillGuideLauncher
            code={props.templateCode}
            journalName={props.templateName}
            page="list"
            variant="button"
            firstDocumentId={props.firstDocumentId}
          />
        </div>
        {props.activeTab === "active" && props.documentCount !== 0 && props.createSlot}
        {props.activeTab === "active" && props.documentCount !== 0 && !props.createSlot && (
          <CreateDocumentDialog
            templateCode={props.templateCode}
            templateName={props.templateName}
            users={props.users}
            triggerClassName="h-11 w-full gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white hover:bg-[#4a5bf0] sm:w-auto"
            triggerLabel="Создать документ"
            triggerIcon={<Plus className="size-5" strokeWidth={2.5} />}
            nextLampNumber={props.nextLampNumber}
            triggerDataTour={TOUR.createDocument}
          />
        )}
      </div>
    </div>
  );
}

export function JournalTabs(props: {
  activeTab: "active" | "closed";
  templateCode: string;
  compact?: boolean;
}) {
  return (
    <div className={props.compact ?? true ? "border-b border-[#d9dce8]" : "border-b border-[#ececf4]"}>
      <div className={JOURNAL_TAB_VIEWPORT_CLASS}>
        <div className={JOURNAL_TAB_RAIL_CLASS}>
          <Link
            href={`/journals/${props.templateCode}`}
            className={`relative pb-5 ${
              props.activeTab === "active"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5566f6]"
                : "text-[#6f7282]"
            }`}
          >
            Активные
          </Link>
          <Link
            href={`/journals/${props.templateCode}?tab=closed`}
            className={`relative pb-5 ${
              props.activeTab === "closed"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5566f6]"
                : "text-[#6f7282]"
            }`}
          >
            Закрытые
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Пустое состояние списка документов — как на эталоне
 * (fryer_oil-list.png, cold_equipment_control-list.png): серая карточка по
 * центру, заголовок «Документ ещё не создан», пояснение и большая
 * primary-кнопка «Создать документ» ВНУТРИ карточки.
 *
 * Кнопка приходит слотом (`action`), поэтому открывает ровно тот же диалог
 * создания, что и кнопка в шапке страницы: у части журналов это общий
 * `<CreateDocumentDialog>`, у части — свой `createSlot`. Пока документов
 * нет, кнопка в шапке скрыта (см. `JournalTopBar.documentCount`) — точка
 * входа ровно одна.
 *
 * Онбординг-гейт «Шаг 1 / Шаг 2» (нет сотрудников) живёт внутри самого
 * диалога (`CreateDocumentEmptyState`) и остаётся приоритетнее: карточка
 * лишь открывает диалог, а он уже показывает инструкцию.
 */
export function EmptyDocumentsState({
  label,
  description,
  action,
  templateCode,
  templateName,
  users,
  nextLampNumber,
}: {
  label?: string;
  description?: string;
  /**
   * Готовая кнопка (журналы со своим диалогом создания). Если не передана,
   * но заданы `templateCode`/`templateName`/`users` — рисуем общий
   * `<CreateDocumentDialog>`, тот же самый, что стоял бы в шапке.
   */
  action?: React.ReactNode;
  templateCode?: string;
  templateName?: string;
  users?: { id: string; name: string; role: string }[];
  nextLampNumber?: string;
} = {}) {
  const button =
    action ??
    (templateCode && templateName && users ? (
      <CreateDocumentDialog
        templateCode={templateCode}
        templateName={templateName}
        users={users}
        triggerClassName={EMPTY_STATE_CREATE_BUTTON_CLASS}
        triggerLabel="Создать документ"
        triggerIcon={<Plus className="size-5" strokeWidth={2.5} />}
        nextLampNumber={nextLampNumber}
        triggerDataTour={TOUR.createDocument}
      />
    ) : null);

  return (
    <div className="rounded-2xl bg-[#f6f7fa] px-6 py-12 text-center sm:px-10 sm:py-14">
      <div className="text-[22px] font-bold tracking-[-0.02em] text-[#0b1024] sm:text-[26px]">
        {label ?? "Документ ещё не создан"}
      </div>
      <p className="mx-auto mt-3 max-w-[560px] text-[14px] leading-[1.5] text-[#6f7282]">
        {description ??
          "Нажмите на кнопку ниже, чтобы создать документ и начать фиксировать записи журнала — они понадобятся при проверке Роспотребнадзора."}
      </p>
      {button ? <div className="mt-7 flex justify-center">{button}</div> : null}
    </div>
  );
}

/** Кнопка «+ Создать документ» внутри карточки пустого состояния. */
export const EMPTY_STATE_CREATE_BUTTON_CLASS =
  "h-12 gap-2 rounded-lg bg-[#5566f6] px-6 text-[15px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors duration-150 hover:bg-[#4a5bf0] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15";

export function DocumentActionsMenu(props: {
  onEdit?: () => void;
  onPrint: () => void;
  onDelete?: () => void;
  size?: "sm" | "md";
}) {
  const md = (props.size ?? "md") === "md";
  const hasDelete = Boolean(props.onDelete);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full hover:bg-[#f5f6ff]"
        >
          <Ellipsis className="size-5 text-[#5566f6]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={
          md
            ? "w-[300px] rounded-[22px] border-0 p-3 shadow-xl"
            : "w-[260px] rounded-[20px] border-0 p-3 shadow-xl"
        }
      >
        {props.onEdit && (
          <DropdownMenuItem
            className={
              md
                ? "mb-3 h-9 rounded-xl px-3.5 text-[13.5px]"
                : "mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
            }
            onSelect={props.onEdit}
          >
            <Pencil className={md ? "mr-3 size-4 text-[#6f7282]" : "mr-3 size-4 text-[#6f7282]"} />
            Настройки
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className={
            md
              ? `${hasDelete ? "mb-3 " : ""}h-9 rounded-xl px-3.5 text-[13.5px]`
              : `${hasDelete ? "mb-2 " : ""}h-9 rounded-xl px-3.5 text-[13.5px]`
          }
          onSelect={props.onPrint}
        >
          <Printer className={md ? "mr-3 size-4 text-[#6f7282]" : "mr-3 size-4 text-[#6f7282]"} />
          Печать
        </DropdownMenuItem>
        {props.onDelete && (
          <DropdownMenuItem
            className={
              md
                ? "h-9 rounded-xl px-3.5 text-[13.5px] text-[#ff3b30] focus:text-[#ff3b30]"
                : "h-9 rounded-xl px-3.5 text-[13.5px] text-[#ff3b30] focus:text-[#ff3b30]"
            }
            onSelect={props.onDelete}
          >
            <Trash2 className={md ? "mr-3 size-4 text-[#ff3b30]" : "mr-3 size-4 text-[#ff3b30]"} />
            Удалить
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
