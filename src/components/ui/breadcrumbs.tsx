"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  MENU_ITEM_ACTIVE_CLASS,
  MENU_ITEM_CLASS,
  MENU_LABEL_CLASS,
  MENU_PANEL_CLASS,
  MENU_PANEL_PADDING_CLASS,
} from "@/components/ui/menu-styles";

/**
 * Хлебные крошки кабинета: «<Организация> › Журналы › <Журнал> › <Документ>».
 *
 * Собраны по образцу ProjectsFlow (тот, в свою очередь, снят с Notion):
 * каждое звено — не подпись, а сегмент-пилюля, который раскрывается ПРИ
 * НАВЕДЕНИИ в список соседей того же уровня. Текущее звено помечено
 * плотной мягкой заливкой, а не жирным шрифтом: так видно, где стоишь,
 * даже боковым зрением.
 *
 * Зачем: типичная смена — обойти несколько журналов подряд. Раньше это
 * стоило двух возвратов в список на каждый переход. Теперь переход
 * «журнал → журнал» и «документ → документ» делается прямо из строки
 * навигации, ни на что не нажимая.
 *
 * Двухуровневое меню: наведение на журнал в списке раскрывает его
 * документы, и клик по документу ведёт сразу в нужный бланк — не нужно
 * сперва открывать журнал, а потом искать документ. Клик по самой строке
 * журнала (мышью) — быстрый переход в журнал, самый частый сценарий.
 *
 * Тач: наведения нет, поэтому тап по строке журнала отдаётся Radix и
 * раскрывает подменю (документ выбирается вторым тапом) — иначе вложенный
 * уровень был бы недостижим с телефона.
 *
 * Укорачивание — двумя независимыми способами:
 *  1. По длине подписи: каждое звено обрезается по `max-w` многоточием.
 *     Названия документов пользователь придумывает сам («Гигиенический
 *     журнал бригады №2, сентябрь»), и одно такое звено иначе распирает
 *     строку на две.
 *  2. По количеству: если звеньев больше `MAX_VISIBLE`, середина
 *     сворачивается в «…», которое само раскрывается тем же меню, — путь
 *     остаётся проходимым целиком, а не просто сокращённым.
 */

export type CrumbMenuItem = {
  label: string;
  href: string;
  /** Точка слева: `ok` — заполнено сегодня, `danger` — нет, `muted` — выключено. */
  status?: "ok" | "danger" | "muted";
  /** Правая колонка пункта: период документа, причина. */
  hint?: string;
  /** Текущая страница — мягкая заливка вместо жирного шрифта. */
  current?: boolean;
  /**
   * Код журнала. Если задан — строка получает вложенное подменю с
   * документами этого журнала, подгружаемое при наведении.
   */
  submenuJournalCode?: string;
};

export type Crumb = {
  label: string;
  href?: string;
  /** Соседи того же уровня — раскрываются по наведению на звено. */
  menu?: CrumbMenuItem[];
  /** Подпись над списком: «Журналы набора», «Документы журнала». */
  menuTitle?: string;
};

/** Больше — сворачиваем середину в «…». Первое + «…» + два последних. */
const MAX_VISIBLE = 5;

const STATUS_DOT: Record<NonNullable<CrumbMenuItem["status"]>, string> = {
  ok: "bg-[#116b2a]",
  danger: "bg-[#a13a32]",
  muted: "bg-[#c6c9d8]",
};

/**
 * Вид сегмента. Наведение — тихая заливка; текущий — плотная пилюля,
 * чтобы текущая страница читалась, а не выглядела «чуть жирнее».
 */
function segmentClass(current?: boolean): string {
  return cn(
    "flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5566f6]/30",
    current
      ? "bg-[#eef1ff] font-medium text-[#0b1024]"
      : "text-[#6f7282] hover:bg-[#f5f6ff] hover:text-[#0b1024]",
  );
}

/** Панель меню — общие константы дизайн-системы (`menu-styles.ts`). */
const PANEL_CLASS = cn("w-72", MENU_PANEL_CLASS, MENU_PANEL_PADDING_CLASS);

