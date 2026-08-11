"use client";

import Link from "next/link";
import { BookOpenText, Ellipsis, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { CreateDocumentDialog } from "@/components/journals/create-document-dialog";
import {
  JOURNAL_LIST_ACTIONS_CLASS,
  JOURNAL_LIST_HEADING_CLASS,
  JOURNAL_TAB_RAIL_CLASS,
  JOURNAL_TAB_VIEWPORT_CLASS,
} from "@/components/journals/journal-responsive";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function JournalTopBar(props: {
  heading: string;
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  compact?: boolean;
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
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <h1 className={JOURNAL_LIST_HEADING_CLASS}>
        {props.heading}
      </h1>
      <div className={JOURNAL_LIST_ACTIONS_CLASS}>
        <Button
          variant="outline"
          className="h-9 w-full rounded-lg border-0 bg-[#5566f6]/[0.04] px-3.5 text-[14px] font-semibold text-[#5566f6] shadow-none hover:bg-[#5566f6]/[0.09] sm:w-auto"
          asChild
        >
          <Link href={`/journals/${props.routeCode ?? props.templateCode}/guide`}>
            <BookOpenText className="size-4" />
            Инструкция
          </Link>
        </Button>
        {props.activeTab === "active" && props.createSlot}
        {props.activeTab === "active" && !props.createSlot && (
          <CreateDocumentDialog
            templateCode={props.templateCode}
            templateName={props.templateName}
            users={props.users}
            triggerClassName="h-11 w-full gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white hover:bg-[#4a5bf0] sm:w-auto"
            triggerLabel="Создать документ"
            triggerIcon={<Plus className="size-5" strokeWidth={2.5} />}
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

export function EmptyDocumentsState({ label }: { label?: string } = {}) {
  return (
    // На белом фоне раздела сплошная рамка + ring читались как «рамка ради
    // рамки» — оставили только пунктир, как в design-system empty state.
    <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-9 text-center">
      <div className="text-[15px] font-medium text-[#6f7282]">
        {label ?? "Документов пока нет"}
      </div>
      <div className="mt-1 text-[13px] text-[#9b9fb3]">
        Создайте первый документ кнопкой выше.
      </div>
    </div>
  );
}

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