const ITEM_CLASS = MENU_ITEM_CLASS;

/** Подсветка ТЕКУЩЕГО пункта — мягкая заливка, как в ProjectsFlow. */
const CURRENT_ITEM_CLASS = MENU_ITEM_ACTIVE_CLASS;

const PANEL_LABEL_CLASS = MENU_LABEL_CLASS;

/**
 * Раскрытие по наведению с задержкой на закрытие: между сегментом и
 * панелью есть зазор, и без задержки список схлопывался ровно тогда,
 * когда курсор до него доезжал. 140 мс — как в ProjectsFlow.
 */
function useHoverMenu() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    cancel();
    setOpen(true);
  }, [cancel]);

  const closeSoon = useCallback(() => {
    cancel();
    timer.current = setTimeout(() => setOpen(false), 140);
  }, [cancel]);

  return { open, setOpen, openNow, closeSoon };
}

export function Breadcrumbs({
  items,
  className = "",
}: {
  items: Crumb[];
  className?: string;
}) {
  const visible = items.filter((item) => item.label.trim().length > 0);
  if (visible.length === 0) return null;

  const collapsed =
    visible.length > MAX_VISIBLE ? visible.slice(1, visible.length - 2) : [];
  const shown: Crumb[] =
    collapsed.length > 0
      ? [
          visible[0],
          {
            label: "…",
            menuTitle: "Пропущенные разделы",
            menu: collapsed.map((crumb) => ({
              label: crumb.label,
              href: crumb.href ?? "#",
            })),
          },
          ...visible.slice(visible.length - 2),
        ]
      : visible;

  return (
    <nav
      aria-label="Хлебные крошки"
      className={cn(
        "flex min-w-0 flex-nowrap items-center gap-0.5 text-[13px] print:hidden",
        className,
      )}
    >
      {shown.map((item, index) => (
        <span
          key={`${item.label}-${index}`}
          className="flex min-w-0 items-center gap-0.5"
        >
          {index > 0 ? (
            <ChevronRight
              aria-hidden
              className="size-4 shrink-0 text-[#c6c9d8]"
            />
          ) : null}
          <CrumbNode crumb={item} isLast={index === shown.length - 1} />
        </span>
      ))}
    </nav>
  );
}

function CrumbNode({ crumb, isLast }: { crumb: Crumb; isLast: boolean }) {
  const router = useRouter();
  const menu = useHoverMenu();

  // Длинные названия обрезаем многоточием: одно имя документа иначе
  // растягивает всю строку навигации.
  const labelClass = isLast
    ? "max-w-[11rem] truncate sm:max-w-[20rem]"
    : "max-w-[8rem] truncate sm:max-w-[14rem]";

  if (!crumb.menu || crumb.menu.length === 0) {
    const Tag = crumb.href && !isLast ? "button" : "span";
    return (
      <Tag
        {...(Tag === "button"
          ? {
              type: "button" as const,
              onClick: () => router.push(crumb.href as string),
            }
          : { "aria-current": isLast ? ("page" as const) : undefined })}
        title={crumb.label}
        className={segmentClass(isLast)}
      >
        <span className={labelClass}>{crumb.label}</span>
      </Tag>
    );
  }

  return (
    <DropdownMenu open={menu.open} onOpenChange={menu.setOpen} modal={false}>
      <DropdownMenuTrigger
        title={crumb.label}
        onMouseEnter={menu.openNow}
        onMouseLeave={menu.closeSoon}
        // Клик по самому сегменту — переход по ссылке (если она есть), а не
        // открытие списка: список и так раскрыт наведением. На тач-устройстве
        // ссылки у текущего звена нет, и клик отдаётся Radix.
        onClick={(e) => {
          if (!crumb.href || isLast) return;
          e.preventDefault();
          menu.setOpen(false);
          router.push(crumb.href);
        }}
        className={segmentClass(isLast)}
      >
        <span className={labelClass}>{crumb.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={4}
        onMouseEnter={menu.openNow}
        onMouseLeave={menu.closeSoon}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(PANEL_CLASS, "max-h-80 overflow-y-auto")}
      >
        {crumb.menuTitle ? (
          <div className={PANEL_LABEL_CLASS}>{crumb.menuTitle}</div>
        ) : null}
        {crumb.menu.map((item) =>
          item.submenuJournalCode ? (
            <JournalRowWithDocuments
              key={item.href + item.label}
              item={item}
              journalCode={item.submenuJournalCode}
              onNavigate={() => menu.setOpen(false)}
            />
          ) : (
            <DropdownMenuItem
              key={item.href + item.label}
              onSelect={() => router.push(item.href)}
              className={cn(ITEM_CLASS, item.current && CURRENT_ITEM_CLASS)}
            >
              <MenuRow item={item} />
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Одна строка списка: точка статуса, название, правая подпись. */
function MenuRow({ item }: { item: CrumbMenuItem }) {
  return (
    <>
      {item.status ? (
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[item.status])}
        />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.hint ? (
        <span className="shrink-0 text-[11px] text-[#9b9fb3]">{item.hint}</span>
      ) : null}
    </>
  );
}

/**
 * Строка журнала с вложенным списком его документов.
 *
 * Документы грузятся при первом раскрытии подменю, а не вместе со
 * страницей: журналов в наборе три-четыре десятка, и тянуть документы
 * всех сразу — тридцать пять лишних запросов ради одного открытого
 * подменю.
 */
function JournalRowWithDocuments({
  item,
  journalCode,
  onNavigate,
}: {
  item: CrumbMenuItem;
  journalCode: string;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const [documents, setDocuments] = useState<CrumbMenuItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  // Тип указателя запоминаем на pointerdown: у синтезированного click
  // pointerType в части браузеров пустой, и отличить тап от мыши внутри
  // самого click надёжно нельзя.
  const pointerType = useRef<string>("mouse");

  const load = useCallback(() => {
    if (documents !== null || loading) return;
    setLoading(true);
    fetch(`/api/journals/${journalCode}/documents-menu`)
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setDocuments((data?.items as CrumbMenuItem[]) ?? []))
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [documents, journalCode, loading]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        onPointerDown={(e) => {
          pointerType.current = e.pointerType || "mouse";
        }}
        onPointerEnter={load}
        onFocus={load}
        onClick={(e) => {
          // Тач и перо: ховера нет, а Radix раскрывает подменю указателем
          // только для мыши. Отдаём click ему — иначе документы журнала
          // недостижимы с телефона.
          if (pointerType.current !== "mouse") return;
          // Мышь: подменю и так раскрыто наведением, поэтому клик по строке
          // остаётся быстрым переходом в сам журнал — самый частый сценарий.
          e.preventDefault();
          onNavigate();
          router.push(item.href);
        }}
        className={cn(
          ITEM_CLASS,
          "min-w-0 data-[state=open]:bg-[#fafbff]",
          item.current && CURRENT_ITEM_CLASS,
        )}
      >
        <MenuRow item={item} />
      </DropdownMenuSubTrigger>
      {/* Портал обязателен: без него подменю обрежется скроллом родительского
          списка (у него overflow-y-auto под длинный набор журналов). */}
      <DropdownMenuPortal>
        <DropdownMenuSubContent
          alignOffset={-4}
          className={cn(PANEL_CLASS, "max-h-80 overflow-y-auto")}
        >
          <div className={PANEL_LABEL_CLASS}>Документы журнала</div>
          {loading || documents === null ? (
            <div className="flex items-center gap-2 px-2 py-2 text-[12px] text-[#9b9fb3]">
              <Loader2 className="size-3.5 animate-spin" />
              Загружаем
            </div>
          ) : documents.length === 0 ? (
            <div className="px-2 py-2 text-[12px] text-[#9b9fb3]">
              Документов пока нет
            </div>
          ) : (
            documents.map((doc) => (
              <DropdownMenuItem
                key={doc.href}
                onSelect={() => {
                  onNavigate();
                  router.push(doc.href);
                }}
                className={cn(ITEM_CLASS, "min-w-0")}
              >
                <MenuRow item={doc} />
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
